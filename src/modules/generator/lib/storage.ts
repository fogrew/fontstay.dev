import type { FontOrigin } from '@/modules/font-sources';
import { parseOrigin, parseShareState, type ShareState } from './share';

const SETTINGS_KEY = 'fontstay:settings';
const DB_NAME = 'fontstay';
const STORE = 'fonts';
export const MAX_STORED_FONTS = 8;

export interface StoredFont {
  name: string;
  bytes: ArrayBuffer;
  origin?: FontOrigin;
}

export function loadSettings(): ShareState | null {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? parseShareState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveSettings(state: ShareState): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  } catch {
    // storage may be unavailable or full
  }
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'name' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = work(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function storeFont(font: StoredFont): Promise<void> {
  try {
    await run('readwrite', (store) => store.put(font));
  } catch {
    // persistence is best effort
  }
}

export async function removeStoredFont(name: string): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(name));
  } catch {
    // persistence is best effort
  }
}

export async function loadStoredFonts(): Promise<StoredFont[]> {
  try {
    const all = await run('readonly', (store) => store.getAll() as IDBRequest<StoredFont[]>);
    return all
      .filter((item) => typeof item.name === 'string' && item.bytes instanceof ArrayBuffer)
      .slice(0, MAX_STORED_FONTS)
      .map((item) => {
        const origin = parseOrigin(item.origin);
        return origin ? { ...item, origin } : { name: item.name, bytes: item.bytes };
      });
  } catch {
    return [];
  }
}

export async function clearStorage(): Promise<void> {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // ignore
  }
  try {
    await run('readwrite', (store) => store.clear());
  } catch {
    // ignore
  }
}
