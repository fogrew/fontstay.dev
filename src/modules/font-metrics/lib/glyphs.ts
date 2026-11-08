import { create } from 'fontkitten';
import { tableBytes } from './details';
import {
  GLYPH_BUDGET_MS,
  GLYPH_EMPTY,
  GLYPH_ENCODED,
  type GlyphAlternate,
  type GlyphTable,
  GSUB_BUDGET_MS,
  MAX_GLYPH_ALTERNATES,
  MAX_GLYPH_PATH_LENGTH,
  MAX_GLYPHS,
} from './glyph-model';
import { FontParseError, MAX_CMAP_ENTRIES, MAX_FEATURES } from './model';
import { validateFontBuffer } from './validate';

const MAX_READS = 2_000_000;
const MAX_RANGES = 4096;
const CLOCK_INTERVAL = 4096;
const FEATURE_TAG = /^[A-Za-z0-9]{4}$/;

class BudgetError extends Error {}

function openFont(buffer: ArrayBuffer) {
  validateFontBuffer(buffer);
  const font = create(new Uint8Array(buffer) as Parameters<typeof create>[0]);
  if (font.isCollection) throw new FontParseError('unsupported-format');
  return font;
}

function readSubstitutions(bytes: Uint8Array, glyphs: number, deadline: number): GlyphAlternate[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let reads = 0;
  let clockAt = 0;
  const charge = (units: number) => {
    reads += units;
    if (reads > MAX_READS) throw new BudgetError();
    if (reads >= clockAt) {
      clockAt = reads + CLOCK_INTERVAL;
      if (Date.now() > deadline) throw new BudgetError();
    }
  };
  const check = (offset: number, size: number) => {
    if (offset < 0 || offset + size > view.byteLength) {
      throw new RangeError('layout table out of bounds');
    }
    charge(1);
  };
  const u16 = (offset: number) => {
    check(offset, 2);
    return view.getUint16(offset);
  };
  const u32 = (offset: number) => {
    check(offset, 4);
    return view.getUint32(offset);
  };
  const found = new Map<number, GlyphAlternate>();
  const add = (glyph: number, base: number, tag: string) => {
    if (glyph < glyphs && base < glyphs && glyph !== base && !found.has(glyph)) {
      if (found.size >= MAX_GLYPH_ALTERNATES) throw new RangeError('too many alternates');
      found.set(glyph, { glyph, base, tag });
    }
  };

  const coverage = (offset: number): number[] => {
    const format = u16(offset);
    const out: number[] = [];
    if (format === 1) {
      const count = Math.min(u16(offset + 2), glyphs);
      for (let i = 0; i < count; i++) out[i] = u16(offset + 4 + i * 2);
    } else if (format === 2) {
      const count = Math.min(u16(offset + 2), MAX_RANGES);
      for (let i = 0; i < count; i++) {
        const record = offset + 4 + i * 6;
        const start = u16(record);
        const end = Math.min(u16(record + 2), glyphs - 1);
        const index = u16(record + 4);
        charge(Math.max(0, end - start + 1));
        for (let glyph = start; glyph <= end; glyph++) {
          if (index + glyph - start < glyphs) out[index + glyph - start] = glyph;
        }
      }
    }
    return out;
  };

  const parsed = new Set<number>();
  const subtable = (type: number, offset: number, tag: string): void => {
    if (parsed.has(offset)) return;
    parsed.add(offset);
    if (type === 7) {
      if (u16(offset) !== 1) return;
      const inner = u16(offset + 2);
      if (inner !== 7) subtable(inner, offset + u32(offset + 4), tag);
      return;
    }
    if (type !== 1 && type !== 3 && type !== 4) return;
    const format = u16(offset);
    const covered = coverage(offset + u16(offset + 2));
    charge(covered.length);
    if (type === 1) {
      if (format === 1) {
        const delta = (u16(offset + 4) << 16) >> 16;
        covered.forEach((glyph) => {
          add((glyph + delta) & 0xffff, glyph, tag);
        });
      } else if (format === 2) {
        const count = u16(offset + 4);
        covered.forEach((glyph, index) => {
          if (index < count) add(u16(offset + 6 + index * 2), glyph, tag);
        });
      }
      return;
    }
    if (format !== 1) return;
    const sets = u16(offset + 4);
    covered.forEach((glyph, index) => {
      if (index >= sets) return;
      const set = offset + u16(offset + 6 + index * 2);
      const count = u16(set);
      for (let i = 0; i < count; i++) {
        if (type === 3) add(u16(set + 2 + i * 2), glyph, tag);
        else add(u16(set + u16(set + 2 + i * 2)), glyph, tag);
      }
    });
  };

  try {
    const featureList = u16(6);
    const lookupList = u16(8);
    if (!featureList || !lookupList) return [];
    const lookupCount = u16(lookupList);
    const seen = new Set<number>();
    const featureCount = Math.min(u16(featureList), MAX_FEATURES);
    for (let f = 0; f < featureCount; f++) {
      const record = featureList + 2 + f * 6;
      check(record, 6);
      const tag = String.fromCharCode(...bytes.subarray(record, record + 4));
      if (!FEATURE_TAG.test(tag)) continue;
      const feature = featureList + u16(record + 4);
      const indices = u16(feature + 2);
      for (let i = 0; i < indices; i++) {
        const index = u16(feature + 4 + i * 2);
        if (index >= lookupCount || seen.has(index)) continue;
        seen.add(index);
        const lookup = lookupList + u16(lookupList + 2 + index * 2);
        const type = u16(lookup);
        const subtables = u16(lookup + 4);
        for (let s = 0; s < subtables; s++) {
          try {
            subtable(type, lookup + u16(lookup + 6 + s * 2), tag);
          } catch (error) {
            if (error instanceof BudgetError) throw error;
            if (found.size >= MAX_GLYPH_ALTERNATES) throw error;
          }
        }
      }
    }
  } catch {
    // A malformed GSUB table keeps the substitutions found so far.
  }
  return [...found.values()].sort((a, b) => a.glyph - b.glyph);
}

