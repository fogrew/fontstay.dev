export const MAX_GLYPHS = 65535;
export const MAX_GLYPH_ALTERNATES = 20000;
export const MAX_GLYPH_PATH_LENGTH = 100_000;
export const GLYPH_TIMEOUT_MS = 5000;
export const GLYPH_BUDGET_MS = 3000;
export const GSUB_BUDGET_MS = 1000;

export const GLYPH_ENCODED = 1;
export const GLYPH_EMPTY = 2;

export interface GlyphAlternate {
  glyph: number;
  base: number;
  tag: string;
}

export interface GlyphTable {
  count: number;
  truncated: boolean;
  advances: Float64Array;
  bounds: Float64Array;
  flags: Uint8Array;
  alternates: GlyphAlternate[];
}

export type GlyphRequest =
  | { kind: 'table'; buffer: ArrayBuffer }
  | { kind: 'outline'; buffer: ArrayBuffer; glyph: number };

export type GlyphResponse =
  | { ok: true; kind: 'table'; table: GlyphTable }
  | { ok: true; kind: 'outline'; path: string | null }
  | { ok: false };
