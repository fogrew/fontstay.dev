import { describe, expect, it } from 'vitest';
import { directImport } from './direct-fetch';
import { isPrivateHost, mergeFaces, parsePublicUrl, scanCss, scanPage } from './scan';

const FONT = new Uint8Array([0, 1, 0, 0, 1, 2, 3, 4]);

function site(files: Record<string, { body: string | Uint8Array; type?: string }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const file = files[url];
    if (!file) throw new TypeError('blocked by CORS');
    const response = new Response(file.body as BodyInit, {
      headers: { 'content-type': file.type ?? 'text/html' },
    });
    Object.defineProperty(response, 'url', { value: url });
    return response;
  }) as typeof fetch;
}

describe('parsePublicUrl', () => {
  it('accepts https hosts and adds the scheme when missing', () => {
    expect(parsePublicUrl('https://example.com/a')?.href).toBe('https://example.com/a');
    expect(parsePublicUrl('example.com')?.href).toBe('https://example.com/');
  });

  it.each([
    'http://example.com',
    'javascript:alert(1)',
    'https://user:pass@example.com',
    'https://example.com:8443',
    'https://exa mple.com',
    '',
  ])('rejects %s', (raw) => {
    expect(parsePublicUrl(raw)).toBeNull();
  });
});

describe('isPrivateHost', () => {
  it.each([
    'localhost',
    'app.localhost',
    '127.0.0.1',
    '10.0.0.5',
    '2130706433',
    '[::1]',
    'printer.local',
    'wiki.internal',
    'intranet',
    'localhost.',
  ])('blocks %s', (host) => {
    const url = parsePublicUrl(`https://${host}`);
    expect(url === null || isPrivateHost(url.hostname)).toBe(true);
  });

  it.each(['example.com', 'cdn.example.co.uk', 'site.test'])('allows %s', (host) => {
    expect(isPrivateHost(host)).toBe(false);
  });
});

