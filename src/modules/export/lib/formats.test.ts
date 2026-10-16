import { describe, expect, it } from 'vitest';
import { buildExport, EXPORT_FORMATS, type ExportFamily, type ExportInput } from './formats';

const inter: ExportFamily = {
  targetFamily: 'Inter',
  generic: 'sans-serif',
  families: ['"Inter"', '"Inter Fallback Arial"'],
  fonts: [{ fileName: 'Inter-Regular.woff2', weight: 400, style: 'normal' }],
};

const input: ExportInput = {
  families: [inter],
  fontFaces:
    '@font-face {\n  font-family: "Inter Fallback Arial";\n  src: local("Arial");\n  size-adjust: 107.1194%;\n}',
  strategy: 'font-size-adjust: 0.4877;\nline-height: 1.4;',
  css: 'CSS-TEXT',
  loadingScript: 'document.fonts.load("1em Inter");',
};

const merriweather: ExportFamily = {
  targetFamily: 'Merriweather',
  generic: 'serif',
  families: ['"Merriweather"', '"Merriweather Fallback Georgia"'],
  fonts: [
    { fileName: 'Merriweather-Regular.woff2', weight: 400, style: 'normal' },
    { fileName: 'Merriweather-Bold.woff2', weight: 700, style: 'normal' },
    { fileName: 'Merriweather-Italic.woff2', weight: 400, style: 'italic' },
  ],
};

const several: ExportInput = { ...input, families: [inter, merriweather] };

describe('buildExport', () => {
  it.each(EXPORT_FORMATS)('produces a stable %s export', (format) => {
    expect(buildExport(format, input)).toMatchSnapshot();
  });

  it.each(EXPORT_FORMATS)('produces a stable %s export for several families', (format) => {
    expect(buildExport(format, several)).toMatchSnapshot();
  });

  it('escapes quotes in names for the script formats', () => {
    const quoting: ExportInput = {
      ...input,
      families: [{ ...inter, families: ['"In\'ter"', '"A\'B"'] }],
    };
    expect(buildExport('next', quoting).text).toContain("'A\\'B'");
  });

  it('keeps the CSS export identical to the generator text', () => {
    expect(buildExport('css', input).text).toBe('CSS-TEXT');
  });

  it('maps the generic family to the Tailwind theme variable for a single family', () => {
    const serif: ExportInput = { ...input, families: [{ ...inter, generic: 'serif' }] };
    const mono: ExportInput = { ...input, families: [{ ...inter, generic: 'monospace' }] };
    expect(buildExport('tailwind', serif).text).toContain('--font-serif:');
    expect(buildExport('tailwind', mono).text).toContain('--font-mono:');
  });

  it('names the variables after the families when there are several', () => {
    expect(buildExport('tailwind', several).text).toContain('--font-inter:');
    expect(buildExport('tailwind', several).text).toContain('--font-merriweather:');
    expect(buildExport('variables', several).text).toContain('--font-merriweather:');
  });

  it('lists every weight and style of a family', () => {
    const next = buildExport('next', several).text;
    expect(next).toContain("weight: '700', style: 'normal'");
    expect(next).toContain("weight: '400', style: 'italic'");
    expect(buildExport('astro', several).text).toContain("weight: 700, style: 'normal'");
    expect(buildExport('nuxt', several).text).toContain("weight: 400, style: 'italic'");
  });

  it('chooses the preload type per file extension and preloads every file once', () => {
    const files: ExportInput = {
      ...input,
      families: [{ ...inter, fonts: [{ fileName: 'a.ttf', weight: 400, style: 'normal' }] }],
    };
    expect(buildExport('preload', files).text).toContain('type="font/ttf"');
    expect(buildExport('preload', several).text.split('\n')).toHaveLength(4);
  });
});

describe('hostile family names', () => {
  it('cannot break out of the JavaScript string in the Nuxt and Astro exports', () => {
    const name = ['x', '});evil();//', String.fromCharCode(0x2028)].join('\n');
    const hostile: ExportFamily = { ...inter, targetFamily: name };
    for (const format of ['nuxt', 'astro'] as const) {
      const { text } = buildExport(format, { ...input, families: [hostile] });
      expect(text.split('\n').some((line) => line.startsWith('});evil'))).toBe(false);
      expect(text).toContain('x\\u000a});evil();//\\u000a\\u2028');
    }
  });
});
