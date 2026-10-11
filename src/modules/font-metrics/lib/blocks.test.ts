import { describe, expect, it } from 'vitest';
import { blockCoverage, unicodeBlocks } from './blocks';

describe('unicode blocks', () => {
  it('are sorted, disjoint and start at Basic Latin', () => {
    const list = unicodeBlocks();
    expect(list[0]).toEqual({ name: 'Basic Latin', start: 0, end: 127 });
    for (let index = 1; index < list.length; index++) {
      expect(list[index]?.start ?? 0).toBeGreaterThan(list[index - 1]?.end ?? 0);
    }
  });

  it('counts the covered code points per touched block', () => {
    const ascii = Array.from({ length: 95 }, (_, index) => 0x20 + index);
    const result = blockCoverage([...ascii, 0x410, 0x411, 0x20ac]);
    expect(result).toEqual([
      { name: 'Basic Latin', start: 0, end: 127, covered: 95, total: 128 },
      { name: 'Cyrillic', start: 0x400, end: 0x4ff, covered: 2, total: 256 },
      { name: 'Currency Symbols', start: 0x20a0, end: 0x20cf, covered: 1, total: 48 },
    ]);
  });

  it('ignores code points outside any block', () => {
    expect(blockCoverage([0x2fe0])).toEqual([]);
  });
});
