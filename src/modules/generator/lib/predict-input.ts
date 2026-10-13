import type { FontMetrics } from '@/modules/font-metrics';
import type { PredictFont } from '@/modules/layout-shift';
import type { Overrides } from './css';
import type { SpacingEm } from './loading';
import type { Candidate, Ranking } from './per-os';

export const STRATEGY_LINE_HEIGHT = 1.4;

export function webPredictFont(
  web: FontMetrics,
  ranking: Pick<Ranking, 'web'>,
  lineHeightEm?: number,
  widthFactor = 1,
): PredictFont {
  return {
    unitsPerEm: web.unitsPerEm,
    codePoints: web.codePoints,
    advances: web.advances,
    scale: widthFactor,
    ascent: ranking.web.ascent,
    descent: ranking.web.descent,
    lineGap: ranking.web.lineGap,
    letterEm: 0,
    wordEm: 0,
    lineHeightEm,
  };
}

export type Variant = 'full' | 'partial' | 'none';

export function variantPredictFont(
  candidate: Candidate,
  adjustment: Overrides,
  spacing: SpacingEm,
  variant: Variant,
  widthK = 1,
): PredictFont | null {
  if (variant === 'full') return fallbackPredictFont(candidate, adjustment, spacing, widthK);
  if (!candidate.fit) return null;
  const scale = variant === 'partial' ? adjustment.sizeAdjust : 1;
  const native = candidate.native;
  return {
    unitsPerEm: candidate.fit.unitsPerEm,
    codePoints: candidate.fit.codePoints,
    advances: candidate.fit.advances,
    scale: scale * widthK,
    ascent: native.ascent * scale,
    descent: native.descent * scale,
    lineGap: native.lineGap * scale,
    letterEm: variant === 'partial' ? spacing.letter : 0,
    wordEm: variant === 'partial' ? spacing.word : 0,
    lineHeightEm: variant === 'partial' ? STRATEGY_LINE_HEIGHT : undefined,
  };
}

export function fallbackPredictFont(
  candidate: Candidate,
  adjustment: Overrides,
  spacing: SpacingEm,
  widthK = 1,
): PredictFont | null {
  if (!candidate.fit) return null;
  const scale = adjustment.sizeAdjust;
  return {
    unitsPerEm: candidate.fit.unitsPerEm,
    codePoints: candidate.fit.codePoints,
    advances: candidate.fit.advances,
    scale: scale * widthK,
    ascent: adjustment.ascentOverride * scale,
    descent: adjustment.descentOverride * scale,
    lineGap: adjustment.lineGapOverride * scale,
    letterEm: spacing.letter,
    wordEm: spacing.word,
  };
}
