export type CodePointRange = readonly [start: number, end: number];

export const MAX_CODE_POINT = 0x10ffff;

export class UnicodeRangeError extends Error {
  constructor() {
    super('invalid-unicode-range');
    this.name = 'UnicodeRangeError';
  }
}

const isCodePoint = (value: number) =>
  Number.isInteger(value) && value >= 0 && value <= MAX_CODE_POINT;

const isRange = (start: number, end: number) =>
  isCodePoint(start) && isCodePoint(end) && start <= end;

export function compactRanges(codePoints: Iterable<number>): CodePointRange[] {
  const sorted: number[] = [];
  for (const point of codePoints) {
    if (!isCodePoint(point)) throw new UnicodeRangeError();
    sorted.push(point);
  }
  sorted.sort((a, b) => a - b);
  const ranges: [number, number][] = [];
  for (const point of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && point <= last[1] + 1) last[1] = Math.max(last[1], point);
    else ranges.push([point, point]);
  }
  return ranges;
}

export function expandRanges(ranges: readonly CodePointRange[]): number[] {
  const points: number[] = [];
  for (const [start, end] of ranges) {
    if (!isRange(start, end)) throw new UnicodeRangeError();
    for (let point = start; point <= end; point++) points.push(point);
  }
  return points;
}

export function countCodePoints(ranges: readonly CodePointRange[]): number {
  return ranges.reduce((sum, [start, end]) => sum + end - start + 1, 0);
}

const hex = (value: number) => value.toString(16).toUpperCase();

export function formatUnicodeRange(ranges: readonly CodePointRange[]): string {
  return ranges
    .map(([start, end]) => {
      if (!isRange(start, end)) throw new UnicodeRangeError();
      return start === end ? `U+${hex(start)}` : `U+${hex(start)}-${hex(end)}`;
    })
    .join(', ');
}

const TOKEN = /^U\+([0-9A-Fa-f]{1,6})(?:-([0-9A-Fa-f]{1,6}))?$/;

export function parseUnicodeRange(text: string): CodePointRange[] {
  const ranges: CodePointRange[] = [];
  for (const raw of text.split(',')) {
    const match = TOKEN.exec(raw.trim());
    if (!match) throw new UnicodeRangeError();
    const start = Number.parseInt(match[1] ?? '', 16);
    const end = match[2] === undefined ? start : Number.parseInt(match[2], 16);
    if (!isRange(start, end)) throw new UnicodeRangeError();
    ranges.push([start, end]);
  }
  return compactRanges(expandRanges(ranges));
}

export function intersectCount(a: readonly CodePointRange[], b: readonly CodePointRange[]): number {
  let total = 0;
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const [aStart, aEnd] = a[i] as CodePointRange;
    const [bStart, bEnd] = b[j] as CodePointRange;
    const start = Math.max(aStart, bStart);
    const end = Math.min(aEnd, bEnd);
    if (start <= end) total += end - start + 1;
    if (aEnd < bEnd) i++;
    else j++;
  }
  return total;
}

export const SUBSETS = {
  latin:
    'U+0-FF, U+131, U+152-153, U+2BB-2BC, U+2C6, U+2DA, U+2DC, U+304, U+308, U+329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext':
    'U+100-2BA, U+2BD-2C5, U+2C7-2CC, U+2CE-2D7, U+2DD-2FF, U+304, U+308, U+329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF',
  vietnamese:
    'U+102-103, U+110-111, U+128-129, U+168-169, U+1A0-1A1, U+1AF-1B0, U+300-301, U+303-304, U+308-309, U+323, U+329, U+1EA0-1EF9, U+20AB',
  cyrillic: 'U+301, U+400-45F, U+490-491, U+4B0-4B1, U+2116',
  'cyrillic-ext': 'U+460-52F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F',
  greek: 'U+370-377, U+37A-37F, U+384-38A, U+38C, U+38E-3A1, U+3A3-3FF',
  'greek-ext': 'U+1F00-1FFF',
} as const;

export type SubsetName = keyof typeof SUBSETS;

export interface SubsetCoverage {
  name: SubsetName;
  covered: number;
  total: number;
}

export function subsetCoverage(ranges: readonly CodePointRange[]): SubsetCoverage[] {
  return (Object.keys(SUBSETS) as SubsetName[]).flatMap((name) => {
    const subset = parseUnicodeRange(SUBSETS[name]);
    const covered = intersectCount(ranges, subset);
    return covered > 0 ? [{ name, covered, total: countCodePoints(subset) }] : [];
  });
}
