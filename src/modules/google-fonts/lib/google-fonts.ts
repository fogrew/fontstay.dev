export interface GoogleFamily {
  name: string;
  category: string;
  subsets: string[];
  styles: string[];
  axes: string[];
}

interface RawCatalog {
  categories: string[];
  families: [string, number, string[], string[], string[]][];
}

export const MAX_FONT_DOWNLOAD = 10 * 1024 * 1024;
export const MAX_CSS_DOWNLOAD = 1024 * 1024;
export const FETCH_TIMEOUT_MS = 15_000;
const CSS_HOST = 'fonts.googleapis.com';
const FILE_HOST = 'fonts.gstatic.com';

export class GoogleFontsError extends Error {
  constructor(public readonly code: 'network' | 'no-subset' | 'bad-file' | 'too-large') {
    super(code);
    this.name = 'GoogleFontsError';
  }
}

export function decodeCatalog(raw: RawCatalog): GoogleFamily[] {
  return raw.families.map(([name, category, subsets, styles, axes]) => ({
    name,
    category: raw.categories[category] ?? 'Sans Serif',
    subsets,
    styles,
    axes,
  }));
}

export async function loadCatalog(): Promise<GoogleFamily[]> {
  const module = await import('../data/catalog.json');
  return decodeCatalog(module.default as unknown as RawCatalog);
}

export function searchFamilies(
  families: readonly GoogleFamily[],
  query: string,
  category = '',
  limit = 30,
): GoogleFamily[] {
  const needle = query.trim().toLowerCase();
  const result: GoogleFamily[] = [];
  for (const family of families) {
    if (category && family.category !== category) continue;
    if (needle && !family.name.toLowerCase().includes(needle)) continue;
    result.push(family);
    if (result.length >= limit) break;
  }
  return result;
}

export function parseStyle(key: string): { weight: number; italic: boolean } {
  const italic = key.endsWith('i');
  const weight = Number.parseInt(italic ? key.slice(0, -1) : key, 10);
  return { weight: Number.isFinite(weight) ? weight : 400, italic };
}

export function cssUrl(family: string, style: string): string {
  const { weight, italic } = parseStyle(style);
  const name = encodeURIComponent(family).replace(/%20/g, '+');
  return `https://${CSS_HOST}/css2?family=${name}:ital,wght@${italic ? 1 : 0},${weight}&display=swap`;
}

export interface SubsetFile {
  subset: string;
  url: string;
}

export function parseGoogleCss(css: string): SubsetFile[] {
  const files: SubsetFile[] = [];
  let position = 0;
  while (files.length < 64) {
    const open = css.indexOf('/*', position);
    if (open < 0) break;
    const close = css.indexOf('*/', open + 2);
    if (close < 0) break;
    const subset = css.slice(open + 2, close).trim();
    const face = css.indexOf('@font-face', close);
    const end = face < 0 ? -1 : css.indexOf('}', face);
    if (face < 0 || end < 0) break;
    position = end + 1;
    const body = css.slice(face, end);
    const url = /url\(\s*["']?([^"')\s]+)["']?\s*\)/i.exec(body)?.[1];
    if (url && /^[a-z0-9-]{1,40}$/i.test(subset)) files.push({ subset, url });
  }
  return files;
}

export function isFileUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === FILE_HOST &&
      !parsed.username &&
      !parsed.password
    );
  } catch {
    return false;
  }
}

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

async function readBounded(response: Response, limit: number): Promise<ArrayBuffer> {
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > limit) throw new GoogleFontsError('too-large');
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > limit) throw new GoogleFontsError('too-large');
  return buffer;
}

export async function downloadFont(
  family: string,
  style: string,
  subset: string,
  fetchImpl: Fetch = (url, init) => fetch(url, init),
): Promise<File> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let css: string;
  try {
    const response = await fetchImpl(cssUrl(family, style), { signal });
    if (!response.ok) throw new GoogleFontsError('network');
    css = new TextDecoder().decode(await readBounded(response, MAX_CSS_DOWNLOAD));
  } catch (failure) {
    throw failure instanceof GoogleFontsError ? failure : new GoogleFontsError('network');
  }
  const file = parseGoogleCss(css).find((item) => item.subset === subset);
  if (!file) throw new GoogleFontsError('no-subset');
  if (!isFileUrl(file.url)) throw new GoogleFontsError('bad-file');
  try {
    const response = await fetchImpl(file.url, { signal });
    if (!response.ok) throw new GoogleFontsError('network');
    const bytes = await readBounded(response, MAX_FONT_DOWNLOAD);
    const base = family.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'font';
    return new File([bytes], `${base}-${style}-${subset}.woff2`, { type: 'font/woff2' });
  } catch (failure) {
    throw failure instanceof GoogleFontsError ? failure : new GoogleFontsError('network');
  }
}
