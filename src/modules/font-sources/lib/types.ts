export interface FontFamily {
  id: string;
  name: string;
  category: string;
  subsets: string[];
  styles: string[];
  version?: string;
  license: string;
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
  preferred = '',
): FontFamily[] {
  const needle = query.trim().toLowerCase();
  const result: FontFamily[] = [];
  for (const family of families) {
    if (category && family.category !== category) continue;
    if (needle && !family.name.toLowerCase().includes(needle)) continue;
    result.push(family);
    if (!preferred && result.length >= limit) break;
  }
  if (!preferred) return result;
  const rank = (family: FontFamily) =>
    family.name.toLowerCase() === needle ? 0 : family.subsets.includes(preferred) ? 1 : 2;
  return result.sort((a, b) => rank(a) - rank(b)).slice(0, limit);
}

export function defaultSubsets(names: readonly string[], preferred = ''): string[] {
  const base = names.includes('latin') ? 'latin' : (names[0] ?? 'latin');
  return preferred !== base && names.includes(preferred) ? [base, preferred] : [base];
}

export function bestMatchIndex(names: readonly string[], query: string): number {
  const needle = query.trim().toLowerCase();
  if (!needle) return -1;
  let best = -1;
  let bestRank = 2;
  names.forEach((name, index) => {
    const value = name.toLowerCase();
    const rank = value === needle ? 0 : value.startsWith(needle) ? 1 : 2;
    if (rank < bestRank) {
      best = index;
      bestRank = rank;
    }
  });
  return best;
}
