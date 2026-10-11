import { sampleBlocks } from './document';
import { type PredictFont, predictViewport } from './predict';
import type { SampleLanguage } from './samples';
import type { ViewportResult } from './score';
import { DEFAULT_VIEWPORTS } from './simulate';

export interface PredictModel {
  web: PredictFont;
  language: SampleLanguage;
}

export function scoreOf(
  model: PredictModel,
  font: PredictFont,
  viewports = DEFAULT_VIEWPORTS,
): ViewportResult[] {
  const blocks = sampleBlocks(model.language);
  return viewports.map((viewport) => predictViewport(model.web, font, blocks, viewport));
}

export function worstShift(model: PredictModel, font: PredictFont): number {
  return Math.max(...scoreOf(model, font).map((result) => result.score));
}
