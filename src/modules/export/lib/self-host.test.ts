import { describe, expect, it } from 'vitest';
import { CssExportError } from './model';
import { selfHostFontFaces } from './self-host';
import { buildSelfHostArchive, licenseFile, licenseKind } from './self-host-archive';

const roboto = {
  family: 'Roboto',
  fileName: 'Roboto-400-latin.woff2',
  weight: 400,
  style: 'normal',
} as const;

describe('selfHostFontFaces', () => {
  it('emits one rule per file with a local url and format', () => {
    expect(
      selfHostFontFaces([
        roboto,
        { ...roboto, fileName: 'Roboto-700i-latin.woff2', weight: 700, style: 'italic' },
      ]),
    ).toMatchInlineSnapshot(`
      "@font-face {
        font-family: "Roboto";
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url("/fonts/Roboto-400-latin.woff2") format("woff2");
      }

      @font-face {
        font-family: "Roboto";
        font-style: italic;
        font-weight: 700;
        font-display: swap;
        src: url("/fonts/Roboto-700i-latin.woff2") format("woff2");
      }"
    `);
  });

  it('removes duplicates and honours the base path', () => {
    const css = selfHostFontFaces([roboto, roboto], 'assets/f');
    expect(css.match(/@font-face/g)).toHaveLength(1);
    expect(css).toContain('url("assets/f/Roboto-400-latin.woff2")');
  });

  it('is empty for no fonts', () => {
    expect(selfHostFontFaces([])).toBe('');
  });

  it('escapes hostile family and file names', () => {
    const css = selfHostFontFaces([{ ...roboto, family: '</style>"x', fileName: 'a") b.woff2' }]);
    expect(css).not.toContain('</style>');
    expect(css).toContain('url("/fonts/a%22)%20b.woff2")');
  });

  it('rejects invalid weights, names and base paths', () => {
    expect(() => selfHostFontFaces([{ ...roboto, weight: 0 }])).toThrow(CssExportError);
    expect(() => selfHostFontFaces([{ ...roboto, fileName: 'a\nb.woff2' }])).toThrow(
      CssExportError,
    );
    expect(() => selfHostFontFaces([roboto], '/x");}body{')).toThrow(CssExportError);
  });
});

describe('license files', () => {
  it('recognises licenses by text and url', () => {
    expect(
      licenseKind('This Font Software is licensed under the SIL Open Font License', null),
    ).toBe('ofl');
    expect(licenseKind(null, 'https://scripts.sil.org/OFL')).toBe('ofl');
    expect(licenseKind(null, 'https://www.apache.org/licenses/LICENSE-2.0')).toBe('apache');
    expect(licenseKind('Ubuntu Font Licence 1.0', null)).toBe('ubuntu');
    expect(licenseKind('Proprietary', null)).toBeNull();
  });

  it('puts the embedded copyright before the license text', () => {
    const text = licenseFile('Roboto', [
      {
        ...roboto,
        bytes: new Uint8Array(),
        copyright: 'Copyright 2011 Google',
        license: 'OFL',
        licenseUrl: null,
      },
    ]);
    expect(text.startsWith('Roboto\n\nCopyright 2011 Google\n\nOFL')).toBe(true);
    expect(text).toContain('SIL OPEN FONT LICENSE');
  });

  it('states when a license is not recognised', () => {
    const text = licenseFile('X', [
      { ...roboto, bytes: new Uint8Array(), copyright: null, license: null, licenseUrl: null },
    ]);
    expect(text).toContain('not recognised');
  });
});

describe('buildSelfHostArchive', () => {
  it('contains font files, one license per family, css and readme', () => {
    const zip = buildSelfHostArchive([
      {
        ...roboto,
        bytes: new Uint8Array([1, 2, 3]),
        copyright: 'c',
        license: 'OFL',
        licenseUrl: null,
      },
      {
        ...roboto,
        fileName: 'Roboto-700-latin.woff2',
        weight: 700,
        bytes: new Uint8Array([4]),
        copyright: 'c',
        license: 'OFL',
        licenseUrl: null,
      },
      {
        family: 'Lora',
        fileName: 'Lora-400-latin.woff2',
        weight: 400,
        style: 'normal',
        bytes: new Uint8Array([5]),
        copyright: null,
        license: null,
        licenseUrl: null,
      },
    ]);
    const text = new TextDecoder('latin1').decode(zip);
    for (const name of [
      'fonts/Roboto-400-latin.woff2',
      'fonts/Roboto-700-latin.woff2',
      'fonts/Lora-400-latin.woff2',
      'licenses/roboto.txt',
      'licenses/lora.txt',
      'fonts.css',
      'README.txt',
    ])
      expect(text).toContain(name);
  });
});
