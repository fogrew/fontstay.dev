import { describe, expect, it, vi } from 'vitest';
import { bookmarkletHref, bookmarkletSource } from './bookmarklet';

const options = {
  origin: 'https://fontstay.dev',
  locale: 'en',
  copied: "Copied $& $' $` done",
  failed: 'Failed',
};

describe('bookmarklet', () => {
  it('inserts the options literally, even with replacement patterns', () => {
    const source = bookmarkletSource(options);
    expect(source).toContain(JSON.stringify(options.copied));
    expect(source).toContain('"https://fontstay.dev"');
    expect(source).toContain('"/en/import/"');
    expect(source).not.toContain('__TARGET__');
    expect(source).not.toContain('export ');
  });

  it('is one self-invoking line that parses as JavaScript', () => {
    const source = bookmarkletSource(options);
    expect(source).not.toContain('\n');
    expect(() => new Function(source)).not.toThrow();
  });

  it('builds a javascript: URL that round-trips', () => {
    const href = bookmarkletHref(options);
    expect(new URL(href).protocol).toBe('javascript:');
    expect(decodeURIComponent(href.slice('javascript:'.length))).toBe(bookmarkletSource(options));
    expect(href.length).toBeLessThan(16000);
    expect(href).not.toContain('#');
  });

  it('addresses the message to the exact generator origin and waits for the handshake', () => {
    const source = bookmarkletSource(options);
    expect(source).toContain('event.origin !== target');
    expect(source).toContain('event.source !== child');
    expect(source).toContain('fontstay:ready');
  });

  it('says so when the collector fails, with or without the generator window', async () => {
    const run = async (child: unknown) => {
      const alert = vi.fn();
      const window = { open: () => child, addEventListener: () => undefined };
      new Function('window', 'document', 'alert', 'crypto', bookmarkletSource(options))(
        window,
        {},
        alert,
        globalThis.crypto,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      return alert;
    };
    expect(await run(null)).toHaveBeenCalledWith('Failed');
    expect(await run({})).toHaveBeenCalledWith('Failed');
  });
});

describe('bookmarklet handshake', () => {
  function run() {
    const listeners: ((event: unknown) => void)[] = [];
    const child = { postMessage: vi.fn() };
    const open = vi.fn((_url: string, _target: string) => child);
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const win = {
      open,
      location: { origin: 'https://site.example' },
      addEventListener: (_type: string, listener: (event: unknown) => void) =>
        listeners.push(listener),
      removeEventListener: (_type: string, listener: (event: unknown) => void) => {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      },
      getComputedStyle: () => ({}),
      fetch: async () => ({
        ok: true,
        headers: { get: () => null },
        arrayBuffer: async () => bytes,
      }),
    };
    const rule = {
      type: 5,
      style: {
        getPropertyValue: (name: string) =>
          ({ 'font-family': 'Inter', src: 'url(https://site.example/a.woff2)' })[name] ?? '',
      },
    };
    const doc = {
      styleSheets: [{ cssRules: [rule], href: null }],
      baseURI: 'https://site.example/',
      title: 'Site',
      body: { querySelectorAll: () => [] },
      querySelector: () => null,
    };
    new Function('window', 'document', bookmarkletSource(options))(win, doc);
    const emit = (event: unknown) => {
      for (const listener of [...listeners]) listener(event);
    };
    return { child, open, emit, listeners };
  }

  const ready = { type: 'fontstay:ready', v: 1 };
  const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

  it('opens the generator and waits for the handshake before sending anything', () => {
    const { child, open } = run();
    expect(open).toHaveBeenCalledOnce();
    expect(String(open.mock.calls[0]?.[0])).toMatch(
      /^https:\/\/fontstay\.dev\/en\/import\/#t=[A-Za-z0-9]{24}$/,
    );
    expect(child.postMessage).not.toHaveBeenCalled();
  });

  it('ignores READY from another window or origin', async () => {
    const { child, emit, listeners } = run();
    emit({ source: {}, origin: 'https://fontstay.dev', data: ready });
    emit({ source: child, origin: 'https://evil.example', data: ready });
    emit({ source: child, origin: 'https://fontstay.dev', data: { type: 'other' } });
    emit({ source: child, origin: 'https://fontstay.dev', data: null });
    await flush();
    expect(child.postMessage).not.toHaveBeenCalled();
    expect(listeners).toHaveLength(1);
  });

  it('posts the payload to the exact origin with the transfer list on READY from the child', async () => {
    const { child, open, emit, listeners } = run();
    emit({ source: child, origin: 'https://fontstay.dev', data: ready });
    await flush();
    expect(child.postMessage).toHaveBeenCalledOnce();
    const [message, target, transfer] = child.postMessage.mock.calls[0] as unknown as [
      { type: string; v: number; token: string; payload: { files: { bytes: ArrayBuffer }[] } },
      string,
      ArrayBuffer[],
    ];
    expect(target).toBe('https://fontstay.dev');
    expect(message).toMatchObject({ type: 'fontstay:import', v: 1 });
    expect(String(open.mock.calls[0]?.[0]).endsWith(`#t=${message.token}`)).toBe(true);
    expect(transfer).toEqual(message.payload.files.map((file) => file.bytes));
    expect(transfer).toHaveLength(1);
    expect(listeners).toHaveLength(0);
  });
});
