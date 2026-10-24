import { afterEach, describe, expect, it, vi } from 'vitest';
import { discardPending, storePending, takePending } from './handoff';
import { sanitizeImport } from './payload';

interface FakeRequest {
  result?: unknown;
  error?: unknown;
  onsuccess?: () => void;
  onerror?: () => void;
  onupgradeneeded?: () => void;
}

function fakeIndexedDB(options: { failOpen?: boolean } = {}) {
  const data = new Map<string, unknown>();
  const database = {
    createObjectStore: () => undefined,
    close: () => undefined,
    transaction: () => {
      const transaction: { oncomplete?: () => void; objectStore?: unknown } = {};
      const done = (result: unknown) => {
        queueMicrotask(() => transaction.oncomplete?.());
        return { result };
      };
      transaction.objectStore = () => ({
        put: (value: unknown, key: string) => done(data.set(key, value) && undefined),
        get: (key: string) => done(data.get(key)),
        delete: (key: string) => done(data.delete(key) && undefined),
      });
      return transaction;
    },
  };
  return {
    data,
    open: () => {
      const request: FakeRequest = options.failOpen
        ? { error: new Error('blocked') }
        : { result: database };
      queueMicrotask(() => {
        if (options.failOpen) request.onerror?.();
        else {
          request.onupgradeneeded?.();
          request.onsuccess?.();
        }
      });
      return request;
    },
  };
}

const value = () => {
  const imported = sanitizeImport(
    { v: 1, faces: [{ family: 'Inter' }] },
    'https://site.test',
    true,
  );
  if (!imported) throw new Error('the sample import is not valid');
  return imported;
};

afterEach(() => vi.unstubAllGlobals());

describe('the import handoff', () => {
  it('hands the import over once', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB());
    expect(await storePending(value())).toBe(true);
    expect(await takePending()).toMatchObject({ origin: 'https://site.test' });
    expect(await takePending()).toBeNull();
  });

  it('drops an import older than ten minutes', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB());
    await storePending(value());
    expect(await takePending(Date.now() + 11 * 60 * 1000)).toBeNull();
    expect(await takePending()).toBeNull();
  });

  it('reports a store that cannot be opened', async () => {
    vi.stubGlobal('indexedDB', fakeIndexedDB({ failOpen: true }));
    expect(await storePending(value())).toBe(false);
    expect(await takePending()).toBeNull();
  });

  it('discards a pending import on request', async () => {
    const fake = fakeIndexedDB();
    vi.stubGlobal('indexedDB', fake);
    await storePending(value());
    await discardPending();
    expect(fake.data.size).toBe(0);
  });
});
