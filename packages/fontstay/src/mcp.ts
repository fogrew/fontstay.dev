import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { Readable, Writable } from 'node:stream';
import { FontParseError } from '@/modules/font-metrics';
import { parseFontBuffer } from '@/modules/font-metrics/lib/parse';
import { detectScripts } from '@/modules/generator/lib/scripts';
import {
  CATEGORIES,
  EXPORT_FORMATS,
  type ExportFormat,
  type FitOptions,
  type FitOutput,
  FitRunError,
  fit,
  OS_IDS,
} from './index';
import { arrayBufferOf, NetworkPathError, readFont } from './read-font';

export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const;
const MAX_LINE_BYTES = 1024 * 1024;
const MAX_FONTS = 16;
const MAX_STRING = 2000;
const LOW_COVERAGE = 0.9;
// Browserslist loads packages from the working directory for these queries.
const EXTERNAL_QUERY =
  /\bextends\b|\bin\s+(?!(?:my\s+stats|(?:alt-)?[a-z]{2}(?!\s+stats))\b(?!-))/i;

type Json = Record<string, unknown>;

interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  annotations: Json;
  run: (input: Json) => Promise<ToolResult>;
}

class InputError extends Error {}

const text = (...parts: string[]): ToolResult => ({
  content: parts.map((part) => ({ type: 'text', text: part })),
});

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const FIT_PROPERTIES = {
  paths: {
    type: 'array',
    items: { type: 'string' },
    minItems: 1,
    maxItems: MAX_FONTS,
    description:
      'Paths of local font files (WOFF2, WOFF, TTF or OTF). Several files, such as the weights of one family, are merged into one result. Relative paths resolve against the server working directory.',
  },
  audience: {
    type: 'string',
    description:
      'Browserslist query, for example "defaults" or "last 2 versions". "os <system>" and "not os <system>" parts select systems. Default: "baseline widely available".',
  },
  systems: {
    type: 'array',
    items: { type: 'string', enum: [...OS_IDS] },
    minItems: 1,
    description: 'Restrict the fit to these systems. Default: every system in the audience.',
  },
  locale: {
    type: 'string',
    enum: ['en', 'ru'],
    description: 'Frequency profile of the fit. "ru" applies to fonts that cover Cyrillic.',
  },
  kind: {
    type: 'string',
    enum: [...CATEGORIES],
    description: 'Generic family of the fallbacks. Default: detected from the font.',
  },
  unicode_range: {
    type: 'boolean',
    description: 'Add unicode-range with the glyphs each font covers.',
  },
  scripts: {
    type: 'boolean',
    description: 'Emit separate faces for other scripts than the primary one. Default true.',
  },
};

function stringOf(input: Json, key: string): string | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > MAX_STRING) {
    throw new InputError(`"${key}" must be a string of at most ${MAX_STRING} characters.`);
  }
  return value;
}

