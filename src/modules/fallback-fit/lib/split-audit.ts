import { type CodePointRange, countCodePoints, formatUnicodeRange } from './unicode-range';

export interface FaceRule {
  family: string;
  weight: string;
  style: string;
  unicodeRange?: string | undefined;
}

export type SplitIssueKind = 'latin-split' | 'overlap' | 'late-real-face';

export interface SplitIssue {
  kind: SplitIssueKind;
  family: string;
  weight: string;
  style: string;
  rules: number[];
  characters: string;
  count: number;
}

const MAX_RULES = 1024;
const MAX_TOKENS = 1024;
const MAX_OVERLAP_RULES = 128;
const MAX_ISSUES = 50;
const MIN_OVERLAP = 16;
const MAX_TEXT = 4096;
const MAX_CODE_POINT = 0x10ffff;
const FULL: readonly CodePointRange[] = [[0, MAX_CODE_POINT]];
const BASIC_LATIN: readonly CodePointRange[] = [[0x20, 0x7e]];
const TOKEN = /^u\+(?:([0-9a-f]{1,6})(?:-([0-9a-f]{1,6}))?|([0-9a-f]{0,5}\?{1,6}))$/i;

function merge(ranges: CodePointRange[]): CodePointRange[] {
  ranges.sort((a, b) => a[0] - b[0]);
  const result: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = result[result.length - 1];
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else result.push([start, end]);
  }
  return result;
}

function parseRange(text: string | undefined): readonly CodePointRange[] | null {
  if (text === undefined || text.trim() === '') return FULL;
  if (text.length > MAX_TEXT) return null;
  const tokens = text.split(',');
  if (tokens.length > MAX_TOKENS) return null;
  const ranges: CodePointRange[] = [];
  for (const raw of tokens) {
    const match = TOKEN.exec(raw.trim());
    if (!match) return null;
    let start: number;
    let end: number;
    if (match[3] !== undefined) {
      start = Number.parseInt(match[3].replaceAll('?', '0'), 16);
      end = Number.parseInt(match[3].replaceAll('?', 'f'), 16);
    } else {
      start = Number.parseInt(match[1] ?? '', 16);
      end = match[2] === undefined ? start : Number.parseInt(match[2], 16);
    }
    if (end < start || end > MAX_CODE_POINT) return null;
    ranges.push([start, end]);
  }
  return merge(ranges);
}

function intersect(a: readonly CodePointRange[], b: readonly CodePointRange[]): CodePointRange[] {
  const result: CodePointRange[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const [aStart, aEnd] = a[i] as CodePointRange;
    const [bStart, bEnd] = b[j] as CodePointRange;
    const start = Math.max(aStart, bStart);
    const end = Math.min(aEnd, bEnd);
    if (start <= end) result.push([start, end]);
    if (aEnd < bEnd) i++;
    else j++;
  }
  return result;
}

const SAFE_WEIGHT = /^[1-9]\d{0,3}(?:\s+[1-9]\d{0,3})?$/;
const weightKey = (weight: string) => {
  const value = String(weight).trim().toLowerCase();
  if (value === 'normal') return '400';
  if (value === 'bold') return '700';
  return SAFE_WEIGHT.test(value) ? value.replace(/\s+/g, ' ') : '400';
};

const UNSAFE_TEXT = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu;
const cleanFamily = (family: string) =>
  String(family).replace(UNSAFE_TEXT, ' ').replace(/\s+/g, ' ').trim();
const styleKey = (style: string) => (/italic|oblique/i.test(String(style)) ? 'italic' : 'normal');

interface Parsed {
  index: number;
  ranges: readonly CodePointRange[];
  size: number;
}

function describe(ranges: readonly CodePointRange[]) {
  return { characters: formatUnicodeRange(ranges), count: countCodePoints(ranges) };
}

export function auditSplitFaces(rules: readonly FaceRule[]): SplitIssue[] {
  const groups = new Map<string, { rule: FaceRule; members: Parsed[]; seen: Set<string> }>();
  rules.slice(0, MAX_RULES).forEach((rule, index) => {
    const family = cleanFamily(rule.family).toLowerCase();
    if (!family) return;
    const ranges = parseRange(rule.unicodeRange);
    if (!ranges) return;
    const key = `${family}|${weightKey(rule.weight)}|${styleKey(rule.style)}`;
    let group = groups.get(key);
    if (!group) {
      group = { rule, members: [], seen: new Set() };
      groups.set(key, group);
    }
    const signature = formatUnicodeRange(ranges);
    if (group.seen.has(signature)) return;
    group.seen.add(signature);
    group.members.push({ index, ranges, size: countCodePoints(ranges) });
  });

  const split: SplitIssue[] = [];
  const late: SplitIssue[] = [];
  const overlap: SplitIssue[] = [];
  for (const { rule, members } of groups.values()) {
    if (members.length < 2) continue;
    const label = {
      family: cleanFamily(rule.family),
      weight: weightKey(rule.weight),
      style: styleKey(rule.style),
    };

    const latin = members
      .map((member) => ({ member, part: intersect(member.ranges, BASIC_LATIN) }))
      .filter((item) => item.part.length > 0);
    if (latin.length > 1) {
      const union = merge(latin.flatMap((item) => item.part));
      const unionSize = countCodePoints(union);
      if (!latin.some((item) => countCodePoints(item.part) === unionSize)) {
        split.push({
          kind: 'latin-split',
          ...label,
          rules: latin.map((item) => item.member.index),
          ...describe(union),
        });
      }
    }

    const scan = members.slice(0, MAX_OVERLAP_RULES);
    for (let later = 1; later < scan.length; later++) {
      for (let earlier = 0; earlier < later; earlier++) {
        if (late.length + overlap.length >= MAX_ISSUES) break;
        const first = scan[earlier] as Parsed;
        const second = scan[later] as Parsed;
        const shared = intersect(first.ranges, second.ranges);
        const sharedCount = countCodePoints(shared);
        if (sharedCount < MIN_OVERLAP || sharedCount * 4 < Math.min(first.size, second.size))
          continue;
        const issue: SplitIssue = {
          kind: first.size > second.size ? 'late-real-face' : 'overlap',
          ...label,
          rules: [first.index, second.index],
          characters: formatUnicodeRange(shared),
          count: sharedCount,
        };
        (issue.kind === 'late-real-face' ? late : overlap).push(issue);
      }
    }
  }
  return [...split, ...late, ...overlap].slice(0, MAX_ISSUES);
}
