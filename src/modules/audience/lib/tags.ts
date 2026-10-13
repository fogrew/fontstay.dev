export const TAG_BROWSERS = [
  'chrome',
  'edge',
  'firefox',
  'safari',
  'opera',
  'ios_saf',
  'and_chr',
  'and_ff',
  'samsung',
  'android',
  'ie',
  'op_mini',
] as const;

export interface Tag {
  label: string;
  include: string;
  exclude: string;
  browser?: string;
}

export interface TagGroup {
  id: 'popularity' | 'baseline' | 'recency' | 'browsers';
  tags: readonly Tag[];
}

const plain = (query: string): Tag => ({ label: query, include: query, exclude: `not ${query}` });

export const TAG_GROUPS: readonly TagGroup[] = [
  {
    id: 'popularity',
    tags: ['> 0.1%', '> 0.5%', '> 1%', '> 2%', '> 5%', 'cover 95%', 'cover 99%'].map(plain),
  },
  {
    id: 'baseline',
    tags: [
      'baseline widely available',
      'baseline newly available',
      'baseline 2022',
      'baseline 2023',
      'baseline 2024',
      'baseline 2025',
    ].map(plain),
  },
  {
    id: 'recency',
    tags: ['defaults', 'last 2 versions', 'last 5 versions', 'dead', 'unreleased versions'].map(
      plain,
    ),
  },
  {
    id: 'browsers',
    tags: TAG_BROWSERS.map((id) => ({
      label: id,
      include: `last 2 ${id} versions`,
      exclude: `not ${id} > 0`,
      browser: id,
    })),
  },
];

export function splitQuery(query: string): string[] {
  return query
    .split(',')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

export function joinQuery(parts: readonly string[]): string {
  return parts.join(', ');
}

export function isExcluded(part: string): boolean {
  return /^not\s/i.test(part);
}

export function addTag(query: string, tag: string): string {
  const parts = splitQuery(query);
  return parts.includes(tag) ? joinQuery(parts) : joinQuery([...parts, tag]);
}

export function removeTag(query: string, tag: string): string {
  return joinQuery(splitQuery(query).filter((part) => part !== tag));
}

export function browserOf(tag: string): string | undefined {
  const words = tag.toLowerCase().split(/\s+/);
  return words.find((word) => (TAG_BROWSERS as readonly string[]).includes(word));
}
