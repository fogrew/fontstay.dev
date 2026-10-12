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

export const INCLUDE_TAGS: readonly string[] = [
  'baseline widely available',
  'baseline newly available',
  'defaults',
  '> 0.5%',
  '> 1%',
  'last 2 versions',
  'cover 95%',
  ...TAG_BROWSERS.filter((id) => id !== 'op_mini').map((id) => `last 2 ${id} versions`),
];

export const EXCLUDE_TAGS: readonly string[] = [
  'not dead',
  'not op_mini all',
  ...TAG_BROWSERS.filter((id) => id !== 'op_mini').map((id) => `not ${id} > 0`),
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
