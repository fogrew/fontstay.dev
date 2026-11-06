import type { FontMetrics } from '@/modules/font-metrics';
import { autoFit } from './auto-fit';
import { fallbackRatio, webRatio } from './calibration';
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

export function newOptimizerState(): OptimizerState {
  return { spacing: { letter: 0, word: 0 }, free: true };
}

export async function optimizeFaces(
  input: OptimizeFacesInput,
  state: OptimizerState,
): Promise<Map<string, Overrides>> {
  const { metrics, bytes, language, ranking, faces } = input;
  const webK = bytes ? await webRatio(bytes, metrics, language) : 1;
  const model = { web: webPredictFont(metrics, ranking, undefined, webK), language };
  const found = new Map<string, Overrides>();
  for (const [index, candidate] of faces.entries()) {
    const free = state.free && index === 0;
    const result = await autoFit({
      candidate,
      manual: {},
      widthK: fallbackRatio(candidate, language) ?? 1,
      spacing: state.spacing,
      pinSpacing: { letter: !free, word: !free },
      model,
    });
    if (!result) continue;
    found.set(candidate.id, result.adjustment);
    if (free) state.spacing = result.spacing;
  }
  state.free = false;
  return found;
}