describe('scanPage', () => {
  it('finds stylesheet links and inline styles, ignoring comments and alternates', () => {
    const scan = scanPage(
      `<!-- <link rel="stylesheet" href="/old.css"> -->
       <LINK REL="Stylesheet" HREF="/a.css?x=1&amp;y=2">
       <link rel="alternate stylesheet" href="/alt.css">
       <link rel="preload" href="/pre.css">
       <link rel=stylesheet href=//cdn.example.org/b.css>
       <link rel="stylesheet" href="http://insecure.test/c.css">
       <style>@font-face{font-family:A}</style>`,
      'https://example.com/page/',
    );
    expect(scan.hrefs).toEqual([
      'https://example.com/a.css?x=1&y=2',
      'https://cdn.example.org/b.css',
    ]);
    expect(scan.inline).toEqual(['@font-face{font-family:A}']);
  });

  it('stays fast on hostile input with unclosed tags', () => {
    const hostile = `${'<link '.repeat(200_000)}${'<style>'.repeat(200_000)}`;
    const started = performance.now();
    scanPage(hostile, 'https://example.com/');
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe('scanCss', () => {
  it('reads faces, rules, the best source and imports', () => {
    const css = scanCss(
      `@import url("/more.css");
       @import "https://cdn.example.org/x.css";
       @font-face {
         font-family: "Inter";
         font-weight: 700;
         font-style: italic;
         unicode-range: U+0000-00FF;
         src: url(/i.ttf) format("truetype"), url(/i.woff2) format("woff2"), url(data:font/woff2;base64,AAAA);
       }`,
      'https://example.com/css/site.css',
    );
    expect(css.imports).toEqual(['https://example.com/more.css', 'https://cdn.example.org/x.css']);
    expect(css.rules).toEqual([
      { family: 'Inter', weight: '700', style: 'italic', unicodeRange: 'U+0000-00FF' },
    ]);
    expect(css.faces[0]?.face).toEqual({
      family: 'Inter',
      weight: 700,
      style: 'italic',
      url: 'https://example.com/i.woff2',
    });
    expect(css.faces[0]?.latin).toBe(true);
  });

  it('stays fast on hostile input with unclosed rules', () => {
    const started = performance.now();
    scanCss(`${'@font-face{'.repeat(40_000)}${'@import '.repeat(40_000)}`, 'https://example.com/');
    expect(performance.now() - started).toBeLessThan(2000);
  });
});

describe('directImport', () => {
  const page = `<link rel="stylesheet" href="/site.css"><style>@font-face{font-family:Inline;src:url(/inline.woff2)}</style>`;
  const css = `@font-face{font-family:Site;font-weight:400;src:url(/site.woff2) format("woff2")}`;

  it('collects faces and font files from a CORS-readable site', async () => {
    const result = await directImport('https://example.com/', {
      fetcher: site({
        'https://example.com/': { body: page },
        'https://example.com/site.css': { body: css, type: 'text/css' },
        'https://example.com/site.woff2': { body: FONT, type: 'font/woff2' },
        'https://example.com/inline.woff2': { body: FONT, type: 'font/woff2' },
      }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.origin).toBe('https://example.com');
    expect(result.value.verified).toBe(true);
    expect(result.value.faces.map((face) => face.family).sort()).toEqual(['Inline', 'Site']);
    expect(result.value.files.map((file) => file.name).sort()).toEqual([
      'inline.woff2',
      'site.woff2',
    ]);
  });

  it('accepts a stylesheet address directly', async () => {
    const result = await directImport('https://example.com/site.css', {
      fetcher: site({
        'https://example.com/site.css': { body: css, type: 'text/css' },
        'https://example.com/site.woff2': { body: FONT },
      }),
    });
    expect(result.ok && result.value.files.length).toBe(1);
  });

  it('keeps download links when font files cannot be read', async () => {
    const result = await directImport('https://example.com/', {
      fetcher: site({
        'https://example.com/': { body: '<link rel="stylesheet" href="/site.css">' },
        'https://example.com/site.css': { body: css, type: 'text/css' },
      }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.files).toEqual([]);
    expect(result.value.faces[0]?.url).toBe('https://example.com/site.woff2');
  });

  it('reports each failure kind', async () => {
    const blocked = site({});
    expect(await directImport('not a url', { fetcher: blocked })).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(await directImport('https://localhost/', { fetcher: blocked })).toEqual({
      ok: false,
      reason: 'blocked',
    });
    expect(await directImport('https://example.com/', { fetcher: blocked })).toEqual({
      ok: false,
      reason: 'unreachable',
    });
    const notFound = (async () => new Response('', { status: 404 })) as typeof fetch;
    expect(await directImport('https://example.com/', { fetcher: notFound })).toEqual({
      ok: false,
      reason: 'status',
    });
    const noStyles = site({ 'https://example.com/': { body: '<p>hi</p>' } });
    expect(await directImport('https://example.com/', { fetcher: noStyles })).toEqual({
      ok: false,
      reason: 'no-fonts',
    });
    const closedStyles = site({
      'https://example.com/': {
        body: '<link rel="stylesheet" href="https://cdn.example.org/a.css">',
      },
    });
    expect(await directImport('https://example.com/', { fetcher: closedStyles })).toEqual({
      ok: false,
      reason: 'stylesheets',
    });
  });

  it('refuses a redirect that lands on a private host', async () => {
    const redirected = (async () => {
      const response = new Response('<link rel="stylesheet" href="/a.css">');
      Object.defineProperty(response, 'url', { value: 'https://192.168.0.1/' });
      return response;
    }) as typeof fetch;
    expect(await directImport('https://example.com/', { fetcher: redirected })).toEqual({
      ok: false,
      reason: 'blocked',
    });
  });

  it('never sends credentials or a referrer and skips oversized bodies', async () => {
    const seen: RequestInit[] = [];
    const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init ?? {});
      return new Response('x', { headers: { 'content-length': String(50_000_000) } });
    }) as typeof fetch;
    const result = await directImport('https://example.com/', { fetcher });
    expect(result).toEqual({ ok: false, reason: 'unreachable' });
    expect(seen[0]).toMatchObject({
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  });
});

describe('limits and ordering', () => {
  const faceCss = (family: string, url: string, range = '') =>
    `@font-face{font-family:${family};${range ? `unicode-range:${range};` : ''}src:url(${url})}`;

  it('prefers the latin subset of a face and caps the face count', () => {
    const css = scanCss(
      `${faceCss('A', '/cyr.woff2', 'U+0400-04FF')}${faceCss('A', '/lat.woff2', 'U+0000-00FF')}`,
      'https://example.com/',
    );
    expect(mergeFaces(css.faces)[0]?.url).toBe('https://example.com/lat.woff2');
    const many = scanCss(
      Array.from({ length: 100 }, (_, index) => faceCss(`F${index}`, '/f.woff2')).join(''),
      'https://example.com/',
    );
    expect(mergeFaces(many.faces)).toHaveLength(64);
  });

  it('downloads at most eight font files', async () => {
    const files: Record<string, { body: string | Uint8Array; type?: string }> = {
      'https://example.com/': { body: '<link rel="stylesheet" href="/s.css">' },
      'https://example.com/s.css': {
        body: Array.from({ length: 12 }, (_, index) =>
          faceCss(`F${index}`, `/f${index}.woff2`),
        ).join(''),
        type: 'text/css',
      },
    };
    for (let index = 0; index < 12; index++) {
      files[`https://example.com/f${index}.woff2`] = { body: FONT };
    }
    const result = await directImport('https://example.com/', { fetcher: site(files) });
    expect(result.ok && result.value.files.length).toBe(8);
    expect(result.ok && result.value.faces.length).toBe(12);
  });

  it('does not request private sub-resources named by the page', async () => {
    const requested: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      requested.push(String(input));
      return new Response(
        '<link rel="stylesheet" href="https://192.168.0.1/a.css"><link rel="stylesheet" href="https://intranet/b.css"><link rel="stylesheet" href="https://example.com:8443/c.css">',
      );
    }) as typeof fetch;
    const result = await directImport('https://example.com/', { fetcher });
    expect(result).toEqual({ ok: false, reason: 'stylesheets' });
    expect(requested).toEqual(['https://example.com/']);
  });

  it('keeps linked stylesheets ahead of inline imports when the sheet limit is reached', async () => {
    const imports = Array.from({ length: 8 }, (_, index) => `@import "/i${index}.css";`).join('');
    const requested: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requested.push(url);
      if (url === 'https://example.com/') {
        return new Response(`<style>${imports}</style><link rel="stylesheet" href="/real.css">`);
      }
      return new Response('', { headers: { 'content-type': 'text/css' } });
    }) as typeof fetch;
    await directImport('https://example.com/', { fetcher });
    expect(requested).toContain('https://example.com/real.css');
  });

  it('stops when the caller aborts', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = ((_input: RequestInfo | URL, init?: RequestInit) =>
      init?.signal?.aborted
        ? Promise.reject(new DOMException('aborted', 'AbortError'))
        : Promise.resolve(new Response(''))) as typeof fetch;
    expect(
      await directImport('https://example.com/', { fetcher, signal: controller.signal }),
    ).toEqual({ ok: false, reason: 'unreachable' });
  });
});
