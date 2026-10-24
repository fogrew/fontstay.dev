import { describe, expect, it, vi } from 'vitest';
import { fontstayCollect } from './collect.js';

interface FaceInit {
  family: string;
  src: string;
  weight?: string;
}

const faceRule = ({ family, src, weight = '400' }: FaceInit) => ({
  type: 5,
  style: {
    getPropertyValue: (name: string) =>
      ({ 'font-family': family, src, 'font-weight': weight, 'font-style': 'normal' })[name] ?? '',
  },
});

function page(rules: unknown[], fetchFile?: (url: string) => Promise<unknown>) {
  const fetch = vi.fn(
    fetchFile ??
      (async () => ({
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
  );
  const doc = {
    title: 'Demo',
    baseURI: 'https://site.test/',
    styleSheets: [{ href: 'https://site.test/a.css', cssRules: rules }],
    querySelector: () => null,
    body: { querySelectorAll: () => [] },
  };
  const win = {
    location: { origin: 'https://site.test' },
    getComputedStyle: () => ({}),
    fetch,
  };
  return { win, doc, fetch };
}

const collect = (rules: unknown[], fetchFile?: (url: string) => Promise<unknown>) => {
  const { win, doc, fetch } = page(rules, fetchFile);
  return fontstayCollect(win, doc).then((result: Record<string, unknown>) => ({ result, fetch }));
};

describe('fontstayCollect', () => {
  it('picks the best format and ignores insecure sources', async () => {
    const { result } = await collect([
      faceRule({
        family: 'Demo',
        src: 'url(http://site.test/a.woff2) format("woff2"), url(/b.ttf) format("truetype"), url(/b.woff2) format("woff2")',
      }),
    ]);
    expect(result.faces).toEqual([
      expect.objectContaining({ family: 'Demo', url: 'https://site.test/b.woff2' }),
    ]);
  });

  it('treats a format named like an inherited property as unknown', async () => {
    const { result } = await collect([
      faceRule({
        family: 'Demo',
        src: 'url(/a.x) format("constructor"), url(/b.y) format("__proto__")',
      }),
    ]);
    expect(result.faces).toEqual([expect.objectContaining({ url: 'https://site.test/a.x' })]);
  });

  it('survives a stylesheet whose rules cannot be read', async () => {
    const { win, doc } = page([]);
    doc.styleSheets.push({
      href: 'https://cdn.test/x.css',
      get cssRules(): never {
        throw new Error('cross-origin');
      },
    } as never);
    const result = await fontstayCollect(win, doc);
    expect(result.faces).toEqual([]);
  });

  it('downloads at most eight distinct files', async () => {
    const rules = Array.from({ length: 12 }, (_, index) =>
      faceRule({ family: `Font ${index}`, src: `url(/f${index}.woff2) format("woff2")` }),
    );
    const { result, fetch } = await collect(rules);
    expect(fetch).toHaveBeenCalledTimes(8);
    expect(result.files).toHaveLength(8);
  });

  it('skips files that announce a size above the limit or arrive empty', async () => {
    const { result } = await collect(
      [
        faceRule({ family: 'Big', src: 'url(/big.woff2) format("woff2")' }),
        faceRule({ family: 'Empty', src: 'url(/empty.woff2) format("woff2")' }),
        faceRule({ family: 'Small', src: 'url(/small.woff2) format("woff2")' }),
      ],
      async (url) => ({
        ok: true,
        headers: { get: () => (url.endsWith('big.woff2') ? '99999999' : null) },
        arrayBuffer: async () => new Uint8Array(url.endsWith('empty.woff2') ? 0 : 4).buffer,
      }),
    );
    expect((result.files as { name: string }[]).map((file) => file.name)).toEqual(['small.woff2']);
  });
});
