import type { FontMetrics } from '@/modules/font-metrics';
import type { PredictModel } from '@/modules/layout-shift';
import { type AutoFitResult, autoFit } from './auto-fit';
import { fallbackRatio, measureWebRatio } from './calibration';
import type { Overrides } from './css';
import type { SpacingEm } from './loading';
import type { Candidate, Language, Ranking } from './per-os';
import { webPredictFont } from './predict-input';

export interface OptimizerState {
  spacing: SpacingEm;
  free: boolean;
}

export interface OptimizeFacesInput {
  metrics: FontMetrics;
  bytes?: ArrayBuffer | Uint8Array | undefined;
  language: Language;
  ranking: Pick<Ranking, 'web'>;
  faces: readonly Candidate[];
}

export interface FaceStepInput {
  candidate: Candidate;
  manual?: Partial<Overrides>;
  widthK: number;
  model: PredictModel;
  spacing: SpacingEm;
  free: boolean;
  manualSpacing?: { letter: boolean; word: boolean };
  signal?: AbortSignal | undefined;
}

export function optimizeFace(input: FaceStepInput): Promise<AutoFitResult | null> {
  const { candidate, manual, widthK, model, spacing, free, manualSpacing, signal } = input;
  return autoFit({
    candidate,
    manual: manual ?? {},
    widthK,
    spacing,
    pinSpacing: { letter: !free || !!manualSpacing?.letter, word: !free || !!manualSpacing?.word },
    model,
    signal,
  });
}

export function newOptimizerState(): OptimizerState {
  return { spacing: { letter: 0, word: 0 }, free: true };
}

export async function optimizeFaces(
  input: OptimizeFacesInput,
  state: OptimizerState,
): Promise<{ found: Map<string, Overrides>; webRatioFailed: boolean }> {
  const { metrics, bytes, language, ranking, faces } = input;
  const measured = bytes ? await measureWebRatio(bytes, metrics, language) : undefined;
  const webK = measured?.ratio ?? 1;
  const model = { web: webPredictFont(metrics, ranking, undefined, webK), language };
  const found = new Map<string, Overrides>();
  for (const [index, candidate] of faces.entries()) {
    const free = state.free && index === 0;
    const result = await optimizeFace({
      candidate,
      widthK: fallbackRatio(candidate, language) ?? 1,
      model,
      spacing: state.spacing,
      free,
    });
    if (!result) continue;
    found.set(candidate.id, result.adjustment);
    if (free) state.spacing = result.spacing;
  }
  state.free = false;
  return { found, webRatioFailed: measured?.failed ?? false };
}
