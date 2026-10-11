import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  compactRanges,
  countCodePoints,
  expandRanges,
  formatUnicodeRange,
  intersectCount,
  parseUnicodeRange,
  SUBSETS,
  subsetCoverage,
  UnicodeRangeError,
} from './unicode-range';

const points = fc.array(fc.integer({ min: 0, max: 0x10ffff }), { maxLength: 300 });
const dense = fc.array(fc.integer({ min: 0x20, max: 0x400 }), { maxLength: 300 });
const GRAMMAR = /^U\+[0-9A-F]{1,6}(-[0-9A-F]{1,6})?(, U\+[0-9A-F]{1,6}(-[0-9A-F]{1,6})?)*$/;

describe('compactRanges', () => {
  it('merges adjacent code points and keeps gaps', () => {
    expect(compactRanges([0x41, 0x43, 0x42, 0x44, 0x61, 0x41])).toEqual([
      [0x41, 0x44],
      [0x61, 0x61],
    ]);
  });

  it('is lossless', () => {
    fc.assert(
      fc.property(points, (input) => {
        expect(expandRanges(compactRanges(input))).toEqual(
          [...new Set(input)].sort((a, b) => a - b),
        );
      }),
    );
  });

  it('produces sorted, disjoint, non-adjacent ranges', () => {
    fc.assert(
      fc.property(dense, (input) => {
        const ranges = compactRanges(input);
        for (let index = 1; index < ranges.length; index++) {
          expect((ranges[index]?.[0] ?? 0) - (ranges[index - 1]?.[1] ?? 0)).toBeGreaterThan(1);
        }
        expect(countCodePoints(ranges)).toBe(new Set(input).size);
      }),
    );
  });

  it('rejects invalid code points', () => {
    expect(() => compactRanges([0x110000])).toThrow(UnicodeRangeError);
    expect(() => compactRanges([-1])).toThrow(UnicodeRangeError);
    expect(() => compactRanges([1.5])).toThrow(UnicodeRangeError);
  });
});

describe('formatUnicodeRange', () => {
  it('writes valid CSS descriptors', () => {
    expect(
      formatUnicodeRange([
        [0x20, 0x7e],
        [0xa0, 0xa0],
      ]),
    ).toBe('U+20-7E, U+A0');
  });

  it('round-trips through the parser and matches the CSS grammar', () => {
    fc.assert(
      fc.property(points, (input) => {
        const ranges = compactRanges(input);
        if (ranges.length === 0) return;
        const text = formatUnicodeRange(ranges);
        expect(text).toMatch(GRAMMAR);
        expect(parseUnicodeRange(text)).toEqual(ranges);
      }),
    );
  });
});

describe('parseUnicodeRange', () => {
  it.each(['', 'U+', 'U+110000', 'U+20-10', 'u+zz', 'U+20 U+30', 'U+1234567'])(
    'rejects %j',
    (text) => {
      expect(() => parseUnicodeRange(text)).toThrow(UnicodeRangeError);
    },
  );
});

describe('subsetCoverage', () => {
  it('reports the named subsets a font touches', () => {
    const ascii = compactRanges(Array.from({ length: 95 }, (_, index) => 0x20 + index));
    const cyrillic = compactRanges(Array.from({ length: 64 }, (_, index) => 0x410 + index));
    const result = subsetCoverage(
      compactRanges([...expandRanges(ascii), ...expandRanges(cyrillic)]),
    );
    expect(result.map((item) => item.name)).toEqual(['latin', 'cyrillic']);
    expect(result.find((item) => item.name === 'latin')?.covered).toBe(95);
  });

  it('has valid subset definitions', () => {
    for (const text of Object.values(SUBSETS)) expect(() => parseUnicodeRange(text)).not.toThrow();
  });

  it('intersects sorted ranges', () => {
    expect(
      intersectCount(
        [
          [1, 10],
          [20, 30],
        ],
        [[5, 22]],
      ),
    ).toBe(6 + 3);
  });
});
