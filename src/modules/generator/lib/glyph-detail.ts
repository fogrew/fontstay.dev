import type { FontMetrics } from '@/modules/font-metrics';

export const GLYPH_FAMILY = 'ff-preview-web';

export function glyphAdvance(points: Uint32Array, advances: Float64Array, point: number): number {
  let low = 0;
  let high = points.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (points[middle] === point) return advances[middle] ?? 0;
    if ((points[middle] ?? 0) < point) low = middle + 1;
    else high = middle - 1;
  }
  return 0;
}

export interface GlyphVertical {
  em: number;
  ascent: number;
  descent: number;
}

export function glyphVertical(metrics: FontMetrics): GlyphVertical {
  return {
    em: metrics.unitsPerEm || 1000,
    ascent: metrics.typo?.ascent ?? metrics.hhea.ascent,
    descent: metrics.typo?.descent ?? metrics.hhea.descent,
  };
}
