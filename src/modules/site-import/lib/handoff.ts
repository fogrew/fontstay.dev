import { type SiteImport, sanitizeImport } from './payload';

const DB_NAME = 'fontstay-import';
const STORE = 'pending';
const KEY = 'latest';
const MAX_AGE_MS = 10 * 60 * 1000;

interface Pending {
  receivedAt: number;
  value: SiteImport;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
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

export async function storePending(value: SiteImport): Promise<boolean> {
  try {
    await run('readwrite', (store) => store.put({ receivedAt: Date.now(), value }, KEY));
    return true;
  } catch {
    return false;
  }
}

export async function takePending(now = Date.now()): Promise<SiteImport | null> {
  try {
    const pending = await run(
      'readonly',
      (store) => store.get(KEY) as IDBRequest<Pending | undefined>,
    );
    await discardPending();
    if (!pending || now - pending.receivedAt > MAX_AGE_MS) return null;
    const { value } = pending;
    return sanitizeImport(value, value.origin, value.verified);
  } catch {
    return null;
  }
}

export async function discardPending(): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(KEY));
  } catch {
    // best effort
  }
}
