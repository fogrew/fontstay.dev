export interface VerticalMetrics {
  ascent: number;
  descent: number;
  lineGap: number;
}

export type FontCategory = 'sans-serif' | 'serif' | 'monospace';

export interface FontStyleInfo {
  weight: number;
  italic: boolean;
  category: FontCategory | null;
}

export interface FontMetrics {
  names: { family: string | null; fullName: string | null; postscript: string | null };
  unitsPerEm: number;
  hhea: VerticalMetrics;
  typo: (VerticalMetrics & { useTypoMetrics: boolean }) | null;
  win: { ascent: number; descent: number } | null;
  capHeight: number | null;
  xHeight: number | null;
  codePoints: Uint32Array;
  advances: Float64Array;
  isVariable: boolean;
  style: FontStyleInfo;
}

export const FONT_PARSE_ERROR_CODES = [
  'too-large',
  'invalid-font',
  'unsupported-format',
  'timeout',
  'worker-error',
  'busy',
  'disposed',
] as const;

export type FontParseErrorCode = (typeof FONT_PARSE_ERROR_CODES)[number];

export type FontParseResult =
  | { ok: true; font: FontMetrics }
  | { ok: false; error: { code: FontParseErrorCode } };

export const MAX_FONT_BYTES = 10 * 1024 * 1024;
export const MAX_DECODED_BYTES = 64 * 1024 * 1024;
export const MAX_TABLES = 256;
export const MAX_CMAP_ENTRIES = 100_000;
export const FONT_PARSE_TIMEOUT_MS = 5000;

export class FontParseError extends Error {
  constructor(public readonly code: FontParseErrorCode) {
    super(code);
    this.name = 'FontParseError';
  }
}
