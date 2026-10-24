import { FontSourceError } from './download';
import * as fontsource from './fontsource';
import * as google from './google';
import type { FontFamily } from './types';

export type SourceId = 'google' | 'fontsource';

export interface FontOrigin {
  source: SourceId;
  family: string;
  style: string;
  subset: string;
}

export const SOURCES: Record<
  SourceId,
  {
    loadCatalog: () => Promise<FontFamily[]>;
    download: (family: FontFamily, style: string, subset: string) => Promise<File>;
  }
> = {
  google: {
    loadCatalog: google.loadCatalog,
    download: (family, style, subset) => google.downloadFont(family.name, style, subset),
  },
  fontsource: { loadCatalog: fontsource.loadCatalog, download: fontsource.downloadFont },
};

export const sameOrigin = (a: FontOrigin, b: FontOrigin) =>
  a.source === b.source && a.family === b.family && a.style === b.style && a.subset === b.subset;

export async function downloadOrigin(origin: FontOrigin): Promise<File> {
  const source = SOURCES[origin.source];
  if (!source) throw new FontSourceError('bad-file');
  const family = (await source.loadCatalog()).find((item) => item.id === origin.family);
  if (!family?.styles.includes(origin.style) || !family.subsets.includes(origin.subset)) {
    throw new FontSourceError('bad-file');
  }
  return source.download(family, origin.style, origin.subset);
}
