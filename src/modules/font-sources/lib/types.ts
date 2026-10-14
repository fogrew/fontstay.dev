export interface FontFamily {
  id: string;
  name: string;
  category: string;
  subsets: string[];
  styles: string[];
}

export const CJK_SUBSETS = new Set([
  'japanese',
  'korean',
  'chinese-simplified',
  'chinese-traditional',
  'chinese-hongkong',
]);

export function parseStyle(key: string): { weight: number; italic: boolean } {
  const italic = key.endsWith('i');
  const weight = Number.parseInt(italic ? key.slice(0, -1) : key, 10);
  return { weight: Number.isFinite(weight) ? weight : 400, italic };
}

export function searchFamilies(
  families: readonly FontFamily[],
  query: string,
  category = '',
  limit = 30,
): FontFamily[] {
  const needle = query.trim().toLowerCase();
  const result: FontFamily[] = [];
  for (const family of families) {
    if (category && family.category !== category) continue;
    if (needle && !family.name.toLowerCase().includes(needle)) continue;
    result.push(family);
    if (result.length >= limit) break;
  }
  return result;
}
