import { sampleBlocks } from './document';
import { type PredictFont, predictViewport, textWidth } from './predict';
import { type SampleLanguage, samples } from './samples';
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

export function widthMismatch(model: PredictModel, font: PredictFont): number {
  const sample = samples[model.language];
  const text = [sample.intro, ...sample.paragraphs, ...sample.items, sample.quote].join(' ');
  const web = textWidth(model.web, text);
  return web > 0 ? Math.abs(textWidth(font, text) / web - 1) : 0;
}
