import { type ImportedFile, type SiteImport, sanitizeImport } from '@/modules/import-receiver';
import {
  isPrivateHost,
  MAX_CSS,
  MAX_SHEETS,
  mergeFaces,
  parsePublicUrl,
  type ScannedCss,
  type ScannedRule,
  scanCss,
  scanPage,
} from './scan';

const MAX_HTML = 2_000_000;
const MAX_FILES = 8;
const MAX_FILE = 10 * 1024 * 1024;
const MAX_TOTAL = 30 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const IMPORT_DEPTH = 2;

export type DirectFailure =
  | 'invalid'
  | 'blocked'
  | 'unreachable'
  | 'status'
  | 'stylesheets'
  | 'no-fonts';

export type DirectResult = { ok: true; value: SiteImport } | { ok: false; reason: DirectFailure };

export interface DirectOptions {
  fetcher?: typeof fetch;
  signal?: AbortSignal;
}

class Failure extends Error {
  constructor(readonly reason: DirectFailure) {
    super(reason);
  }
}

interface Loaded {
  bytes: ArrayBuffer;
  url: string;
  type: string;
}

async function readBounded(response: Response, limit: number, budget?: { left: number }) {
  if (Number(response.headers.get('content-length')) > limit) throw new Failure('unreachable');
  const reader = response.body?.getReader();
  if (!reader) {
    const buffer = await response.arrayBuffer();
    if (budget) budget.left -= buffer.byteLength;
    if (buffer.byteLength > limit || (budget && budget.left < 0)) throw new Failure('unreachable');
    return buffer;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (budget) budget.left -= value.byteLength;
    if (size > limit || (budget && budget.left < 0)) {
      await reader.cancel();
      throw new Failure('unreachable');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

async function load(
  url: string,
  limit: number,
  options: DirectOptions,
  budget?: { left: number },
): Promise<Loaded> {
  const target = parsePublicUrl(url);
  if (!target || isPrivateHost(target.hostname)) throw new Failure('blocked');
  const fetcher = options.fetcher ?? fetch;
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetcher(url, {
      mode: 'cors',
      credentials: 'omit',
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    });
  } catch {
    throw new Failure('unreachable');
  }
  const finalUrl = response.url || url;
  const parsed = parsePublicUrl(finalUrl);
  if (!parsed || isPrivateHost(parsed.hostname)) {
    await response.body?.cancel().catch(() => undefined);
    throw new Failure('blocked');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Failure('status');
  }
  try {
    const bytes = await readBounded(response, limit, budget);
    return { bytes, url: parsed.href, type: response.headers.get('content-type') ?? '' };
  } catch (error) {
    throw error instanceof Failure ? error : new Failure('unreachable');
  }
}

const decode = (bytes: ArrayBuffer) => new TextDecoder().decode(bytes);

export async function directImport(
  raw: string,
  options: DirectOptions = {},
): Promise<DirectResult> {
  const start = parsePublicUrl(raw);
  if (!start) return { ok: false, reason: 'invalid' };
  if (isPrivateHost(start.hostname)) return { ok: false, reason: 'blocked' };
  try {
    return { ok: true, value: await collect(start.href, options) };
  } catch (error) {
    if (error instanceof Failure) return { ok: false, reason: error.reason };
    return { ok: false, reason: 'unreachable' };
  }
}

async function collect(startUrl: string, options: DirectOptions): Promise<SiteImport> {
  const page = await load(startUrl, MAX_HTML, options);
  const parts: ScannedCss['faces'] = [];
  const rules: ScannedRule[] = [];
  const seen = new Set<string>();
  let queue: string[] = [];
  let failed = 0;

  const take = (css: ScannedCss) => {
    parts.push(...css.faces);
    rules.push(...css.rules);
    return css.imports;
  };
  const enqueue = (urls: string[]) => {
    for (const url of urls) {
      if (seen.size >= MAX_SHEETS || seen.has(url)) continue;
      seen.add(url);
      queue.push(url);
    }
  };

  const isCss = /text\/css/i.test(page.type) || new URL(page.url).pathname.endsWith('.css');
  if (isCss) {
    enqueue(take(scanCss(decode(page.bytes), page.url)));
  } else {
    const scan = scanPage(decode(page.bytes), page.url);
    const inlineImports = scan.inline.flatMap((text) => take(scanCss(text, page.url)));
    enqueue(scan.hrefs);
    enqueue(inlineImports);
  }

  for (let depth = 0; depth < IMPORT_DEPTH && queue.length > 0; depth++) {
    const batch = queue;
    queue = [];
    const results = await Promise.allSettled(batch.map((url) => load(url, MAX_CSS, options)));
    results.forEach((result) => {
      if (result.status !== 'fulfilled') {
        failed++;
        return;
      }
      const base = result.value.url;
      const imports = take(scanCss(decode(result.value.bytes), base));
      if (depth + 1 < IMPORT_DEPTH) enqueue(imports);
    });
  }

  const faces = mergeFaces(parts);
  const urls = [...new Set(faces.map((face) => face.url).filter((url): url is string => !!url))];
  const budget = { left: MAX_TOTAL };
  const downloads = await Promise.allSettled(
    urls.slice(0, MAX_FILES).map(async (url) => ({
      url,
      bytes: (await load(url, MAX_FILE, options, budget)).bytes,
    })),
  );
  const files: ImportedFile[] = [];
  for (const result of downloads) {
    if (result.status !== 'fulfilled' || result.value.bytes.byteLength === 0) continue;
    const name = new URL(result.value.url).pathname.split('/').pop() || 'font';
    files.push({ name, bytes: result.value.bytes });
  }

  const value = sanitizeImport(
    { v: 1, title: '', faces, rules, used: [], files },
    new URL(page.url).origin,
    true,
  );
  const usable = value && (value.files.length > 0 || value.faces.some((face) => face.url));
  if (!value || !usable)
    throw new Failure(failed > 0 && faces.length === 0 ? 'stylesheets' : 'no-fonts');
  return value;
}