export function readGlyphTable(
  buffer: ArrayBuffer,
  deadline = Date.now() + GLYPH_BUDGET_MS,
): GlyphTable {
  try {
    const font = openFont(buffer);
    const declared = font.numGlyphs;
    if (!Number.isInteger(declared) || declared < 1) throw new FontParseError('invalid-font');
    const total = Math.min(declared, MAX_GLYPHS);
    const advances = new Float64Array(total);
    const bounds = new Float64Array(total * 4);
    const flags = new Uint8Array(total);
    const points = font.characterSet;
    if (points.length > MAX_CMAP_ENTRIES) throw new FontParseError('too-large');
    for (const point of points) {
      const id = font.glyphForCodePoint(point).id;
      if (id >= 0 && id < total) flags[id] = (flags[id] ?? 0) | GLYPH_ENCODED;
    }
    let count = 0;
    for (; count < total; count++) {
      if ((count & 255) === 0 && Date.now() > deadline) break;
      try {
        const glyph = font.getGlyph(count);
        const width = glyph.advanceWidth;
        const { minX, minY, maxX, maxY } = glyph.cbox;
        advances[count] = Number.isFinite(width) && width >= 0 && width <= 65535 ? width : 0;
        if ([minX, minY, maxX, maxY].every(Number.isFinite) && maxX >= minX && maxY >= minY) {
          bounds.set([minX, minY, maxX, maxY], count * 4);
        } else {
          flags[count] = (flags[count] ?? 0) | GLYPH_EMPTY;
        }
      } catch {
        flags[count] = (flags[count] ?? 0) | GLYPH_EMPTY;
      }
    }
    const gsub = tableBytes(font as unknown as Parameters<typeof tableBytes>[0], 'GSUB');
    return {
      count,
      truncated: count < declared,
      advances: advances.slice(0, count),
      bounds: bounds.slice(0, count * 4),
      flags: flags.slice(0, count),
      alternates:
        gsub && gsub.length >= 10
          ? readSubstitutions(gsub, count, Date.now() + GSUB_BUDGET_MS)
          : [],
    };
  } catch (error) {
    if (error instanceof FontParseError) throw error;
    throw new FontParseError('invalid-font');
  }
}

export function readGlyphOutline(buffer: ArrayBuffer, glyph: number): string | null {
  try {
    const font = openFont(buffer);
    if (!Number.isInteger(glyph) || glyph < 0 || glyph >= Math.min(font.numGlyphs, MAX_GLYPHS)) {
      return null;
    }
    const path = font.getGlyph(glyph).path.toSVG();
    return typeof path === 'string' && path.length <= MAX_GLYPH_PATH_LENGTH ? path : null;
  } catch {
    return null;
  }
}
