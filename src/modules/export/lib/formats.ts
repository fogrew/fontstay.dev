import type { FallbackFace } from './model';

export interface ExportInput {
  targetFamily: string;
  generic: string;
  fontFaces: string;
  families: readonly string[];
  strategy: string;
  css: string;
  loadingScript: string;
  fileName: string;
  fallbacks: readonly FallbackFace[];
}

export const EXPORT_FORMATS = [
  'css',
  'variables',
  'tailwind',
  'next',
  'nuxt',
  'astro',
  'json',
  'preload',
  'loading',
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportFile {
  text: string;
  fileName: string;
  language: 'css' | 'js' | 'ts' | 'json' | 'html';
}

const stackOf = (input: ExportInput) => `${input.families.join(', ')}, ${input.generic}`;

const indent = (text: string, spaces = 2) =>
  text
    .split('\n')
    .map((line) => (line ? `${' '.repeat(spaces)}${line}` : line))
    .join('\n');

const quoted = (value: string) => `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const extensionOf = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? 'woff2';

const MIME: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

const unquote = (name: string) => name.replace(/^"|"$/g, '');

const fallbackNames = (input: ExportInput) => input.families.slice(1).map(unquote);

const percent = (ratio: number) => `${Number((ratio * 100).toFixed(4))}%`;

function themeName(generic: string): string {
  if (generic === 'serif') return '--font-serif';
  return generic === 'monospace' ? '--font-mono' : '--font-sans';
}

export function buildExport(format: ExportFormat, input: ExportInput): ExportFile {
  const safeName = input.fileName || 'font.woff2';
  const fallbacks = [...fallbackNames(input), input.generic];
  switch (format) {
    case 'css':
      return { text: input.css, fileName: 'fallback-fonts.css', language: 'css' };
    case 'variables':
      return {
        text: [
          input.fontFaces,
          `:root {\n  --font-body: ${stackOf(input)};\n}`,
          `body {\n  font-family: var(--font-body);${input.strategy ? `\n${indent(input.strategy)}` : ''}\n}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        fileName: 'fallback-fonts.css',
        language: 'css',
      };
    case 'tailwind':
      return {
        text: [
          '@import "tailwindcss";',
          input.fontFaces,
          `@theme {\n  ${themeName(input.generic)}: ${stackOf(input)};\n}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        fileName: 'app.css',
        language: 'css',
      };
    case 'next':
      return {
        text: [
          '// Put the @font-face rules below into your global CSS (see the CSS export).',
          "import localFont from 'next/font/local';",
          '',
          'export const font = localFont({',
          `  src: ${quoted(`./fonts/${safeName}`)},`,
          "  display: 'swap',",
          '  adjustFontFallback: false,',
          `  fallback: [${fallbacks.map(quoted).join(', ')}],`,
          "  variable: '--font-body',",
          '});',
        ].join('\n'),
        fileName: 'font.ts',
        language: 'ts',
      };
    case 'nuxt':
      return {
        text: [
          '// Add the @font-face rules from the CSS export to a stylesheet listed in `css`.',
          'export default defineNuxtConfig({',
          "  modules: ['@nuxt/fonts'],",
          '  fonts: {',
          '    families: [',
          '      {',
          `        name: ${quoted(input.targetFamily)},`,
          `        src: ${quoted(`/fonts/${safeName}`)},`,
          `        fallbacks: [${fallbacks.map(quoted).join(', ')}],`,
          '      },',
          '    ],',
          '  },',
          '});',
        ].join('\n'),
        fileName: 'nuxt.config.ts',
        language: 'ts',
      };
    case 'astro':
      return {
        text: [
          '// Add the @font-face rules from the CSS export to your global styles.',
          "import { defineConfig } from 'astro/config';",
          '',
          'export default defineConfig({',
          '  fonts: [',
          '    {',
          `      name: ${quoted(input.targetFamily)},`,
          "      cssVariable: '--font-body',",
          "      provider: 'local',",
          '      options: {',
          `        variants: [{ weight: 400, style: 'normal', src: [${quoted(`./src/assets/fonts/${safeName}`)}] }],`,
          '      },',
          `      fallbacks: [${fallbacks.map(quoted).join(', ')}],`,
          '    },',
          '  ],',
          '});',
        ].join('\n'),
        fileName: 'astro.config.mjs',
        language: 'js',
      };
    case 'json':
      return {
        text: JSON.stringify(
          {
            family: input.targetFamily,
            generic: input.generic,
            stack: [...input.families.map(unquote), input.generic],
            fallbacks: input.fallbacks.map((face) => ({
              family: face.family,
              src: face.localNames,
              sizeAdjust: percent(face.adjustment.sizeAdjust),
              ascentOverride: percent(face.adjustment.ascentOverride),
              descentOverride: percent(face.adjustment.descentOverride),
              lineGapOverride: percent(face.adjustment.lineGapOverride),
              ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}),
              ...(face.fontWeight ? { fontWeight: face.fontWeight } : {}),
              ...(face.fontStyle ? { fontStyle: face.fontStyle } : {}),
            })),
          },
          null,
          2,
        ),
        fileName: 'fallback-fonts.json',
        language: 'json',
      };
    case 'preload': {
      const type = MIME[extensionOf(safeName)] ?? 'font/woff2';
      return {
        text: `<link rel="preload" href="/fonts/${encodeURI(safeName)}" as="font" type="${type}" crossorigin>`,
        fileName: 'preload.html',
        language: 'html',
      };
    }
    case 'loading':
      return { text: input.loadingScript, fileName: 'font-loading.js', language: 'js' };
  }
}
