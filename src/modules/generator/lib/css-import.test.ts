import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  decodeDataUrl,
  MAX_FACES,
  parseFontFaces,
  parseGoogleFontsLinks,
  pickSource,
  safeHttpsUrl,
} from './css-import';

describe('parseFontFaces', () => {
  it('reads family, weight, style and sources', () => {
    const faces = parseFontFaces(`
      /* comment */
      @font-face {
        font-family: "Inter";
        font-style: italic;
        font-weight: 700;
        src: url(https://example.com/a.woff2) format("woff2"), url('/b.ttf') format('truetype');
        unicode-range: U+0000-00FF;
      }
    `);
    expect(faces).toEqual([
      {
        family: 'Inter',
        weight: '700',
        style: 'italic',
        sources: [
          { url: 'https://example.com/a.woff2', format: 'woff2' },
          { url: '/b.ttf', format: 'truetype' },
        ],
      },
    ]);
  });

  it('keeps semicolons inside data URLs', () => {
    const [face] = parseFontFaces(
      '@font-face{font-family:A;src:url(data:font/woff2;base64,AAAA) format(woff2);font-weight:400}',
    );
    expect(face?.sources[0]?.url).toBe('data:font/woff2;base64,AAAA');
    expect(face?.weight).toBe('400');
  });

  it('lets the last src declaration win', () => {
    const [face] = parseFontFaces(
      '@font-face{font-family:A;src:url(a.eot);src:url(a.eot?#iefix) format(embedded-opentype),url(b.woff2) format(woff2)}',
    );
    expect(face?.sources.map((source) => source.url)).toEqual(['a.eot?#iefix', 'b.woff2']);
  });

  it('skips faces without a family or a source', () => {
    expect(
      parseFontFaces('@font-face { src: url(a.woff2) } @font-face { font-family: A }'),
    ).toEqual([]);
  });

  it('is bounded', () => {
    const many = '@font-face{font-family:A;src:url(a.woff2)}'.repeat(MAX_FACES + 10);
    expect(parseFontFaces(many)).toHaveLength(MAX_FACES);
  });

  it('never throws on arbitrary text', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 500 }), (text) => {
        expect(() => parseFontFaces(text)).not.toThrow();
        expect(() => parseGoogleFontsLinks(text)).not.toThrow();
      }),
    );
  });

  it.each([
    ['unterminated comments', '/* '.repeat(130_000)],
    ['unterminated blocks', '@font-face{'.repeat(35_000)],
    ['unterminated urls', `@font-face{font-family:A;src:${'url('.repeat(100_000)}}`],
    ['unterminated quoted urls', `@font-face{font-family:A;src:${'url("'.repeat(80_000)}}`],
    ['spaced urls', `@font-face{font-family:A;src:${'url( '.repeat(80_000)}}`],
  ])('stays fast on %s', (_name, input) => {
    const started = performance.now();
    parseFontFaces(input);
    parseGoogleFontsLinks(input);
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('decodeDataUrl', () => {
  it('decodes base64 font data URLs', () => {
    const font = decodeDataUrl('data:font/woff2;base64,AAECAw==');
    expect([...new Uint8Array(font?.bytes ?? new ArrayBuffer(0))]).toEqual([0, 1, 2, 3]);
    expect(font?.mime).toBe('font/woff2');
  });

  it.each([
    'data:text/html;base64,AAAA',
    'data:font/woff2,AAAA',
    'https://example.com/a.woff2',
    'data:font/woff2;base64,***',
  ])('rejects %s', (url) => {
    expect(decodeDataUrl(url)).toBeNull();
  });
});

describe('safeHttpsUrl', () => {
  it('only accepts absolute https URLs without credentials', () => {
    expect(safeHttpsUrl('https://example.com/a.woff2')?.hostname).toBe('example.com');
    expect(safeHttpsUrl('http://example.com/a.woff2')).toBeNull();
    expect(safeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(safeHttpsUrl('/relative.woff2')).toBeNull();
    expect(safeHttpsUrl('https://user:pass@example.com/a.woff2')).toBeNull();
    expect(safeHttpsUrl('data:font/woff2;base64,AAAA')).toBeNull();
  });
});

describe('pickSource', () => {
  const face = (...urls: string[]) => ({
    family: 'A',
    weight: '400',
    style: 'normal',
    sources: urls.map((url) => ({ url, format: null })),
  });

  it('prefers an embedded font over a link, wherever it is listed', () => {
    expect(
      pickSource(face('https://example.com/a.woff2', 'data:font/woff2;base64,AAAA')).kind,
    ).toBe('data');
  });

  it('falls back to a link and then to nothing', () => {
    expect(pickSource(face('https://example.com/a.woff2')).kind).toBe('link');
    expect(pickSource(face('javascript:alert(1)', '/relative.woff2')).kind).toBe('none');
  });
});

describe('parseGoogleFontsLinks', () => {
  it('lists the families of css and css2 links', () => {
    const html =
      '<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;700&amp;family=Roboto&display=swap" rel="stylesheet">' +
      '@import url("https://fonts.googleapis.com/css?family=Lato:400,700");';
    expect(parseGoogleFontsLinks(html)).toEqual([
      { name: 'Open Sans', styles: 'wght@400;700' },
      { name: 'Roboto', styles: '' },
      { name: 'Lato', styles: '400,700' },
    ]);
  });

  it('ignores other hosts', () => {
    expect(parseGoogleFontsLinks('https://evil.example/css2?family=Inter')).toEqual([]);
  });
});
