import { describe, expect, it } from 'vitest';
import {
  cssUrl,
  decodeCatalog,
  downloadFont,
  GoogleFontsError,
  isFileUrl,
  parseGoogleCss,
  parseStyle,
  searchFamilies,
} from './google-fonts';

const families = decodeCatalog({
  categories: ['Sans Serif', 'Serif', 'Monospace'],
  families: [
    ['Open Sans', 0, ['latin', 'cyrillic'], ['400', '700', '400i'], ['wght']],
    ['Lora', 1, ['latin'], ['400'], []],
    ['Fira Code', 2, ['latin'], ['400'], ['wght']],
  ],
});

const CSS = `/* cyrillic */
@font-face {
  font-family: 'Open Sans';
  src: url(https://fonts.gstatic.com/s/opensans/v1/cyr.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F;
}
/* latin */
@font-face {
  font-family: 'Open Sans';
  src: url(https://fonts.gstatic.com/s/opensans/v1/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`;

function fakeFetch(map: Record<string, Response>) {
  return async (url: string) => {
    const response = map[url];
    if (!response) throw new Error(`unexpected ${url}`);
    return response;
  };
}

describe('catalog search', () => {
  it('matches names case-insensitively and filters by category', () => {
    expect(searchFamilies(families, 'open').map((item) => item.name)).toEqual(['Open Sans']);
    expect(searchFamilies(families, '', 'Serif').map((item) => item.name)).toEqual(['Lora']);
    expect(searchFamilies(families, '').length).toBe(3);
    expect(searchFamilies(families, '', '', 2)).toHaveLength(2);
  });
});

describe('cssUrl and parseStyle', () => {
  it('builds the css2 URL for a style', () => {
    expect(cssUrl('Open Sans', '700')).toBe(
      'https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,700&display=swap',
    );
    expect(cssUrl('Lora', '400i')).toContain('ital,wght@1,400');
    expect(parseStyle('400i')).toEqual({ weight: 400, italic: true });
    expect(parseStyle('nonsense')).toEqual({ weight: 400, italic: false });
  });
});

describe('parseGoogleCss', () => {
  it('pairs each subset comment with its font file', () => {
    expect(parseGoogleCss(CSS)).toEqual([
      { subset: 'cyrillic', url: 'https://fonts.gstatic.com/s/opensans/v1/cyr.woff2' },
      { subset: 'latin', url: 'https://fonts.gstatic.com/s/opensans/v1/latin.woff2' },
    ]);
  });

  it('is bounded on hostile text', () => {
    const started = performance.now();
    parseGoogleCss('/* '.repeat(200_000));
    parseGoogleCss('/* a */ @font-face {'.repeat(50_000));
    expect(performance.now() - started).toBeLessThan(500);
  });
});

describe('isFileUrl', () => {
  it('only accepts gstatic over https', () => {
    expect(isFileUrl('https://fonts.gstatic.com/s/a.woff2')).toBe(true);
    expect(isFileUrl('http://fonts.gstatic.com/s/a.woff2')).toBe(false);
    expect(isFileUrl('https://fonts.gstatic.com.evil.example/a.woff2')).toBe(false);
    expect(isFileUrl('https://user@fonts.gstatic.com/a.woff2')).toBe(false);
    expect(isFileUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('downloadFont', () => {
  const cssResponse = () => new Response(CSS);
  const font = () => new Response(new Uint8Array([1, 2, 3]));

  it('downloads the file of the chosen subset', async () => {
    const file = await downloadFont(
      'Open Sans',
      '400',
      'latin',
      fakeFetch({
        [cssUrl('Open Sans', '400')]: cssResponse(),
        'https://fonts.gstatic.com/s/opensans/v1/latin.woff2': font(),
      }),
    );
    expect(file.name).toBe('Open-Sans-400-latin.woff2');
    expect(file.size).toBe(3);
  });

  it('reports a missing subset', async () => {
    await expect(
      downloadFont(
        'Open Sans',
        '400',
        'greek',
        fakeFetch({ [cssUrl('Open Sans', '400')]: cssResponse() }),
      ),
    ).rejects.toMatchObject({ code: 'no-subset' });
  });

  it('refuses files outside gstatic', async () => {
    const evil = CSS.replaceAll('fonts.gstatic.com', 'evil.example');
    await expect(
      downloadFont(
        'Open Sans',
        '400',
        'latin',
        fakeFetch({ [cssUrl('Open Sans', '400')]: new Response(evil) }),
      ),
    ).rejects.toMatchObject({ code: 'bad-file' });
  });

  it('turns network failures and oversize files into typed errors', async () => {
    await expect(
      downloadFont('Open Sans', '400', 'latin', async () => {
        throw new Error('offline');
      }),
    ).rejects.toBeInstanceOf(GoogleFontsError);
    await expect(
      downloadFont(
        'Open Sans',
        '400',
        'latin',
        fakeFetch({
          [cssUrl('Open Sans', '400')]: cssResponse(),
          'https://fonts.gstatic.com/s/opensans/v1/latin.woff2': new Response('x', {
            headers: { 'content-length': String(50 * 1024 * 1024) },
          }),
        }),
      ),
    ).rejects.toMatchObject({ code: 'too-large' });
  });
});
