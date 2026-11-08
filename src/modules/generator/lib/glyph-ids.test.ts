import { describe, expect, it } from 'vitest';
import { GLYPH_EMPTY, GLYPH_ENCODED, type GlyphTable } from '@/modules/font-metrics';
import { formatBounds, glyphBounds, glyphIds } from './glyph-ids';

const table: GlyphTable = {
  count: 4,
  truncated: false,
  advances: Float64Array.of(500, 600, 0, 700),
  bounds: Float64Array.of(0, 0, 0, 0, 10.4, -5, 590.6, 700, 0, 0, 0, 0, 0, 0, 700, 650),
  flags: Uint8Array.of(GLYPH_ENCODED | GLYPH_EMPTY, GLYPH_ENCODED, GLYPH_EMPTY, 0),
  alternates: [{ glyph: 3, base: 1, tag: 'smcp' }],
};

describe('glyph ids', () => {
  it('lists glyphs that no character reaches', () => {
    expect(glyphIds(table, 'unencoded')).toEqual([2, 3]);
  });

  it('lists substituted glyphs', () => {
    expect(glyphIds(table, 'alternates')).toEqual([3]);
  });

  it('returns bounds only for glyphs with an outline', () => {
    expect(glyphBounds(table, 0)).toBeNull();
    expect(glyphBounds(table, 2)).toBeNull();
    expect(glyphBounds(table, 9)).toBeNull();
    expect(glyphBounds(table, 1)).toEqual({ minX: 10.4, minY: -5, maxX: 590.6, maxY: 700 });
  });

  it('formats rounded bounds', () => {
    expect(formatBounds(glyphBounds(table, 1))).toBe('x 10…591 · y -5…700');
    expect(formatBounds(null)).toBe('—');
  });
});
