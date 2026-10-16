import { HELP } from './help';
import type { ToolHost, ToolResult, WebMcpTool } from './types';

const text = (value: unknown): ToolResult => ({
  content: [
    { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
  ],
});

const stringOf = (value: unknown) => (typeof value === 'string' ? value : '');
const numberOf = (value: unknown) => (typeof value === 'number' ? value : Number.NaN);
const MAX_TEXT = 20_000;

const idInput = {
  type: 'object',
  properties: { id: { type: 'number', description: 'Font id from list-fonts.' } },
  required: ['id'],
} as const;

export function buildTools(host: () => ToolHost): WebMcpTool[] {
  return [
    {
      name: 'list-fonts',
      description:
        'List the fonts the user has loaded in fontstay.dev with their id, family, style, detected type and scripts. Call this first.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => text(host().listFonts()),
    },
    {
      name: 'select-font',
      description:
        'Make a loaded font the one that is shown and tuned. Takes the id from list-fonts.',
      inputSchema: idInput,
      execute: (input) =>
        text(
          host().selectFont(numberOf(input.id)) ? 'Selected.' : 'There is no font with this id.',
        ),
    },
    {
      name: 'analyze-font',
      description:
        'Describe a loaded font: names, weight, vertical metrics, scripts it covers, glyph count and how much of a typical text it covers.',
      inputSchema: idInput,
      execute: (input) =>
        text(host().analyzeFont(numberOf(input.id)) ?? 'There is no font with this id.'),
    },
    {
      name: 'get-audience',
      description:
        'Read the current audience: the Browserslist query and the estimated share of each operating system.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => text(host().getAudience()),
    },
    {
      name: 'set-audience',
      description:
        'Set the audience with a Browserslist query, for example "defaults", "baseline widely available", "last 2 versions" or "> 1%, not dead". Changes the suggested fallbacks.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'A valid Browserslist query.' } },
        required: ['query'],
      },
      execute: (input) => {
        const query = stringOf(input.query).trim().slice(0, 2000);
        if (!query) return text('The query is empty.');
        return text(host().setAudience(query).message);
      },
    },
    {
      name: 'suggest-fallbacks',
      description:
        'For each loaded font, list the fallback font chosen per operating system for the current audience, with the audience share of each system.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => text(host().suggest()),
    },
    {
      name: 'set-fallbacks',
      description:
        'Choose the fallback fonts of one operating system for a font. Fonts are ids such as arial, segoe-ui, roboto, helvetica, liberation-sans; use suggest-fallbacks to see valid ones. The change is shown to the user.',
      inputSchema: {
        type: 'object',
        properties: {
          fontId: { type: 'number', description: 'Font id from list-fonts.' },
          system: {
            type: 'string',
            description: 'Operating system.',
            enum: ['windows', 'macos', 'ios', 'android', 'linux', 'chromeos'],
          },
          fonts: { type: 'string', description: 'Comma separated fallback font ids, best first.' },
        },
        required: ['fontId', 'system', 'fonts'],
      },
      execute: (input) =>
        text(
          host().setFallbacks({
            fontId: numberOf(input.fontId),
            system: stringOf(input.system),
            fonts: stringOf(input.fonts)
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
              .slice(0, 8),
          }).message,
        ),
    },
    {
      name: 'set-font-kind',
      description: 'Set the type of a loaded font, which decides the candidate fallbacks.',
      inputSchema: {
        type: 'object',
        properties: {
          fontId: { type: 'number', description: 'Font id from list-fonts.' },
          kind: {
            type: 'string',
            description: 'Font type.',
            enum: ['sans-serif', 'serif', 'monospace'],
          },
        },
        required: ['fontId', 'kind'],
      },
      execute: (input) =>
        text(
          host().setKind(numberOf(input.fontId), stringOf(input.kind))
            ? 'The font type was changed.'
            : 'Unknown font or type.',
        ),
    },
    {
      name: 'get-css',
      description:
        'Return the generated CSS (@font-face rules with the adjusted fallbacks and the font-family rules).',
      inputSchema: { type: 'object', properties: {} },
      execute: () => text(host().getCss().slice(0, MAX_TEXT)),
    },
    {
      name: 'get-export',
      description:
        'Return the output in another format: CSS variables, Tailwind theme, Next.js, Nuxt, Astro, preload tags or a loading script.',
      inputSchema: {
        type: 'object',
        properties: { format: { type: 'string', description: 'Export format id.' } },
        required: ['format'],
      },
      execute: (input) => {
        const result = host().getExport(stringOf(input.format));
        return text(
          result?.slice(0, MAX_TEXT) ??
            `Unknown format. Use one of: ${host().exportFormats().join(', ')}.`,
        );
      },
    },
    {
      name: 'get-layout-shift',
      description:
        'Return the layout shift of the sample article measured in this browser at three widths, with and without the adjusted fallback. Below 0.1 is good.',
      inputSchema: { type: 'object', properties: {} },
      execute: () => text(host().getShift() ?? 'The measurement is not ready yet.'),
    },
    {
      name: 'explain-setting',
      description: `Explain a setting in plain language. Topics: ${Object.keys(HELP).join(', ')}.`,
      inputSchema: {
        type: 'object',
        properties: { topic: { type: 'string', description: 'The topic to explain.' } },
        required: ['topic'],
      },
      execute: (input) => {
        const topic = stringOf(input.topic).toLowerCase().trim();
        return text(
          (Object.hasOwn(HELP, topic) ? HELP[topic] : undefined) ??
            `Unknown topic. Topics: ${Object.keys(HELP).join(', ')}.`,
        );
      },
    },
  ];
}
