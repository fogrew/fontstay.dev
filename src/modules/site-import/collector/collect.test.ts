import { describe, expect, it, vi } from 'vitest';
import { fontstayCollect } from './collect.js';

interface FaceInit {
  family: string;
  src: string;
  weight?: string;
  range?: string;
}

const faceRule = ({ family, src, weight = '400', range = '' }: FaceInit) => ({
  type: 5,
  style: {
    getPropertyValue: (name: string) =>
      ({
        'font-family': family,
        src,
        'font-weight': weight,
        'font-style': 'normal',
        'unicode-range': range,
      })[name] ?? '',
  },
});

const encode = (text: string) => new TextEncoder().encode(text).buffer;

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
    querySelectorAll: () => [],
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
  it('leaves out a rule whose unicode-range is over 1500 characters', async () => {
    const range = Array.from(
      { length: 400 },
      (_, index) => `U+${(index + 4096).toString(16)}`,
    ).join(', ');
    const { result } = await collect([
      faceRule({ family: 'Cjk', src: 'url(/c.woff2)', range }),
      faceRule({ family: 'Cjk', src: 'url(/d.woff2)', range: 'U+20-7E' }),
    ]);
    expect(result.rules).toEqual([expect.objectContaining({ unicodeRange: 'U+20-7E' })]);
  });

  it('reports every @font-face rule with its unicode-range, capped at 256', async () => {
    const rules = Array.from({ length: 300 }, (_, index) =>
      faceRule({ family: 'Split', src: `url(/f${index}.woff2)`, range: `U+${index.toString(16)}` }),
    );
    const { result } = await collect(rules);
    const reported = result.rules as { family: string; unicodeRange: string }[];
    expect(reported).toHaveLength(256);
    expect(reported[3]).toMatchObject({ family: 'Split', unicodeRange: 'U+3', weight: '400' });
    expect(result.faces).toHaveLength(1);
  });

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

  it('reads the faces of an @import that is readable, and fetches the one that is not', async () => {
    const readable = {
      type: 3,
      href: 'inner.css',
      styleSheet: {
        href: 'https://site.test/inner.css',
        cssRules: [faceRule({ family: 'Inner', src: 'url(/i.woff2)' })],
      },
    };
    const blocked = {
      type: 3,
      href: 'https://fonts.test/css',
      get styleSheet(): never {
        throw new Error('cross-origin');
      },
    };
    const { result, fetch } = await collect([readable, blocked], async (url) =>
      url === 'https://fonts.test/css'
        ? {
            ok: true,
            headers: { get: () => null },
            arrayBuffer: async () =>
              encode(
                '/* c */ @font-face { font-family: "Remote"; font-weight: 700; src: url(https://fonts.test/r.woff2) format("woff2"); }',
              ),
          }
        : {
            ok: true,
            headers: { get: () => null },
            arrayBuffer: async () => new Uint8Array([1]).buffer,
          },
    );
    expect(result.faces).toEqual([
      expect.objectContaining({ family: 'Inner', url: 'https://site.test/i.woff2' }),
      expect.objectContaining({ family: 'Remote', weight: 700, url: 'https://fonts.test/r.woff2' }),
    ]);
    expect(fetch).toHaveBeenCalledWith('https://fonts.test/css', expect.anything());
  });

  it('reads a cross-origin stylesheet through fetch and follows its @import once', async () => {
    const { win, doc } = page([]);
    doc.styleSheets.push({
      href: 'https://cdn.test/x.css',
      get cssRules(): never {
        throw new Error('cross-origin');
      },
    } as never);
    const sheets: Record<string, string> = {
      'https://cdn.test/x.css':
        '@import url("more.css"); @font-face { font-family: A; src: url(a.woff2); }',
      'https://cdn.test/more.css': '@font-face { font-family: B; src: url(b.woff2); }',
    };
    win.fetch.mockImplementation(async (url: string) => ({
      ok: true,
      headers: { get: () => null },
      arrayBuffer: async () =>
        url in sheets ? encode(sheets[url] ?? '') : new Uint8Array([1]).buffer,
    }));
    const result = await fontstayCollect(win, doc);
    expect((result.faces as { family: string }[]).map((face) => face.family)).toEqual(['A', 'B']);
  });

  it('reports the fonts used by the body, headings and the first button', async () => {
    const { win, doc } = page([]);
    const present = new Set(['body', 'h1', 'button']);
    doc.querySelector = ((selector: string) =>
      present.has(selector) ? { selector } : null) as never;
    win.getComputedStyle = ((element: { selector: string }) => ({
      fontFamily: element.selector === 'button' ? '"Btn Sans", sans-serif' : 'Inter, sans-serif',
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: element.selector === 'h1' ? '700' : '400',
    })) as never;
    const result = await fontstayCollect(win, doc);
    expect(result.used).toEqual([
      { role: 'body', family: 'Inter, sans-serif', size: 16, weight: 400, lineHeight: 1.5 },
      { role: 'h1', family: 'Inter, sans-serif', size: 16, weight: 700, lineHeight: 1.5 },
      { role: 'button', family: '"Btn Sans", sans-serif', size: 16, weight: 400, lineHeight: 1.5 },
    ]);
  });

  it('omits the line height when the page reports "normal"', async () => {
    const { win, doc } = page([]);
    doc.querySelector = ((selector: string) => (selector === 'body' ? {} : null)) as never;
    win.getComputedStyle = (() => ({
      fontFamily: 'Inter',
      fontSize: '16px',
      lineHeight: 'normal',
      fontWeight: '400',
    })) as never;
    const result = await fontstayCollect(win, doc);
    expect(result.used).toEqual([{ role: 'body', family: 'Inter', size: 16, weight: 400 }]);
  });

  it('keeps the Latin subset of a family split by unicode-range', async () => {
    const face = (range: string, file: string) => ({
      type: 5,
      style: {
        getPropertyValue: (name: string) =>
          ({
            'font-family': 'Split',
            src: `url(/${file}.woff2) format("woff2")`,
            'font-weight': '400',
            'font-style': 'normal',
            'unicode-range': range,
          })[name] ?? '',
      },
    });
    const { result } = await collect([
      face('U+0400-045F, U+0490-0491', 'cyrillic'),
      face('U+0100-02BA, U+1E00-1EFF', 'latin-ext'),
      face('U+0000-00FF, U+0131', 'latin'),
      face('U+4??', 'wild'),
    ]);
    expect(result.faces).toEqual([
      expect.objectContaining({ url: 'https://site.test/latin.woff2' }),
    ]);
  });

  it('stops reading a file that has no content-length once it exceeds the limit', async () => {
    const chunk = new Uint8Array(4 * 1024 * 1024);
    let reads = 0;
    const cancel = vi.fn(async () => undefined);
    const { result } = await collect(
      [faceRule({ family: 'Big', src: 'url(/big.woff2) format("woff2")' })],
      async () => ({
        ok: true,
        headers: { get: () => null },
        body: {
          getReader: () => ({
            read: async () => (++reads > 100 ? { done: true } : { done: false, value: chunk }),
            cancel,
          }),
        },
      }),
    );
    expect(result.files).toEqual([]);
    expect(reads).toBeLessThan(5);
    expect(cancel).toHaveBeenCalled();
  });

  it('reads a streamed file that fits', async () => {
    const { result } = await collect(
      [faceRule({ family: 'Small', src: 'url(/s.woff2) format("woff2")' })],
      async () => {
        const parts = [new Uint8Array([1, 2]), new Uint8Array([3])];
        return {
          ok: true,
          headers: { get: () => null },
          body: {
            getReader: () => ({
              read: async () =>
                parts.length ? { done: false, value: parts.shift() } : { done: true },
              cancel: async () => undefined,
            }),
          },
        };
      },
    );
    expect((result.files as { bytes: ArrayBuffer }[])[0]?.bytes.byteLength).toBe(3);
  });

  it('shares one byte budget between the files read in parallel', async () => {
    const rules = Array.from({ length: 8 }, (_, index) =>
      faceRule({ family: `F${index}`, src: `url(/f${index}.woff2) format("woff2")` }),
    );
    const { result } = await collect(rules, async () => {
      let sent = 0;
      return {
        ok: true,
        headers: { get: () => null },
        body: {
          getReader: () => ({
            read: async () =>
              sent++ < 5 ? { done: false, value: new Uint8Array(1024 * 1024) } : { done: true },
            cancel: async () => undefined,
          }),
        },
      };
    });
    expect((result.files as unknown[]).length).toBeLessThan(8);
  });

  describe('page boxes', () => {
    interface Init {
      tag: string;
      text: string;
      left?: number;
      width?: number;
      style?: Record<string, string>;
      nested?: boolean;
      chrome?: boolean;
    }
    const element = (init: Init) => ({
      tagName: init.tag.toUpperCase(),
      textContent: init.text,
      querySelector: () => (init.nested ? {} : null),
      closest: () => (init.chrome ? {} : null),
      getBoundingClientRect: () => ({
        left: init.left ?? 0,
        width: init.width ?? 600,
        height: 24,
      }),
      style: init.style ?? {},
    });
    const blocksOf = async (elements: ReturnType<typeof element>[]) => {
      const { win, doc } = page([]);
      Object.assign(doc, { querySelectorAll: () => elements });
      const computed = (target: { style?: Record<string, string> }) =>
        ({
          fontSize: '16px',
          lineHeight: '24px',
          marginTop: '0px',
          marginBottom: '12px',
          paddingLeft: '0px',
          paddingRight: '0px',
          paddingTop: '0px',
          paddingBottom: '0px',
          ...target.style,
        }) as never;
      Object.assign(win, { getComputedStyle: computed });
      const result = (await fontstayCollect(win, doc)) as { blocks: Record<string, unknown>[] };
      return result.blocks;
    };

    it('reports tag, text, size, box width and spacing relative to the leftmost box', async () => {
      const blocks = await blocksOf([
        element({
          tag: 'h1',
          text: '  Big   title ',
          left: 100,
          width: 500,
          style: { fontSize: '32px', lineHeight: '48px' },
        }),
        element({
          tag: 'p',
          text: 'Body',
          left: 120,
          width: 480,
          style: {
            paddingLeft: '4px',
            paddingRight: '8px',
            borderLeftWidth: '1px',
            borderRightWidth: '1px',
          },
        }),
      ]);
      expect(blocks[0]).toMatchObject({
        tag: 'h1',
        text: 'Big title',
        fontPx: 32,
        width: 500,
        indent: 0,
        marginBottom: 12,
        lineHeight: 1.5,
      });
      expect(blocks[1]).toMatchObject({ tag: 'p', text: 'Body', indent: 20, padX: 7 });
    });

    it('skips hidden, empty, fixed, invisible, container and navigation elements and caps the count', async () => {
      const blocks = await blocksOf([
        element({ tag: 'p', text: 'hidden', width: 0 }),
        element({ tag: 'p', text: '   ' }),
        element({ tag: 'p', text: 'fixed', style: { position: 'fixed' } }),
        element({ tag: 'p', text: 'invisible', style: { visibility: 'hidden' } }),
        element({ tag: 'li', text: 'wrapper', nested: true }),
        element({ tag: 'li', text: 'menu item', chrome: true }),
        ...Array.from({ length: 100 }, (_, index) => element({ tag: 'p', text: `line ${index}` })),
      ]);
      expect(blocks).toHaveLength(60);
      expect(blocks[0]).toMatchObject({ text: 'line 0' });
    });

    it('truncates long text and omits a line height that is not a number', async () => {
      const [block] = await blocksOf([
        element({ tag: 'p', text: 'x'.repeat(2000), style: { lineHeight: 'normal' } }),
      ]);
      expect(String(block?.text)).toHaveLength(400);
      expect(block).not.toHaveProperty('lineHeight');
    });
  });
});
