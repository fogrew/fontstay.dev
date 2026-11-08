import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCollection, buildFont } from './forged.test-util';
import { GLYPH_ENCODED } from './glyph-model';
import { readGlyphOutline, readGlyphTable } from './glyphs';
import { FontParseError } from './model';

function fixture(name: string): ArrayBuffer {
  const bytes = readFileSync(new URL(`../../../../tests/fixtures/fonts/${name}`, import.meta.url));
  return Uint8Array.from(bytes).buffer;
}

describe('glyph table', () => {
  const table = readGlyphTable(fixture('SourceSansPro-Regular.otf'));

  it('lists every glyph with its advance and bounds', () => {
    expect(table.count).toBeGreaterThan(500);
    expect(table.truncated).toBe(false);
    expect(table.advances).toHaveLength(table.count);
    expect(table.bounds).toHaveLength(table.count * 4);
    expect(table.advances.some((advance) => advance === 544)).toBe(true);
  });

  it('flags encoded glyphs and leaves unencoded ones unflagged', () => {
    const encoded = table.flags.filter((flag) => flag & GLYPH_ENCODED).length;
    expect(encoded).toBeGreaterThan(100);
    expect(encoded).toBeLessThan(table.count);
  });

  it('collects substituted glyphs with their feature tag and base glyph', () => {
    expect(table.alternates.length).toBeGreaterThan(0);
    for (const alternate of table.alternates) {
      expect(alternate.tag).toMatch(/^[A-Za-z0-9]{4}$/);
      expect(alternate.glyph).toBeLessThan(table.count);
      expect(alternate.base).toBeLessThan(table.count);
    }
    const glyphs = table.alternates.map((alternate) => alternate.glyph);
    expect(glyphs).toEqual([...glyphs].sort((a, b) => a - b));
    expect(new Set(glyphs).size).toBe(glyphs.length);
  });

  it('stops at the deadline and reports truncation', () => {
    const cut = readGlyphTable(fixture('SourceSansPro-Regular.otf'), 0);
    expect(cut.truncated).toBe(true);
    expect(cut.count).toBeLessThan(table.count);
  });

  it('handles a font without a GSUB table', () => {
    const forged = readGlyphTable(buildFont([[65, 66, 1]]));
    expect(forged.count).toBe(3);
    expect(forged.alternates).toEqual([]);
    expect(forged.flags[0]).toBe(0);
    expect(forged.flags[1]).toBe(GLYPH_ENCODED);
  });

  it('rejects collections and garbage', () => {
    expect(() => readGlyphTable(buildCollection([buildFont([[65, 65, 1]])]))).toThrow(
      FontParseError,
    );
    expect(() => readGlyphTable(new ArrayBuffer(64))).toThrow(FontParseError);
  });
});

describe('glyph outline', () => {
  it('returns SVG path data for a glyph with an outline', () => {
    const path = readGlyphOutline(fixture('SourceSansPro-Regular.otf'), 5);
    expect(path).toMatch(/^M/);
  });

  it('returns null for an out-of-range glyph or invalid font', () => {
    expect(readGlyphOutline(fixture('SourceSansPro-Regular.otf'), 99999)).toBeNull();
    expect(readGlyphOutline(fixture('SourceSansPro-Regular.otf'), -1)).toBeNull();
    expect(readGlyphOutline(new ArrayBuffer(64), 1)).toBeNull();
  });
});
