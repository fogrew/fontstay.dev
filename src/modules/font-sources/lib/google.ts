import {
  defaultFetch,
  FETCH_TIMEOUT_MS,
  type Fetch,
  FontSourceError,
  fetchFile,
  isHttpsUrl,
  MAX_CSS_DOWNLOAD,
  readBounded,
  safeFileName,
} from './download';
import { type FontFamily, parseStyle } from './types';

interface RawCatalog {
  categories: string[];
  families: [string, number, string[], string[], string[]][];
}

const CSS_HOST = 'fonts.googleapis.com';
const FILE_HOST = 'fonts.gstatic.com';

export function decodeCatalog(raw: RawCatalog): FontFamily[] {
  return raw.families.map(([name, category, subsets, styles]) => ({
    id: name,
    name,
    category: raw.categories[category] ?? 'Sans Serif',
    subsets,
    styles,
  }));
}

export async function loadCatalog(): Promise<FontFamily[]> {
  const module = await import('../data/google-catalog.json');
  return decodeCatalog(module.default as unknown as RawCatalog);
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

export const isFileUrl = (url: string) => isHttpsUrl(url, FILE_HOST);

export async function downloadFont(
  family: string,
  style: string,
  subset: string,
  fetchImpl: Fetch = defaultFetch,
): Promise<File> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let css: string;
  try {
    const response = await fetchImpl(cssUrl(family, style), { signal });
    if (!response.ok) throw new FontSourceError('network');
    css = new TextDecoder().decode(await readBounded(response, MAX_CSS_DOWNLOAD));
  } catch (failure) {
    throw failure instanceof FontSourceError ? failure : new FontSourceError('network');
  }
  const file = parseGoogleCss(css).find((item) => item.subset === subset);
  if (!file) throw new FontSourceError('no-subset');
  if (!isFileUrl(file.url)) throw new FontSourceError('bad-file');
  return fetchFile(file.url, safeFileName(family, style, subset), signal, fetchImpl);
}
