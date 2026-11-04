export interface ExportFont {
  fileName: string;
  weight: number;
  style: 'normal' | 'italic';
}

export interface ExportFamily {
  targetFamily: string;
  generic: string;
  families: readonly string[];
  systemFonts: readonly string[];
  fonts: readonly ExportFont[];
}

export interface ExportInput {
  families: readonly ExportFamily[];
  fontFaces: string;
  strategy: string;
  css: string;
  loadingScript: string;
}

export const EXPORT_FORMATS = [
  'css',
  'variables',
  'tailwind',
  'next',
  'nuxt',
  'astro',
  'wordpress',
  'fontaine',
  'preload',
  'loading',
] as const;

export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportFile {
  text: string;
  fileName: string;
  language: 'css' | 'js' | 'ts' | 'html' | 'json';
}

const stackOf = (family: ExportFamily) => `${family.families.join(', ')}, ${family.generic}`;

const indent = (text: string, spaces = 2) =>
  text
    .split('\n')
    .map((line) => (line ? `${' '.repeat(spaces)}${line}` : line))
    .join('\n');

const isControl = (code: number) =>
  code < 32 || (code >= 127 && code <= 159) || code === 0x2028 || code === 0x2029;

const mapControl = (value: string, replace: (code: number) => string) =>
  [...value]
    .map((char) => (isControl(char.charCodeAt(0)) ? replace(char.charCodeAt(0)) : char))
    .join('');

const escapeUnit = (code: number) => `\\u${code.toString(16).padStart(4, '0')}`;

const quoted = (value: string) =>
  `'${mapControl(value.replace(/\\/g, '\\\\').replace(/'/g, "\\'"), escapeUnit)}'`;

const singleLine = (value: string) => mapControl(value, () => ' ');

const extensionOf = (fileName: string) => fileName.split('.').pop()?.toLowerCase() ?? 'woff2';

const mimeOf = (fileName: string) => {
  const extension = extensionOf(fileName);
  return (Object.hasOwn(MIME, extension) ? MIME[extension] : undefined) ?? 'font/woff2';
};
const MIME: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

const unquote = (name: string) => name.replace(/^"|"$/g, '');

const fallbacksOf = (family: ExportFamily) => [
  ...family.families.slice(1).map(unquote),
  family.generic,
];

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'font';

const camelOf = (name: string) =>
  slugOf(name)
    .replace(/-(\p{L}|\p{N})/gu, (_, char: string) => char.toUpperCase())
    .replace(/^(\d)/, '_$1');

function themeName(generic: string): string {
  if (generic === 'serif') return '--font-serif';
  if (generic === 'cursive') return '--font-cursive';
  return generic === 'monospace' ? '--font-mono' : '--font-sans';
}

const fileOf = (font: ExportFont) => font.fileName || 'font.woff2';

const variableOf = (input: ExportInput, family: ExportFamily) =>
  input.families.length === 1 ? '--font-body' : `--font-${slugOf(family.targetFamily)}`;

const themeVariable = (input: ExportInput, family: ExportFamily) =>
  input.families.length === 1 ? themeName(family.generic) : `--font-${slugOf(family.targetFamily)}`;

function fontsOf(family: ExportFamily): readonly ExportFont[] {
  return family.fonts.length > 0
    ? family.fonts
    : [{ fileName: 'font.woff2', weight: 400, style: 'normal' }];
}

const filesOf = (input: ExportInput) => [
  ...new Set(input.families.flatMap((family) => fontsOf(family).map(fileOf))),
];

function nextBlock(input: ExportInput, family: ExportFamily): string {
  const fonts = fontsOf(family);
  const [only] = fonts;
  const name = input.families.length === 1 ? 'font' : camelOf(family.targetFamily);
  const src =
    fonts.length === 1 && only
      ? `  src: ${quoted(`./fonts/${fileOf(only)}`)},`
      : [
          '  src: [',
          ...fonts.map(
            (font) =>
              `    { path: ${quoted(`./fonts/${fileOf(font)}`)}, weight: '${font.weight}', style: ${quoted(font.style)} },`,
          ),
          '  ],',
        ].join('\n');
  return [
    `export const ${name} = localFont({`,
    src,
    "  display: 'swap',",
    '  adjustFontFallback: false,',
    `  fallback: [${fallbacksOf(family).map(quoted).join(', ')}],`,
    `  variable: ${quoted(variableOf(input, family))},`,
    '});',
  ].join('\n');
}

function nuxtBlock(family: ExportFamily): string {
  const fonts = fontsOf(family);
  const [only] = fonts;
  const src =
    fonts.length === 1 && only
      ? `        src: ${quoted(`/fonts/${fileOf(only)}`)},`
      : [
          '        src: [',
          ...fonts.map(
            (font) =>
              `          { src: ${quoted(`/fonts/${fileOf(font)}`)}, weight: ${font.weight}, style: ${quoted(font.style)} },`,
          ),
          '        ],',
        ].join('\n');
  return [
    '      {',
    `        name: ${quoted(family.targetFamily)},`,
    src,
    `        fallbacks: [${fallbacksOf(family).map(quoted).join(', ')}],`,
    '      },',
  ].join('\n');
}

