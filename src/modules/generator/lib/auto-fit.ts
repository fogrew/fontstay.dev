import {
  compassSearch,
  type Dimension,
  type PredictFont,
  type PredictModel,
  scoreOf,
  widthMismatch,
} from '@/modules/layout-shift';
import { adjustmentOf, type Overrides } from './css';
import type { SpacingEm } from './loading';
import type { Candidate } from './per-os';
import { fallbackPredictFont } from './predict-input';

export interface AutoFitInput {
  candidate: Candidate;
  manual: Partial<Overrides>;
  spacing: SpacingEm;
  pinSpacing: { letter: boolean; word: boolean };
  model: PredictModel;
  widthK?: number;
  signal?: AbortSignal | undefined;
  maxEvaluations?: number;
  maxMs?: number;
}

export interface AutoFitResult {
  adjustment: Overrides;
  spacing: SpacingEm;
  before: number;
  after: number;
}

const WORST_WEIGHT = 1;
const SUM_WEIGHT = 0.1;
const WIDTH_WEIGHT = 0.05;

const cost = (model: PredictModel, font: PredictFont) => {
  const scores = scoreOf(model, font).map((item) => item.score);
  return (
    WORST_WEIGHT * Math.max(...scores) +
    SUM_WEIGHT * scores.reduce((sum, score) => sum + score, 0) +
    WIDTH_WEIGHT * widthMismatch(model, font)
  );
};

export async function autoFit(input: AutoFitInput): Promise<AutoFitResult | null> {
  const { candidate, manual, spacing, pinSpacing, model } = input;
  const base = adjustmentOf(candidate.adjustment, manual);
  const dimension = (
    key: string,
    value: number,
    min: number,
    max: number,
    step: number,
    pinned: boolean,
  ): Dimension => ({ key, value, min, max, step, pinned });
  const dimensions = [
    dimension(
      'sizeAdjust',
      base.sizeAdjust,
      base.sizeAdjust * 0.8,
      base.sizeAdjust * 1.2,
      0.01,
      manual.sizeAdjust !== undefined,
    ),
    dimension(
      'ascentOverride',
      base.ascentOverride,
      Math.max(0, base.ascentOverride - 0.3),
      base.ascentOverride + 0.3,
      0.02,
      manual.ascentOverride !== undefined,
    ),
    dimension(
      'descentOverride',
      base.descentOverride,
      Math.max(0, base.descentOverride - 0.3),
      base.descentOverride + 0.3,
      0.02,
      manual.descentOverride !== undefined,
    ),
    dimension(
      'lineGapOverride',
      base.lineGapOverride,
      0,
      base.lineGapOverride + 0.3,
      0.02,
      manual.lineGapOverride !== undefined,
    ),
    dimension('letterSpacing', spacing.letter, -0.03, 0.03, 0.002, pinSpacing.letter),
    dimension('wordSpacing', spacing.word, -0.2, 0.2, 0.01, pinSpacing.word),
  ];
  const fontFor = (v: Record<string, number>) =>
    fallbackPredictFont(
      candidate,
      {
        sizeAdjust: v.sizeAdjust ?? base.sizeAdjust,
        ascentOverride: v.ascentOverride ?? base.ascentOverride,
        descentOverride: v.descentOverride ?? base.descentOverride,
        lineGapOverride: v.lineGapOverride ?? base.lineGapOverride,
      },
      { letter: v.letterSpacing ?? 0, word: v.wordSpacing ?? 0 },
      input.widthK ?? 1,
    );
  if (!fontFor({})) return null;
  let evaluated = 0;
  const result = await compassSearch(
    dimensions,
    async (values) => {
      evaluated += 1;
      if (evaluated % 40 === 0) await new Promise<void>((resolve) => setTimeout(resolve));
      const font = fontFor(values);
      return font ? cost(model, font) : 0;
    },
    {
      maxEvaluations: input.maxEvaluations ?? 800,
      maxMs: input.maxMs ?? 10_000,
      signal: input.signal,
    },
  );
  if (result.stoppedBy === 'aborted' || !Number.isFinite(result.score)) return null;
  const improved = result.score < result.startScore - 1e-9;
  const values = improved
    ? result.values
    : Object.fromEntries(dimensions.map((d) => [d.key, d.value]));
  return {
    adjustment: {
      sizeAdjust: values.sizeAdjust ?? base.sizeAdjust,
      ascentOverride: values.ascentOverride ?? base.ascentOverride,
      descentOverride: values.descentOverride ?? base.descentOverride,
      lineGapOverride: values.lineGapOverride ?? base.lineGapOverride,
    },
    spacing: { letter: values.letterSpacing ?? 0, word: values.wordSpacing ?? 0 },
    before: result.startScore,
    after: Math.min(result.score, result.startScore),
  };
}
