import {
  defaultFetch,
  FETCH_TIMEOUT_MS,
  type Fetch,
  FontSourceError,
  fetchFile,
  isHttpsUrl,
  safeFileName,
} from './download';
import { type FontFamily, parseStyle } from './types';

interface RawCatalog {
  categories: string[];
  families: [string, string, number, string[], string[]][];
}

const FILE_HOST = 'cdn.jsdelivr.net';
const FILE_PATH = '/fontsource/fonts/';
const ID = /^[a-z0-9-]{1,80}$/;
const SUBSET = /^[a-z0-9-]{1,40}$/;

export function decodeCatalog(raw: RawCatalog): FontFamily[] {
  return raw.families.map(([id, name, category, subsets, styles]) => ({
    id,
    name,
    category: raw.categories[category] ?? 'Sans Serif',
    subsets,
    styles,
  }));
}

export async function loadCatalog(): Promise<FontFamily[]> {
  const module = await import('../data/fontsource-catalog.json');
  return decodeCatalog(module.default as unknown as RawCatalog);
}

export function fileUrl(id: string, style: string, subset: string): string | null {
  if (!ID.test(id) || !SUBSET.test(subset)) return null;
  const { weight, italic } = parseStyle(style);
  const url = `https://${FILE_HOST}${FILE_PATH}${id}@latest/${subset}-${weight}-${italic ? 'italic' : 'normal'}.woff2`;
  return isHttpsUrl(url, FILE_HOST, FILE_PATH) ? url : null;
}

export async function downloadFont(
  family: FontFamily,
  style: string,
  subset: string,
  fetchImpl: Fetch = defaultFetch,
): Promise<File> {
  const url = fileUrl(family.id, style, subset);
  if (!url) throw new FontSourceError('bad-file');
  return fetchFile(
    url,
    safeFileName(family.name, style, subset),
    AbortSignal.timeout(FETCH_TIMEOUT_MS),
    fetchImpl,
  );
}