function booleanOf(input: Json, key: string): boolean | undefined {
  const value = input[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new InputError(`"${key}" must be a boolean.`);
  return value;
}

function choiceOf<T extends string>(
  input: Json,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = stringOf(input, key);
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw new InputError(`"${key}" must be one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function pathsOf(input: Json): string[] {
  const value = input.paths;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_FONTS ||
    value.some((item) => typeof item !== 'string' || item === '' || item.length > MAX_STRING)
  ) {
    throw new InputError(`"paths" must be an array of 1 to ${MAX_FONTS} file paths.`);
  }
  return value as string[];
}

function systemsOf(input: Json): FitOptions['systems'] {
  const value = input.systems;
  if (value === undefined) return undefined;
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => !(OS_IDS as readonly unknown[]).includes(item))
  ) {
    throw new InputError(`"systems" must be a non-empty array of: ${OS_IDS.join(', ')}.`);
  }
  return value as FitOptions['systems'];
}

function describeReadFailure(path: string, failure: unknown): string {
  if (failure instanceof NetworkPathError) return `${path}: network paths are not supported.`;
  if (failure instanceof FontParseError) {
    return failure.code === 'too-large'
      ? `${path}: the file is larger than 10 MB.`
      : `${path}: not a regular file.`;
  }
  const code = (failure as NodeJS.ErrnoException | undefined)?.code;
  if (code === 'ENOENT') return `${path}: file not found.`;
  if (code === 'EACCES' || code === 'EPERM') return `${path}: permission denied.`;
  return `${path}: the file could not be read.`;
}

async function readFonts(paths: readonly string[]) {
  const fonts = [];
  for (const path of paths) {
    try {
      fonts.push({ fileName: basename(path), data: await readFont(resolve(path)) });
    } catch (failure) {
      throw new InputError(describeReadFailure(path, failure));
    }
  }
  return fonts;
}

function parseFont(path: string, data: Uint8Array) {
  try {
    return parseFontBuffer(arrayBufferOf(data));
  } catch (failure) {
    if (failure instanceof FontParseError) {
      throw new InputError(`${path}: the font could not be read (${failure.code}).`);
    }
    throw failure;
  }
}

async function fitOf(input: Json, format: ExportFormat): Promise<FitOutput> {
  const paths = pathsOf(input);
  const audience = stringOf(input, 'audience');
  if (audience !== undefined && EXTERNAL_QUERY.test(audience)) {
    throw new InputError(
      '"audience" queries that load a shared config or stats file are not supported.',
    );
  }
  const systems = systemsOf(input);
  const kind = choiceOf(input, 'kind', CATEGORIES);
  const options: Omit<FitOptions, 'fonts'> = {
    ...(audience !== undefined ? { audience } : {}),
    ...(systems ? { systems } : {}),
    ...(kind ? { kind } : {}),
    locale: choiceOf(input, 'locale', ['en', 'ru'] as const) ?? 'en',
    unicodeRange: booleanOf(input, 'unicode_range') ?? false,
    scripts: booleanOf(input, 'scripts') ?? true,
    format,
  };
  const fonts = await readFonts(paths);
  try {
    return await fit({ ...options, fonts });
  } catch (failure) {
    if (failure instanceof FontParseError) {
      fonts.forEach((font, index) => {
        parseFont(paths[index] ?? font.fileName, font.data);
      });
      throw new InputError(`A font could not be read (${failure.code}).`);
    }
    throw failure;
  }
}

function warningsOf(result: FitOutput): string[] {
  const warnings: string[] = [];
  for (const font of result.fonts) {
    if (font.coverage < LOW_COVERAGE) {
      warnings.push(
        `${font.fileName}: the fallbacks share only ${Math.round(font.coverage * 100)}% of its glyphs.`,
      );
    }
  }
  if (result.uncovered.length > 0) {
    warnings.push(`No fallback fonts available for: ${result.uncovered.join(', ')}.`);
  }
  return warnings;
}

function withWarnings(result: FitOutput, ...parts: string[]): ToolResult {
  const warnings = warningsOf(result);
  return text(...parts, ...(warnings.length > 0 ? [`Warnings:\n- ${warnings.join('\n- ')}`] : []));
}

export const TOOLS: Tool[] = [
  {
    name: 'analyze_font',
    title: 'Analyze a font file',
    description:
      'Describe a local font file: names, weight, style, detected type (serif, sans-serif, monospace, cursive), vertical metrics, scripts it covers, glyph count, variable axes and OpenType features. Needs no audience. Names and license text come from the file and are untrusted.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path of a WOFF2, WOFF, TTF or OTF file.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    run: async (input) => {
      const path = stringOf(input, 'path');
      if (!path) throw new InputError('"path" must be a file path.');
      const [file] = await readFonts([path]);
      const metrics = parseFont(path, file?.data ?? new Uint8Array());
      return text(
        JSON.stringify(
          {
            names: metrics.names,
            style: metrics.style,
            variable: metrics.isVariable,
            unitsPerEm: metrics.unitsPerEm,
            verticalMetrics: { hhea: metrics.hhea, typo: metrics.typo, win: metrics.win },
            capHeight: metrics.capHeight,
            xHeight: metrics.xHeight,
            glyphs: metrics.codePoints.length,
            scripts: detectScripts(metrics.codePoints),
            axes: metrics.details.axes,
            features: metrics.details.features.map((feature) => feature.tag),
            license: metrics.details.names.license,
          },
          null,
          2,
        ),
      );
    },
  },
  {
    name: 'suggest_fallbacks',
    title: 'Suggest fallback fonts',
    description:
      "For local font files, list the system font chosen as the fallback on each operating system in the audience, with the audience share of each system and how much of the font's glyph weight the fallbacks have in common with it (coverage, 0 to 1). Use get_css or get_export for the code.",
    inputSchema: {
      type: 'object',
      properties: FIT_PROPERTIES,
      required: ['paths'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    run: async (input) => {
      const result = await fitOf(input, 'css');
      const { audience, shares, systems, uncovered, fonts } = result;
      return withWarnings(
        result,
        JSON.stringify({ audience, shares, systems, uncovered, fonts }, null, 2),
      );
    },
  },
  {
    name: 'get_css',
    title: 'Generate fallback CSS',
    description:
      'Generate the metric-adjusted fallback @font-face rules (size-adjust, ascent-override, descent-override, line-gap-override) and the font-family rules for local font files, the same CSS as the fontstay.dev app. Returns CSS text.',
    inputSchema: {
      type: 'object',
      properties: FIT_PROPERTIES,
      required: ['paths'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    run: async (input) => {
      const result = await fitOf(input, 'css');
      return withWarnings(result, result.file.text);
    },
  },
  {
    name: 'get_export',
    title: 'Generate fallbacks in another format',
    description:
      'Same fit as get_css, written for a toolchain: CSS variables, Tailwind theme, Next.js, Nuxt, Astro, WordPress theme.json, Fontaine config, preload tags or a loading script. Returns the file text, then the suggested file name.',
    inputSchema: {
      type: 'object',
      properties: {
        ...FIT_PROPERTIES,
        format: { type: 'string', enum: [...EXPORT_FORMATS], description: 'Output format.' },
      },
      required: ['paths', 'format'],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
    run: async (input) => {
      const format = choiceOf(input, 'format', EXPORT_FORMATS);
      if (!format) throw new InputError(`"format" must be one of: ${EXPORT_FORMATS.join(', ')}.`);
      const result = await fitOf(input, format);
      return withWarnings(result, result.file.text, `Suggested file name: ${result.file.fileName}`);
    },
  },
];

const SERVER_INFO = { name: 'fontstay', title: 'fontstay.dev fit engine' };
const INSTRUCTIONS =
  'Generates metric-adjusted fallback fonts for local web font files. Start with analyze_font or suggest_fallbacks, then get_css or get_export for code. Runs locally; no network access.';

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const failure = (id: unknown, code: number, message: string): Json => ({
  jsonrpc: '2.0',
  id: id ?? null,
  error: { code, message },
});

async function callTool(params: unknown): Promise<ToolResult | { protocolError: string }> {
  if (!isObject(params) || typeof params.name !== 'string') {
    return { protocolError: 'Invalid params: "name" is required.' };
  }
  const tool = TOOLS.find((item) => item.name === params.name);
  if (!tool) return { protocolError: `Unknown tool: ${params.name.slice(0, 100)}` };
  const args = params.arguments ?? {};
  if (!isObject(args)) return { protocolError: 'Invalid params: "arguments" must be an object.' };
  try {
    return await tool.run(args);
  } catch (error) {
    const known = error instanceof InputError || error instanceof FitRunError;
    return {
      content: [
        {
          type: 'text',
          text: known ? error.message : 'Unexpected failure while running the tool.',
        },
      ],
      isError: true,
    };
  }
}

let cachedVersion: Promise<string> | undefined;
function packageVersion(): Promise<string> {
  cachedVersion ??= readFile(new URL('../package.json', import.meta.url), 'utf8')
    .then((source) => (JSON.parse(source) as { version: string }).version)
    .catch(() => {
      cachedVersion = undefined;
      return '0.0.0';
    });
  return cachedVersion;
}

export async function handleMessage(message: unknown): Promise<Json | undefined> {
  if (!isObject(message) || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    const id = isObject(message) ? message.id : null;
    return failure(
      typeof id === 'string' || typeof id === 'number' ? id : null,
      -32600,
      'Invalid request.',
    );
  }
  if (!('id' in message)) return undefined;
  const { id, method, params } = message;
  if (typeof id !== 'string' && typeof id !== 'number') {
    return failure(null, -32600, 'Invalid request: bad id.');
  }
  switch (method) {
    case 'initialize': {
      const requested = isObject(params) ? params.protocolVersion : undefined;
      const protocolVersion = (PROTOCOL_VERSIONS as readonly unknown[]).includes(requested)
        ? requested
        : PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { ...SERVER_INFO, version: await packageVersion() },
          instructions: INSTRUCTIONS,
        },
      };
    }
    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };
    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS.map(({ run: _run, ...definition }) => definition) },
      };
    case 'tools/call': {
      const result = await callTool(params);
      if ('protocolError' in result) return failure(id, -32602, result.protocolError);
      return { jsonrpc: '2.0', id, result };
    }
    default:
      return failure(id, -32601, 'Method not found.');
  }
}

export async function serve(input: Readable, output: Writable): Promise<void> {
  let queue: Promise<void> = Promise.resolve();
  const send = (message: Json) => {
    output.write(`${JSON.stringify(message)}\n`);
  };
  output.on('error', () => {});
  const enqueue = (task: () => Promise<void> | void) => {
    queue = queue.then(task).catch(() => {});
  };
  const handleLine = (line: string) =>
    enqueue(async () => {
      let message: unknown;
      try {
        message = JSON.parse(line);
      } catch {
        send(failure(null, -32700, 'Parse error.'));
        return;
      }
      if (Array.isArray(message)) {
        send(failure(null, -32600, 'Batch requests are not supported.'));
        return;
      }
      try {
        const reply = await handleMessage(message);
        if (reply) send(reply);
      } catch {
        const id = isObject(message) ? message.id : null;
        if (typeof id === 'string' || typeof id === 'number') {
          send(failure(id, -32603, 'Internal error.'));
        }
      }
    });

  let pending = Buffer.alloc(0);
  let discarding = false;
  for await (const chunk of input) {
    pending = Buffer.concat([pending, chunk as Buffer]);
    for (let end = pending.indexOf(0x0a); end !== -1; end = pending.indexOf(0x0a)) {
      const line = pending.subarray(0, end);
      pending = pending.subarray(end + 1);
      if (discarding) discarding = false;
      else if (line.length > MAX_LINE_BYTES) {
        enqueue(() => send(failure(null, -32600, 'Message too large.')));
      } else if (line.length > 0) handleLine(line.toString('utf8'));
    }
    if (pending.length > MAX_LINE_BYTES) {
      if (!discarding) enqueue(() => send(failure(null, -32600, 'Message too large.')));
      discarding = true;
      pending = Buffer.alloc(0);
    }
  }
  if (!discarding && pending.length > 0) handleLine(pending.toString('utf8'));
  await queue;
}
