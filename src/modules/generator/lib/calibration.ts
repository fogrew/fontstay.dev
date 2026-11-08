import type { FontMetrics } from '@/modules/font-metrics';
import { type PredictFont, type SampleLanguage, samples, textWidth } from '@/modules/layout-shift';
import type { Candidate } from './per-os';
import { type ShapeOptions, shapedWidthEm } from './shaping';

const PROBE_PX = 100;
const MIN_RATIO = 0.9;
const MAX_RATIO = 1.1;

export function corpusOf(language: SampleLanguage): string {
  const sample = samples[language];
  return [sample.intro, ...sample.paragraphs, ...sample.items, sample.quote].join(' ');
}

const clamp = (ratio: number) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));

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

export async function shapedRatio(
  bytes: ArrayBuffer | Uint8Array,
  metrics: Pick<FontMetrics, 'unitsPerEm' | 'codePoints' | 'advances'>,
  language: SampleLanguage,
  options: ShapeOptions = {},
): Promise<number> {
  const text = corpusOf(language);
  const model = textWidth(modelFont(metrics), text, PROBE_PX);
  if (model <= 0) return 1;
  const shaped = await shapedWidthEm(bytes, text, options);
  if (!(shaped > 0)) throw new Error('Shaping produced no width');
  return clamp(shaped * (PROBE_PX / model));
}

export async function measureWebRatio(
  bytes: ArrayBuffer | Uint8Array,
  metrics: FontMetrics,
  language: SampleLanguage,
): Promise<{ ratio: number; failed: boolean }> {
  try {
    return { ratio: await shapedRatio(bytes, metrics, language), failed: false };
  } catch {
    return { ratio: 1, failed: true };
  }
}

export async function webRatio(
  bytes: ArrayBuffer | Uint8Array,
  metrics: FontMetrics,
  language: SampleLanguage,
): Promise<number> {
  return (await measureWebRatio(bytes, metrics, language)).ratio;
}

export function fallbackRatio(candidate: Candidate, language: SampleLanguage): number | null {
  return candidate.fit?.ratios?.[language] ?? null;
}
