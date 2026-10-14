import { describe, expect, it } from 'vitest';
import { FontSourceError } from './download';
import { decodeCatalog, downloadFont, fileUrl } from './fontsource';

const [aileron] = decodeCatalog({
  categories: ['Sans Serif', 'Other'],
  families: [['aileron', 'Aileron', 0, ['latin'], ['400', '400i']]],
});

describe('fileUrl', () => {
  it('builds the jsDelivr path of a style', () => {
    expect(fileUrl('aileron', '400', 'latin')).toBe(
      'https://cdn.jsdelivr.net/fontsource/fonts/aileron@latest/latin-400-normal.woff2',
    );
    expect(fileUrl('aileron', '700i', 'latin')).toContain('latin-700-italic.woff2');
  });

  it('rejects ids and subsets that could change the path', () => {
    expect(fileUrl('../x', '400', 'latin')).toBeNull();
    expect(fileUrl('a/b', '400', 'latin')).toBeNull();
    expect(fileUrl('aileron', '400', '../latin')).toBeNull();
    expect(fileUrl('aileron@1', '400', 'latin')).toBeNull();
  });
});

describe('downloadFont', () => {
  it('downloads one file with a safe name', async () => {
    const file = await downloadFont(
      aileron as NonNullable<typeof aileron>,
      '400',
      'latin',
      async (url) => {
        expect(url).toBe(fileUrl('aileron', '400', 'latin'));
        return new Response(new Uint8Array([1, 2, 3]));
      },
    );
    expect(file.name).toBe('Aileron-400-latin.woff2');
    expect(file.size).toBe(3);
  });

  it('turns failures and oversize files into typed errors', async () => {
    const family = aileron as NonNullable<typeof aileron>;
    await expect(
      downloadFont(family, '400', 'latin', async () => new Response('', { status: 404 })),
    ).rejects.toBeInstanceOf(FontSourceError);
    await expect(
      downloadFont(
        family,
        '400',
        'latin',
        async () => new Response('x', { headers: { 'content-length': String(50 * 1024 * 1024) } }),
      ),
    ).rejects.toMatchObject({ code: 'too-large' });
    await expect(
      downloadFont({ ...family, id: '../evil' }, '400', 'latin', async () => new Response('x')),
    ).rejects.toMatchObject({ code: 'bad-file' });
  });
});
