import { describe, expect, it } from 'vitest';
import { buildExport, EXPORT_FORMATS, type ExportInput } from './formats';

const input: ExportInput = {
  targetFamily: 'Inter',
  generic: 'sans-serif',
  fontFaces:
    '@font-face {\n  font-family: "Inter Fallback Arial";\n  src: local("Arial");\n  size-adjust: 107.1194%;\n}',
  families: ['"Inter"', '"Inter Fallback Arial"'],
  strategy: 'font-size-adjust: 0.4877;\nline-height: 1.4;',
  css: 'CSS-TEXT',
  loadingScript: 'document.fonts.load("1em Inter");',
  fileName: 'Inter-Regular.woff2',
};

describe('buildExport', () => {
  it.each(EXPORT_FORMATS)('produces a stable %s export', (format) => {
    expect(buildExport(format, input)).toMatchSnapshot();
  });

  it('escapes quotes in names for the script formats', () => {
    const text = buildExport('next', { ...input, families: ['"In\'ter"', '"A\'B"'] }).text;
    expect(text).toContain("'A\\'B'");
  });

  it('keeps the CSS export identical to the generator text', () => {
    expect(buildExport('css', input).text).toBe('CSS-TEXT');
  });

  it('maps the generic family to the Tailwind theme variable', () => {
    expect(buildExport('tailwind', { ...input, generic: 'serif' }).text).toContain('--font-serif:');
    expect(buildExport('tailwind', { ...input, generic: 'monospace' }).text).toContain(
      '--font-mono:',
    );
  });

  it('chooses the preload type from the file extension', () => {
    expect(buildExport('preload', { ...input, fileName: 'a.ttf' }).text).toContain(
      'type="font/ttf"',
    );
  });
});
