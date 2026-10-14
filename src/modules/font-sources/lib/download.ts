export const MAX_FONT_DOWNLOAD = 10 * 1024 * 1024;
export const MAX_CSS_DOWNLOAD = 1024 * 1024;
export const FETCH_TIMEOUT_MS = 15_000;

export class FontSourceError extends Error {
  constructor(public readonly code: 'network' | 'no-subset' | 'bad-file' | 'too-large') {
    super(code);
    this.name = 'FontSourceError';
  }
}

export type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

export async function readBounded(response: Response, limit: number): Promise<ArrayBuffer> {
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > limit) throw new FontSourceError('too-large');
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > limit) throw new FontSourceError('too-large');
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new FontSourceError('too-large');
    }
    chunks.push(value);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

export const defaultFetch: Fetch = (url, init) =>
  fetch(url, { ...init, credentials: 'omit', referrerPolicy: 'no-referrer' });

export function safeFileName(family: string, style: string, subset: string): string {
  const base = family.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'font';
  return `${base}-${style}-${subset}.woff2`;
}

export function isHttpsUrl(url: string, host: string, pathPrefix = '/'): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === host &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      parsed.pathname.startsWith(pathPrefix)
    );
  } catch {
    return false;
  }
}

export async function fetchFile(
  url: string,
  name: string,
  signal: AbortSignal,
  fetchImpl: Fetch,
): Promise<File> {
  try {
    const response = await fetchImpl(url, { signal });
    if (!response.ok) throw new FontSourceError('network');
    const bytes = await readBounded(response, MAX_FONT_DOWNLOAD);
    return new File([bytes], name, { type: 'font/woff2' });
  } catch (failure) {
    throw failure instanceof FontSourceError ? failure : new FontSourceError('network');
  }
}
