import { describe, expect, it } from 'vitest';
import type { FontMetrics } from '@/modules/font-metrics';
import { glyphAdvance, glyphVertical } from './glyph-detail';

describe('glyph detail', () => {
  it('looks up the advance of a covered code point and returns 0 for others', () => {
    const points = Uint32Array.from([32, 65, 66, 0x1f600]);
    const advances = Float64Array.from([200, 600, 590, 1000]);
    expect(glyphAdvance(points, advances, 65)).toBe(600);
    expect(glyphAdvance(points, advances, 0x1f600)).toBe(1000);
    expect(glyphAdvance(points, advances, 67)).toBe(0);
  });

  it('prefers the typo vertical metrics and falls back to hhea', () => {
    const base = { unitsPerEm: 0, hhea: { ascent: 900, descent: -200, lineGap: 0 } };
    expect(glyphVertical(base as unknown as FontMetrics)).toEqual({
      em: 1000,
      ascent: 900,
      descent: -200,
    });
    const typo = { ...base, unitsPerEm: 2048, typo: { ascent: 1500, descent: -400, lineGap: 0 } };
    expect(glyphVertical(typo as unknown as FontMetrics)).toEqual({
      em: 2048,
      ascent: 1500,
      descent: -400,
    });
  });
});
