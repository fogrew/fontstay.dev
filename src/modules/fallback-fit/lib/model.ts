export interface LineMetrics {
  ascent: number;
  descent: number;
  lineGap: number;
}

export interface FitMetrics {
  unitsPerEm: number;
  hhea: LineMetrics;
  typo: (LineMetrics & { useTypoMetrics: boolean }) | null;
  win: { ascent: number; descent: number } | null;
}

export interface FitFont extends FitMetrics {
  codePoints: Uint32Array;
  advances: Float64Array;
  ratios?: Partial<Record<string, number>> | undefined;
}

export interface GlyphWeight {
  codePoint: number;
  weight: number;
}

export type MetricsSource = 'hhea' | 'typo' | 'win';
export type MetricsPolicy = MetricsSource | 'freetype';

export interface FitAdjustment {
  sizeAdjust: number;
  ascentOverride: number;
  descentOverride: number;
  lineGapOverride: number;
  metricsSource: MetricsSource;
  lineGapClamped: boolean;
}

export interface FontFit extends FitAdjustment {
  targetWidthEm: number;
  fallbackWidthEm: number;
  coverage: number;
  missingTarget: number[];
  missingFallback: number[];
}

export class FitError extends Error {
  constructor(
    public readonly code:
      | 'invalid-font'
      | 'invalid-weights'
      | 'missing-metrics'
      | 'no-shared-glyphs'
      | 'zero-width'
      | 'invalid-adjustment',
  ) {
    super(code);
    this.name = 'FitError';
  }
}
