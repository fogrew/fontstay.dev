import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
  auditCssFiles,
  CATEGORIES,
  type Category,
  describeIssue,
  EXPORT_FORMATS,
  type ExportFormat,
  type FitOutput,
  FitRunError,
  FontParseError,
  fitFiles,
  OS_IDS,
  type OsId,
  STACK_SCRIPTS,
  type StackScript,
} from './index';

export const USAGE = `Usage: fontstay fit <font-file...> [options]
       fontstay audit <css-file...> [--json]
       fontstay mcp

Generate metric-adjusted fallback @font-face rules for web fonts.

fontstay audit reads the @font-face rules of CSS files and warns about web fonts split in a way
that slows text layout: basic Latin across several files, overlapping unicode-range values, and
the face with the most glyphs declared before faces that overlap it. The warnings are
informational; the exit code stays 0.

fontstay mcp starts an MCP server on stdio (tools: analyze_font, suggest_fallbacks, get_css,
get_export, audit_font_faces) for coding agents.

Options:
  -s, --systems <list>     Comma-separated systems to fit: ${OS_IDS.join(', ')}
                           (default: every system in the audience)
  -a, --audience <query>   Browserslist query, optionally with "os <system>" and
                           "not os <system>" parts (default: project Browserslist
                           config, or baseline widely available if none)
  -f, --format <format>    ${EXPORT_FORMATS.join(', ')} (default: css)
  -k, --kind <kind>        Fallback kind: ${CATEGORIES.join(', ')} (default: detected from the font)
      --locale <en|ru>     Frequency profile for the fit (default: en)
      --unicode-range      Add unicode-range from the glyphs the font covers
      --no-scripts         Do not emit separate faces for other scripts
      --stack-scripts <list>  Comma-separated scripts (${STACK_SCRIPTS.join(', ')}) that get a
                           :lang() rule with system fonts only
  -o, --out <file>         Write the output to a file instead of stdout
      --json               Print a JSON report (output, picks, shares) instead of the file text
  -h, --help               Show this help
  -v, --version            Show the version
`;

export interface Io {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

const LOW_COVERAGE = 0.9;

class UsageError extends Error {}

function choice<T extends string>(value: string, allowed: readonly T[], flag: string): T {
  if (!(allowed as readonly string[]).includes(value)) {
    throw new UsageError(`Invalid ${flag} "${value}". Expected one of: ${allowed.join(', ')}.`);
  }
  return value as T;
}

function systemsOf(value: string): OsId[] {
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => choice(item, OS_IDS, '--systems entry'));
}

function stackScriptsOf(value: string): StackScript[] {
  const scripts = value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .map((item) => choice(item, STACK_SCRIPTS, '--stack-scripts entry'));
  if (scripts.length === 0) throw new UsageError('--stack-scripts needs at least one script.');
  return scripts;
}

function reportOf({ css: _css, ...rest }: FitOutput) {
  return rest;
}

async function version(): Promise<string> {
  const file = new URL('../package.json', import.meta.url);
  return (JSON.parse(await readFile(file, 'utf8')) as { version: string }).version;
}

async function projectAudience(): Promise<string | undefined> {
  const { default: browserslist } = await import('browserslist');
  try {
    const config = browserslist.loadConfig({ path: process.cwd() }) as
      | string[]
      | string
      | undefined;
    return Array.isArray(config) ? config.join(', ') : config;
  } catch (failure) {
    const detail = failure instanceof Error ? failure.message : String(failure);
    throw new FitRunError('invalid-audience', `Invalid project Browserslist config: ${detail}`);
  }
}

