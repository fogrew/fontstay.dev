import type { FontMetrics } from '@/modules/font-metrics';
import { type PredictFont, type SampleLanguage, samples, textWidth } from '@/modules/layout-shift';
import type { Candidate } from './per-os';

const PROBE_PX = 100;
const MIN_RATIO = 0.9;
const MAX_RATIO = 1.1;
const BASES = ['monospace', 'serif', 'sans-serif'] as const;

let counter = 0;

export function corpusOf(language: SampleLanguage): string {
  const sample = samples[language];
  return [sample.intro, ...sample.paragraphs, ...sample.items, sample.quote].join(' ');
}

const clamp = (ratio: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));

function context(): CanvasRenderingContext2D | null {
  return document.createElement('canvas').getContext('2d');
}

function widthOf(canvas: CanvasRenderingContext2D, family: string, text: string): number {
  canvas.font = `${PROBE_PX}px ${family}`;
  return canvas.measureText(text).width;
}

function modelFont(metrics: {
  unitsPerEm: number;
  codePoints: ArrayLike<number>;
  advances: ArrayLike<number>;
}): PredictFont {
  return {
    unitsPerEm: metrics.unitsPerEm,
    codePoints: metrics.codePoints,
    advances: metrics.advances,
    scale: 1,
    ascent: 0,
    descent: 0,
    lineGap: 0,
    letterEm: 0,
    wordEm: 0,
  };
}

export async function webRatio(
  bytes: ArrayBuffer,
  metrics: FontMetrics,
  language: SampleLanguage,
): Promise<number> {
  const family = `ff-calibration-${counter++}`;
  const face = new FontFace(family, bytes.slice(0));
  try {
    await face.load();
    document.fonts.add(face);
    const canvas = context();
    const text = corpusOf(language);
    const model = textWidth(modelFont(metrics), text, PROBE_PX);
    if (!canvas || model <= 0) return 1;
    return clamp(widthOf(canvas, `"${family}"`, text) / model);
  } catch {
    return 1;
  } finally {
    document.fonts.delete(face);
  }
}

export function fallbackRatio(candidate: Candidate, language: SampleLanguage): number | null {
  const canvas = context();
  if (!canvas || !candidate.fit) return null;
  const text = corpusOf(language);
  const model = textWidth(modelFont(candidate.fit), text, PROBE_PX);
  if (model <= 0) return null;
  for (const name of candidate.localNames) {
    const quoted = JSON.stringify(name);
    const found = BASES.some(
      (base) => widthOf(canvas, `${quoted}, ${base}`, text) !== widthOf(canvas, base, text),
    );
    if (found) return clamp(widthOf(canvas, `${quoted}, monospace`, text) / model);
  }
  return null;
}
