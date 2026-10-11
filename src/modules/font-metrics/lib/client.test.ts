import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFontParser } from './client';
import { FONT_PARSE_TIMEOUT_MS } from './model';

const bytes = readFileSync(
  new URL('../../../../tests/fixtures/fonts/FiraSans-Regular.ttf', import.meta.url),
);
const input = () => Uint8Array.from(bytes).buffer;

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: Worker['onmessage'] = null;
  onerror: Worker['onerror'] = null;
  onmessageerror: Worker['onmessageerror'] = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    TestWorker.instances.push(this);
  }
  reply(data: unknown) {
    this.onmessage?.call(this as unknown as Worker, new MessageEvent('message', { data }));
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  TestWorker.instances = [];
});

describe('font parser client', () => {
  it('rejects invalid files before starting or transferring to a worker', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const parser = createFontParser();
    await expect(parser.parse(new ArrayBuffer(0))).resolves.toEqual({
      ok: false,
      error: { code: 'invalid-font' },
    });
    await expect(parser.parse(new ArrayBuffer(10 * 1024 * 1024 + 1))).resolves.toEqual({
      ok: false,
      error: { code: 'too-large' },
    });
    expect(TestWorker.instances).toHaveLength(0);
  });

  const shell = {
    codePoints: new Uint32Array(1),
    advances: new Float64Array(1),
    unitsPerEm: 1000,
    isVariable: false,
    style: { weight: 400, italic: false, category: null },
  };
  it.each([
    null,
    'text',
    { ok: true },
    { ok: false, error: {} },
    { ok: false, error: { code: 'nonsense' } },
    { ok: true, font: { ...shell, names: null, hhea: {} } },
    { ok: true, font: { ...shell, names: {}, hhea: null } },
  ])('treats a malformed worker reply as a worker error', async (reply) => {
    vi.stubGlobal('Worker', TestWorker);
    const pending = createFontParser().parse(input());
    TestWorker.instances[0]?.reply(reply);
    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'worker-error' } });
    expect(TestWorker.instances[0]?.terminate).toHaveBeenCalledOnce();
  });

  it('returns busy for concurrent requests and keeps the second buffer intact', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const parser = createFontParser();
    const pending = parser.parse(input());
    const second = input();
    await expect(parser.parse(second)).resolves.toEqual({ ok: false, error: { code: 'busy' } });
    expect(second.byteLength).toBe(bytes.length);
    TestWorker.instances[0]?.reply({ ok: false, error: { code: 'invalid-font' } });
    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'invalid-font' } });
  });

  it('starts a fresh worker after timeout and after a parse error', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', TestWorker);
    const parser = createFontParser();
    const timedOut = parser.parse(input());
    await vi.advanceTimersByTimeAsync(FONT_PARSE_TIMEOUT_MS);
    await expect(timedOut).resolves.toEqual({ ok: false, error: { code: 'timeout' } });
    const retry = parser.parse(input());
    TestWorker.instances[1]?.reply({ ok: false, error: { code: 'invalid-font' } });
    await expect(retry).resolves.toEqual({ ok: false, error: { code: 'invalid-font' } });
    const next = parser.parse(input());
    TestWorker.instances[2]?.reply({ ok: false, error: { code: 'unsupported-format' } });
    await next;
    expect(TestWorker.instances).toHaveLength(3);
    for (const worker of TestWorker.instances) expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it('disposes active work and rejects subsequent requests', async () => {
    vi.stubGlobal('Worker', TestWorker);
    const parser = createFontParser();
    const pending = parser.parse(input());
    parser.dispose();
    await expect(pending).resolves.toEqual({ ok: false, error: { code: 'disposed' } });
    await expect(parser.parse(input())).resolves.toEqual({
      ok: false,
      error: { code: 'disposed' },
    });
    expect(TestWorker.instances[0]?.terminate).toHaveBeenCalledOnce();
  });

  it('returns a stable error when workers are unavailable', async () => {
    vi.stubGlobal('Worker', undefined);
    await expect(createFontParser().parse(input())).resolves.toEqual({
      ok: false,
      error: { code: 'worker-error' },
    });
  });
});
