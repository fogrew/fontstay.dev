import { describe, expect, it } from 'vitest';
import { buildExport, EXPORT_FORMATS, type ExportFamily, type ExportInput } from './formats';

const inter: ExportFamily = {
  targetFamily: 'Inter',
  generic: 'sans-serif',
  families: ['"Inter"', '"Inter Fallback Arial"'],
  systemFonts: ['Arial'],
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
  systemFonts: ['Georgia', 'Times New Roman'],
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
    const cursive: ExportInput = { ...input, families: [{ ...inter, generic: 'cursive' }] };
    expect(buildExport('tailwind', mono).text).toContain('--font-mono:');
    expect(buildExport('tailwind', cursive).text).toContain('--font-cursive:');
  });

  it('appends the script rules to the variables export', () => {
    const rules = ':lang(th) {\n  font-family: "Tahoma", sans-serif;\n}';
    expect(buildExport('variables', { ...input, scriptRules: rules }).text.endsWith(rules)).toBe(
      true,
    );
    expect(buildExport('variables', input).text).not.toContain(':lang(');
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

  it('declares every weight and style of every family in the WordPress theme.json', () => {
    const json = JSON.parse(buildExport('wordpress', several).text);
    const [first, second] = json.settings.typography.fontFamilies;
    expect(first.slug).toBe('inter');
    expect(second.fontFamily).toBe('"Merriweather", "Merriweather Fallback Georgia", serif');
    expect(second.fontFace).toEqual([
      {
        fontFamily: 'Merriweather',
        fontWeight: '400',
        fontStyle: 'normal',
        src: ['file:./assets/fonts/Merriweather-Regular.woff2'],
      },
      {
        fontFamily: 'Merriweather',
        fontWeight: '700',
        fontStyle: 'normal',
        src: ['file:./assets/fonts/Merriweather-Bold.woff2'],
      },
      {
        fontFamily: 'Merriweather',
        fontWeight: '400',
        fontStyle: 'italic',
        src: ['file:./assets/fonts/Merriweather-Italic.woff2'],
      },
    ]);
  });

  it('gives unique slugs to families that collapse to the same one', () => {
    const twin: ExportFamily = { ...inter, targetFamily: 'INTER' };
    const json = JSON.parse(buildExport('wordpress', { ...input, families: [inter, twin] }).text);
    expect(
      json.settings.typography.fontFamilies.map((item: { slug: string }) => item.slug),
    ).toEqual(['inter', 'inter-2']);
  });

  it('encodes file names in the WordPress font sources', () => {
    const odd: ExportFamily = {
      ...inter,
      fonts: [{ fileName: 'My Font #2.woff2', weight: 400, style: 'normal' }],
    };
    const json = JSON.parse(buildExport('wordpress', { ...input, families: [odd] }).text);
    expect(json.settings.typography.fontFamilies[0].fontFace[0].src).toEqual([
      'file:./assets/fonts/My%20Font%20%232.woff2',
    ]);
  });

  it('falls back to Arial and a default file when a family has no data', () => {
    const bare: ExportFamily = { ...inter, systemFonts: [], fonts: [] };
    expect(buildExport('fontaine', { ...input, families: [bare] }).text).toContain("['Arial']");
    expect(buildExport('wordpress', { ...input, families: [bare] }).text).toContain(
      'file:./assets/fonts/font.woff2',
    );
  });

  it('gives Fontaine the system fonts of each family', () => {
    const { text } = buildExport('fontaine', several);
    expect(text).toContain("'Inter': ['Arial'],");
    expect(text).toContain("'Merriweather': ['Georgia', 'Times New Roman'],");
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

describe('hostile file names', () => {
  const withFile = (fileName: string): ExportInput => ({
    ...input,
    families: [{ ...inter, fonts: [{ fileName, weight: 400, style: 'normal' }] }],
  });

  it('keeps a file name that is an inherited property name out of the preload type', () => {
    const { text } = buildExport('preload', withFile('x.constructor'));
    expect(text).not.toContain('native code');
    expect(text).not.toContain('[object');
  });

  it('keeps a line break in the file name inside the Fontaine comment line', () => {
    const { text } = buildExport('fontaine', withFile('a\n});evil();//.woff2'));
    expect(text.split('\n').some((line) => line.startsWith('});evil'))).toBe(false);
  });

  it('keeps a line break in the file name inside the Next comment line', () => {
    const { text } = buildExport('next', withFile('a\n});evil();//.woff2'));
    expect(text.split('\n').some((line) => line.startsWith('});evil'))).toBe(false);
  });
});

describe('hostile family names', () => {
  it('keeps the WordPress theme.json valid JSON for control characters in names', () => {
    const name = ['x', '"});evil();//', String.fromCharCode(0x2028, 0x85)].join('\n');
    const hostile: ExportFamily = { ...inter, targetFamily: name };
    const { text } = buildExport('wordpress', { ...input, families: [hostile] });
    expect(JSON.parse(text).settings.typography.fontFamilies[0].name).toBe(name);
    expect(text).not.toMatch(/[\u0085\u2028]/);
  });

  it('cannot break out of the JavaScript string in the Nuxt, Astro and Fontaine exports', () => {
    const name = ['x', '});evil();//', String.fromCharCode(0x2028)].join('\n');
    const hostile: ExportFamily = { ...inter, targetFamily: name };
    for (const format of ['nuxt', 'astro', 'fontaine'] as const) {
      const { text } = buildExport(format, { ...input, families: [hostile] });
      expect(text.split('\n').some((line) => line.startsWith('});evil'))).toBe(false);
      expect(text).toContain('x\\u000a});evil();//\\u000a\\u2028');
    }
  });
});
