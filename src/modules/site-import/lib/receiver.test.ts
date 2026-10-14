import { describe, expect, it, vi } from 'vitest';
import { DATA_TYPE, READY_TYPE, tokenFromHash } from './protocol';
import { type ReceiverWindow, startReceiver } from './receiver';

const TOKEN = 'abcdefghijklmnopqrstuvwx';

function setup() {
  const posted: unknown[] = [];
  const opener = { postMessage: (message: unknown) => posted.push(message) };
  const listeners = new Set<(event: MessageEvent) => void>();
  const win: ReceiverWindow = {
    opener,
    location: { origin: 'https://fontstay.dev' },
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
  };
  const send = (init: { data: unknown; source: unknown; origin: string }) => {
    for (const listener of [...listeners]) listener(init as unknown as MessageEvent);
  };
  return { win, opener, posted, listeners, send };
}

const message = (overrides: Record<string, unknown> = {}) => ({
  type: DATA_TYPE,
  v: 1,
  token: TOKEN,
  payload: { v: 1, faces: [{ family: 'Inter' }] },
  ...overrides,
});

describe('tokenFromHash', () => {
  it('accepts only a well-formed token fragment', () => {
    expect(tokenFromHash(`#t=${TOKEN}`)).toBe(TOKEN);
    expect(tokenFromHash('#t=short')).toBeNull();
    expect(tokenFromHash(`#t=${TOKEN}&x=1`)).toBeNull();
    expect(tokenFromHash(`#t=${'a'.repeat(100)}`)).toBeNull();
    expect(tokenFromHash('')).toBeNull();
  });
});

describe('startReceiver', () => {
  it('announces itself to the opener and accepts the matching message from it', () => {
    const { win, opener, posted, send } = setup();
    const onImport = vi.fn();
    startReceiver(win, { token: TOKEN, onImport, onFailure: vi.fn() });
    expect(posted[0]).toMatchObject({ type: READY_TYPE });
    send({ data: message(), source: opener, origin: 'https://site.example' });
    expect(onImport).toHaveBeenCalledOnce();
    expect(onImport.mock.calls[0]?.[0]).toMatchObject({
      origin: 'https://site.example',
      verified: true,
    });
  });

  it('ignores other windows, wrong tokens, other types and versions', () => {
    const { win, opener, send } = setup();
    const onImport = vi.fn();
    const onFailure = vi.fn();
    startReceiver(win, { token: TOKEN, onImport, onFailure });
    send({ data: message(), source: {}, origin: 'https://evil.example' });
    send({ data: message({ token: 'x'.repeat(24) }), source: opener, origin: 'https://a.example' });
    send({ data: message({ type: 'other' }), source: opener, origin: 'https://a.example' });
    send({ data: message({ v: 2 }), source: opener, origin: 'https://a.example' });
    send({ data: 'text', source: opener, origin: 'https://a.example' });
    send({ data: null, source: opener, origin: 'https://a.example' });
    expect(onImport).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('accepts only the first message and then stops listening', () => {
    const { win, opener, listeners, send } = setup();
    const onImport = vi.fn();
    startReceiver(win, { token: TOKEN, onImport, onFailure: vi.fn() });
    send({ data: message(), source: opener, origin: 'https://a.example' });
    send({ data: message(), source: opener, origin: 'https://b.example' });
    expect(onImport).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
  });

  it('reports a payload that does not survive sanitizing', () => {
    const { win, opener, send } = setup();
    const onImport = vi.fn();
    const onFailure = vi.fn();
    startReceiver(win, { token: TOKEN, onImport, onFailure });
    send({ data: message({ payload: { v: 9 } }), source: opener, origin: 'https://a.example' });
    expect(onImport).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledOnce();
  });

  it('takes the origin from the page itself only for same-window messages', () => {
    const { win, send } = setup();
    const onImport = vi.fn();
    startReceiver(win, { token: TOKEN, onImport, onFailure: vi.fn() });
    send({
      data: message({ origin: 'https://claimed.example' }),
      source: win,
      origin: 'https://fontstay.dev',
    });
    expect(onImport.mock.calls[0]?.[0]).toMatchObject({ origin: 'https://claimed.example' });
  });

  it('refuses same-window messages from another origin and works without an opener', () => {
    const { win, send } = setup();
    win.opener = null;
    const onImport = vi.fn();
    startReceiver(win, { token: TOKEN, onImport, onFailure: vi.fn() });
    send({ data: message(), source: win, origin: 'https://evil.example' });
    send({ data: message(), source: null, origin: 'https://evil.example' });
    expect(onImport).not.toHaveBeenCalled();
  });

  it('fails after the timeout', () => {
    vi.useFakeTimers();
    const { win } = setup();
    const onFailure = vi.fn();
    startReceiver(win, { token: TOKEN, onImport: vi.fn(), onFailure, timeoutMs: 1000 });
    vi.advanceTimersByTime(1100);
    expect(onFailure).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