export async function run(argv: readonly string[], io: Io): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args: [...argv],
      allowPositionals: true,
      options: {
        systems: { type: 'string', short: 's' },
        audience: { type: 'string', short: 'a' },
        format: { type: 'string', short: 'f' },
        kind: { type: 'string', short: 'k' },
        locale: { type: 'string' },
        'unicode-range': { type: 'boolean' },
        'no-scripts': { type: 'boolean' },
        'stack-scripts': { type: 'string' },
        out: { type: 'string', short: 'o' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    });
    if (values.systems !== undefined && systemsOf(values.systems).length === 0) {
      throw new UsageError('--systems needs at least one system.');
    }
    if (values.help) {
      io.stdout(USAGE);
      return 0;
    }
    if (values.version) {
      io.stdout(`${await version()}\n`);
      return 0;
    }
    const [command, ...files] = positionals;
    if (command === 'audit') {
      if (files.length === 0) throw new UsageError('Give at least one CSS file.');
      const audits = await auditCssFiles(files);
      if (values.json) io.stdout(`${JSON.stringify(audits, null, 2)}\n`);
      else {
        for (const audit of audits) {
          for (const issue of audit.issues) {
            io.stdout(`warning: ${audit.file}: ${describeIssue(issue)}\n`);
          }
        }
        const total = audits.reduce((sum, audit) => sum + audit.issues.length, 0);
        if (total === 0) io.stdout('No split-font problems found.\n');
      }
      return 0;
    }
    if (command !== 'fit') {
      throw new UsageError(command ? `Unknown command "${command}".` : 'Missing command.');
    }
    if (files.length === 0) throw new UsageError('Give at least one font file.');
    const format: ExportFormat = choice(values.format ?? 'css', EXPORT_FORMATS, '--format');
    const kind: Category | undefined = values.kind
      ? choice(values.kind, CATEGORIES, '--kind')
      : undefined;
    const locale = values.locale ? choice(values.locale, ['en', 'ru'] as const, '--locale') : 'en';
    const audience = values.audience ?? (await projectAudience());

    const result = await fitFiles(files, {
      ...(audience ? { audience } : {}),
      ...(values.systems ? { systems: systemsOf(values.systems) } : {}),
      ...(kind ? { kind } : {}),
      locale,
      unicodeRange: values['unicode-range'] ?? false,
      scripts: !values['no-scripts'],
      ...(values['stack-scripts'] !== undefined
        ? { stackScripts: stackScriptsOf(values['stack-scripts']) }
        : {}),
      format,
    });
    for (const font of result.fonts) {
      if (font.coverage < LOW_COVERAGE) {
        io.stderr(
          `warning: ${font.fileName}: fallbacks share only ${Math.round(font.coverage * 100)}% of its glyphs\n`,
        );
      }
      if (font.webRatioFailed) {
        io.stderr(`warning: ${font.fileName}: could not shape the font, web width is estimated
`);
      }
    }
    if (result.uncovered.length > 0) {
      io.stderr(`warning: no fallback fonts available for: ${result.uncovered.join(', ')}\n`);
    }
    const text = values.json
      ? `${JSON.stringify(reportOf(result), null, 2)}\n`
      : `${result.file.text}\n`;
    if (values.out) {
      await writeFile(values.out, text);
      io.stderr(`${values.out} written\n`);
    } else {
      io.stdout(text);
    }
    return 0;
  } catch (failure) {
    if (failure instanceof UsageError) {
      io.stderr(`error: ${failure.message}\n\n${USAGE}`);
      return 2;
    }
    if (failure instanceof FitRunError) {
      io.stderr(`error: ${failure.message}\n`);
      return 1;
    }
    if (failure instanceof FontParseError) {
      io.stderr(`error: the font could not be read (${failure.code})\n`);
      return 1;
    }
    const code = failure instanceof Error ? (failure as NodeJS.ErrnoException).code : undefined;
    if (code?.startsWith('ERR_PARSE_ARGS')) {
      io.stderr(`error: ${(failure as Error).message}

${USAGE}`);
      return 2;
    }
    if (code !== undefined && /^E[A-Z]+$/.test(code)) {
      io.stderr(`error: ${(failure as Error).message}
`);
      return 1;
    }
    throw failure;
  }
}
