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
        skipped: 0,
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

  it('keeps the Latin subset of a Google Fonts stylesheet', () => {
    const subsets: [string, string][] = [
      ['cyrillic-ext', 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F'],
      ['cyrillic', 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'],
      ['greek', 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF'],
      ['vietnamese', 'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1'],
      ['latin-ext', 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF'],
      ['latin', 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC'],
    ];
    const css = subsets
      .map(
        ([name, range]) =>
          `/* ${name} */@font-face{font-family:'Inter';font-style:normal;font-weight:400;src:url(https://fonts.gstatic.com/${name}.woff2) format('woff2');unicode-range:${range};}`,
      )
      .join('\n');
    const faces = parseFontFaces(css);
    expect(faces).toHaveLength(1);
    expect(faces[0]?.sources[0]?.url).toBe('https://fonts.gstatic.com/latin.woff2');
    expect(faces[0]?.skipped).toBe(5);
  });

  it('understands wildcard ranges and keeps the first face when none covers Latin', () => {
    const [wild] = parseFontFaces(
      '@font-face{font-family:A;src:url(x.woff2);unicode-range:U+4??}@font-face{font-family:A;src:url(y.woff2);unicode-range:U+0-7F}',
    );
    expect(wild?.sources[0]?.url).toBe('y.woff2');
    const [none] = parseFontFaces(
      '@font-face{font-family:A;src:url(x.woff2);unicode-range:U+0400-045F}@font-face{font-family:A;src:url(y.woff2);unicode-range:U+0370-03FF}',
    );
    expect(none?.sources[0]?.url).toBe('x.woff2');
    expect(none?.skipped).toBe(1);
  });

  it('groups faces without unicode-range by family, weight and style only', () => {
    const faces = parseFontFaces(
      '@font-face{font-family:A;font-weight:400;src:url(a.woff2)}@font-face{font-family:a;font-weight:400;src:url(b.woff2)}@font-face{font-family:A;font-weight:700;src:url(c.woff2)}',
    );
    expect(faces.map((face) => [face.weight, face.skipped])).toEqual([
      ['400', 1],
      ['700', 0],
    ]);
    expect(faces[0]?.sources[0]?.url).toBe('a.woff2');
  });

  it('keeps a Latin face seen first and counts later subsets', () => {
    const [face] = parseFontFaces(
      '@font-face{font-family:A;src:url(x.woff2);unicode-range:U+0000-00FF}@font-face{font-family:A;src:url(y.woff2);unicode-range:U+0400-045F}',
    );
    expect(face?.sources[0]?.url).toBe('x.woff2');
    expect(face?.skipped).toBe(1);
  });

  it('treats equivalent weight and style spellings as one group', () => {
    const faces = parseFontFaces(
      '@font-face{font-family:A;src:url(a.woff2);unicode-range:U+0400-045F}@font-face{font-family:A;font-weight:400;src:url(b.woff2)}@font-face{font-family:A;font-weight:bold;src:url(c.woff2)}@font-face{font-family:A;font-weight:700;src:url(d.woff2)}@font-face{font-family:A;font-style:oblique 10deg;src:url(e.woff2)}@font-face{font-family:A;font-style:italic;src:url(f.woff2)}',
    );
    expect(faces.map((face) => face.skipped)).toEqual([1, 1, 1]);
  });

  it('is bounded', () => {
    const many = Array.from(
      { length: MAX_FACES + 10 },
      (_, weight) => `@font-face{font-family:A;font-weight:${weight};src:url(a.woff2)}`,
    ).join('');
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
    skipped: 0,
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
