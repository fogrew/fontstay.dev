export const MAX_BROWSERSLIST_CHARS = 20_000;
const MAX_QUERIES = 40;
const MAX_QUERY = 200;

const FILE_NAME = /^(\.browserslist(rc)?|browserslist|package\.json)$/i;

export const isBrowserslistFile = (name: string) => FILE_NAME.test(name);

const clean = (queries: readonly unknown[]): string[] => {
  const result: string[] = [];
  for (const item of queries) {
    if (typeof item !== 'string') continue;
    for (const part of item.split(',')) {
      const query = part.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
      if (query && !/^extends\s/i.test(query) && !result.includes(query)) result.push(query);
    }
  }
  return result.slice(0, MAX_QUERIES);
};

function fromPackageJson(text: string): string[] {
  try {
    const value = (JSON.parse(text) as { browserslist?: unknown }).browserslist;
    if (typeof value === 'string') return clean([value]);
    if (Array.isArray(value)) return clean(value);
    if (value && typeof value === 'object') {
      const sections = value as Record<string, unknown>;
      const picked = sections.production ?? Object.values(sections)[0];
      return Array.isArray(picked) ? clean(picked) : [];
    }
  } catch {}
  return [];
}

export function parseBrowserslist(text: string): string[] {
  const source = text.slice(0, MAX_BROWSERSLIST_CHARS);
  if (source.trimStart().startsWith('{')) return fromPackageJson(source);
  const sections = new Map<string, string[]>([['', []]]);
  let current = '';
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, '').trim();
    if (!line) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      current = (header[1] ?? '').trim().toLowerCase();
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    sections.get(current)?.push(line);
  }
  const base = sections.get('') ?? [];
  const picked =
    sections.get('production') ??
    (base.length > 0 ? base : [...sections.values()].find((lines) => lines.length > 0));
  return clean(picked ?? []);
}

export function looksLikeQueryList(text: string): boolean {
  return /[\n,]/.test(text.trim()) || /(^|\s)#/.test(text);
}
