import { GLYPH_EMPTY, GLYPH_ENCODED, type GlyphTable } from '@/modules/font-metrics';

export type GlyphIdMode = 'unencoded' | 'alternates';

export function glyphIds(table: GlyphTable, mode: GlyphIdMode): number[] {
  if (mode === 'alternates') return table.alternates.map((alternate) => alternate.glyph);
  const ids: number[] = [];
  for (let id = 0; id < table.count; id++) {
    if (((table.flags[id] ?? 0) & GLYPH_ENCODED) === 0) ids.push(id);
  }
  return ids;
}

export interface GlyphBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function glyphBounds(table: GlyphTable, id: number): GlyphBounds | null {
  if (id < 0 || id >= table.count || ((table.flags[id] ?? 0) & GLYPH_EMPTY) !== 0) return null;
  const at = id * 4;
  return {
    minX: table.bounds[at] ?? 0,
    minY: table.bounds[at + 1] ?? 0,
    maxX: table.bounds[at + 2] ?? 0,
    maxY: table.bounds[at + 3] ?? 0,
  };
}

export function formatBounds(bounds: GlyphBounds | null): string {
  if (!bounds) return '—';
  const { minX, minY, maxX, maxY } = bounds;
  return `x ${Math.round(minX)}…${Math.round(maxX)} · y ${Math.round(minY)}…${Math.round(maxY)}`;
}
