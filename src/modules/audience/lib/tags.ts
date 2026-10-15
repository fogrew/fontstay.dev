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

export const TAG_OS = ['windows', 'macos', 'linux', 'chromeos', 'android', 'ios'] as const;

export interface Tag {
  label: string;
  include: string;
  exclude: string;
  browser?: string;
  os?: string;
}

export interface TagGroup {
  id: 'popularity' | 'baseline' | 'recency' | 'browsers' | 'os';
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
      'baseline 2026',
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
  {
    id: 'os',
    tags: TAG_OS.map((id) => ({
      label: id,
      include: `os ${id}`,
      exclude: `not os ${id}`,
      os: id,
    })),
  },
];

const OS_PART = /^(not\s+)?os\s+(windows|macos|linux|chromeos|android|ios)$/i;

export function splitOsQuery(query: string): {
  browsers: string;
  include: string[];
  exclude: string[];
} {
  const browsers: string[] = [];
  const include: string[] = [];
  const exclude: string[] = [];
  for (const part of splitQuery(query)) {
    const match = OS_PART.exec(part);
    if (!match) browsers.push(part);
    else (match[1] ? exclude : include).push((match[2] ?? '').toLowerCase());
  }
  return { browsers: browsers.join(', '), include, exclude };
}

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

export function addTags(query: string, tags: readonly string[]): string {
  return tags.reduce((current, tag) => addTag(current, tag), query);
}

const PAIRS = TAG_GROUPS.flatMap((group) =>
  group.tags.map((tag) => [tag.include, tag.exclude] as const),
);

export function toggleNot(query: string, tag: string): string {
  const pair = PAIRS.find(([include, exclude]) => include === tag || exclude === tag);
  const next = pair
    ? tag === pair[0]
      ? pair[1]
      : pair[0]
    : isExcluded(tag)
      ? tag.replace(/^not\s+/i, '')
      : `not ${tag}`;
  return joinQuery(splitQuery(query).map((part) => (part === tag ? next : part)));
}

export function removeTag(query: string, tag: string): string {
  return joinQuery(splitQuery(query).filter((part) => part !== tag));
}

export function browserOf(tag: string): string | undefined {
  const words = tag.toLowerCase().split(/\s+/);
  return words.find((word) => (TAG_BROWSERS as readonly string[]).includes(word));
}