function astroBlock(input: ExportInput, family: ExportFamily): string {
  const variants = fontsOf(family).map(
    (font) =>
      `{ weight: ${font.weight}, style: ${quoted(font.style)}, src: [${quoted(`./src/assets/fonts/${fileOf(font)}`)}] }`,
  );
  return [
    '    {',
    `      name: ${quoted(family.targetFamily)},`,
    `      cssVariable: ${quoted(variableOf(input, family))},`,
    "      provider: 'local',",
    '      options: {',
    variants.length === 1
      ? `        variants: [${variants[0]}],`
      : [
          '        variants: [',
          ...variants.map((variant) => `          ${variant},`),
          '        ],',
        ].join('\n'),
    '      },',
    `      fallbacks: [${fallbacksOf(family).map(quoted).join(', ')}],`,
    '    },',
  ].join('\n');
}

const jsonEscaped = (json: string) =>
  json.replace(/[\u007f-\u009f\u2028\u2029]/g, (char) => escapeUnit(char.charCodeAt(0)));

function wordpressFamily(family: ExportFamily, slug: string) {
  return {
    name: family.targetFamily,
    slug,
    fontFamily: stackOf(family),
    fontFace: fontsOf(family).map((font) => ({
      fontFamily: family.targetFamily,
      fontWeight: String(font.weight),
      fontStyle: font.style,
      src: [`file:./assets/fonts/${encodeURIComponent(fileOf(font))}`],
    })),
  };
}

function wordpressFamilies(families: readonly ExportFamily[]) {
  const used = new Set<string>();
  return families.map((family) => {
    const base = slugOf(family.targetFamily);
    let slug = base;
    for (let count = 2; used.has(slug); count++) slug = `${base}-${count}`;
    used.add(slug);
    return wordpressFamily(family, slug);
  });
}

function fontaineEntry(family: ExportFamily): string {
  const fonts = family.systemFonts.length > 0 ? family.systemFonts : ['Arial'];
  return `        ${quoted(family.targetFamily)}: [${fonts.map(quoted).join(', ')}],`;
}

export function buildExport(format: ExportFormat, input: ExportInput): ExportFile {
  const families = input.families;
  switch (format) {
    case 'css':
      return { text: input.css, fileName: 'fallback-fonts.css', language: 'css' };
    case 'variables': {
      const [first] = families;
      return {
        text: [
          input.fontFaces,
          `:root {\n${families.map((family) => `  ${variableOf(input, family)}: ${stackOf(family)};`).join('\n')}\n}`,
          first
            ? `body {\n  font-family: var(${variableOf(input, first)});${input.strategy ? `\n${indent(input.strategy)}` : ''}\n}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        fileName: 'fallback-fonts.css',
        language: 'css',
      };
    }
    case 'tailwind':
      return {
        text: [
          '@import "tailwindcss";',
          input.fontFaces,
          `@theme {\n${families.map((family) => `  ${themeVariable(input, family)}: ${stackOf(family)};`).join('\n')}\n}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        fileName: 'app.css',
        language: 'css',
      };
    case 'next':
      return {
        text: [
          `// Put ${singleLine(filesOf(input).join(', '))} into ./fonts/ and the @font-face rules from the CSS export into your global CSS.`,
          "import localFont from 'next/font/local';",
          '',
          families.map((family) => nextBlock(input, family)).join('\n\n'),
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
          families.map(nuxtBlock).join('\n'),
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
          families.map((family) => astroBlock(input, family)).join('\n'),
          '  ],',
          '});',
        ].join('\n'),
        fileName: 'astro.config.mjs',
        language: 'js',
      };
    case 'wordpress':
      return {
        text: jsonEscaped(
          JSON.stringify(
            {
              $schema: 'https://schemas.wp.org/trunk/theme.json',
              version: 3,
              settings: { typography: { fontFamilies: wordpressFamilies(families) } },
            },
            null,
            2,
          ),
        ),
        fileName: 'theme.json',
        language: 'json',
      };
    case 'fontaine':
      return {
        text: [
          `// Put ${singleLine(filesOf(input).join(', '))} into ./public/fonts/ and declare their @font-face rules in your CSS. In Nuxt, put the plugin under vite.plugins.`,
          "import { FontaineTransform } from 'fontaine';",
          "import { defineConfig } from 'vite';",
          '',
          'export default defineConfig({',
          '  plugins: [',
          '    FontaineTransform.vite({',
          '      fallbacks: {',
          families.map(fontaineEntry).join('\n'),
          '      },',
          `      resolvePath: (id) => new URL(\`./public\${id}\`, import.meta.url),`,
          '    }),',
          '  ],',
          '});',
        ].join('\n'),
        fileName: 'vite.config.ts',
        language: 'ts',
      };
    case 'preload':
      return {
        text: filesOf(input)
          .map(
            (fileName) =>
              `<link rel="preload" href="/fonts/${encodeURI(fileName)}" as="font" type="${mimeOf(fileName)}" crossorigin>`,
          )
          .join('\n'),
        fileName: 'preload.html',
        language: 'html',
      };
    case 'loading':
      return { text: input.loadingScript, fileName: 'font-loading.js', language: 'js' };
  }
}
