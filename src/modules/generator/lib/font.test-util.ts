import type { FontMetrics } from '@/modules/font-metrics';

export function font(codePoints: number[], advance: number): FontMetrics {
  return {
    names: { family: 'Test', fullName: 'Test', postscript: 'Test' },
    unitsPerEm: 1000,
    hhea: { ascent: 900, descent: -200, lineGap: 0 },
    typo: null,
    win: null,
    capHeight: null,
    xHeight: null,
    codePoints: Uint32Array.from(codePoints),
    advances: Float64Array.from(codePoints, () => advance),
    isVariable: false,
    style: { weight: 400, italic: false, category: null },
  };
}
