export interface VerticalMetrics {
  ascent: number;
  descent: number;
  lineGap: number;
}

export type FontCategory = 'sans-serif' | 'serif' | 'monospace' | 'cursive';

export interface FontStyleInfo {
  weight: number;
  italic: boolean;
  category: FontCategory | null;
}

export type LayoutTable = 'GSUB' | 'GPOS';

export interface FontFeature {
  tag: string;
  tables: LayoutTable[];
  label: string | null;
}

export interface FontAxis {
  tag: string;
  name: string;
  min: number;
  default: number;
  max: number;
}

export interface FontInstance {
  name: string;
  coordinates: Record<string, number>;
}

export interface FontPalettes {
  entries: number;
  palettes: string[][];
}

export interface FontNames {
  copyright: string | null;
  version: string | null;
  designer: string | null;
  manufacturer: string | null;
  description: string | null;
  license: string | null;
  licenseUrl: string | null;
  vendorUrl: string | null;
  designerUrl: string | null;
}

export interface FontDetails {
  features: FontFeature[];
  scripts: string[];
  axes: FontAxis[];
  instances: FontInstance[];
  names: FontNames;
  colorFormats: string[];
  palettes: FontPalettes | null;
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
  details: FontDetails;
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
export const MAX_FEATURES = 1024;
export const MAX_SCRIPTS = 128;
export const MAX_AXES = 64;
export const MAX_INSTANCES = 256;
export const MAX_PALETTES = 64;
export const MAX_PALETTE_ENTRIES = 512;
export const MAX_NAME_LENGTH = 2000;
export const FONT_PARSE_TIMEOUT_MS = 5000;

export class FontParseError extends Error {
  constructor(public readonly code: FontParseErrorCode) {
    super(code);
    this.name = 'FontParseError';
  }
}
