import {
  type FitAdjustment,
  FitError,
  type FitFont,
  fitFont,
  type GlyphWeight,
  languageWeights,
} from '@/modules/fallback-fit';
import type { FontMetrics } from '@/modules/font-metrics';
import type { Language } from './per-os';

export const SCRIPT_IDS = ['latin', 'cyrillic', 'greek'] as const;
export type ScriptId = (typeof SCRIPT_IDS)[number];

type Span = readonly [number, number];

const LETTERS: Record<ScriptId, readonly Span[]> = {
  latin: [
    [0x41, 0x5a],
    [0x61, 0x7a],
    [0xc0, 0x24f],
    [0x1e00, 0x1eff],
  ],
  cyrillic: [
    [0x400, 0x52f],
    [0x1c80, 0x1c8f],
    [0x2de0, 0x2dff],
    [0xa640, 0xa69f],
  ],
  greek: [
    [0x370, 0x3ff],
    [0x1f00, 0x1fff],
  ],
};

export const SCRIPT_RANGES: Record<ScriptId, string> = {
  latin: 'U+0000-024F, U+1E00-1EFF',
  cyrillic: 'U+0400-052F, U+1C80-1C8F, U+2DE0-2DFF, U+A640-A69F',
  greek: 'U+0370-03FF, U+1F00-1FFF',
};

const MIN_LETTERS = 20;
export const SCRIPT_TOLERANCE = 0.01;

const GREEK_LETTERS = 'αβγδεζηθικλμνξοπρστυφχψως';

const inScript = (codePoint: number, script: ScriptId) =>
  LETTERS[script].some(([from, to]) => codePoint >= from && codePoint <= to);

export function detectScripts(codePoints: ArrayLike<number>): ScriptId[] {
  const counts: Record<ScriptId, number> = { latin: 0, cyrillic: 0, greek: 0 };
  for (let index = 0; index < codePoints.length; index++) {
    const codePoint = codePoints[index] as number;
    if (!/\p{L}/u.test(String.fromCodePoint(codePoint))) continue;
    for (const script of SCRIPT_IDS) if (inScript(codePoint, script)) counts[script]++;
  }
  return SCRIPT_IDS.filter((script) => counts[script] >= MIN_LETTERS);
}

export const primaryScript = (language: Language): ScriptId =>
  language === 'ru' ? 'cyrillic' : 'latin';

export function scriptWeights(script: ScriptId): GlyphWeight[] {
  if (script === 'greek') {
    return [...GREEK_LETTERS].map((char) => ({ codePoint: char.codePointAt(0) ?? 0, weight: 1 }));
  }
  const source = languageWeights(script === 'cyrillic' ? 'ru' : 'en');
  return source.filter(
    ({ codePoint }) =>
      /\p{L}/u.test(String.fromCodePoint(codePoint)) && inScript(codePoint, script),
  );
}

export function scriptFit(
  web: FontMetrics,
  fallback: FitFont | null,
  script: ScriptId,
): FitAdjustment | null {
  if (!fallback) return null;
  try {
    return fitFont(web, fallback, scriptWeights(script));
  } catch (failure) {
    if (failure instanceof FitError) return null;
    throw failure;
  }
}

export interface Applied {
  sizeAdjust: number;
  ascentOverride: number;
  descentOverride: number;
  lineGapOverride: number;
}

export interface ScriptFace {
  script: ScriptId;
  unicodeRange: string;
  adjustment: Applied;
}

export function scriptFaces(
  web: FontMetrics,
  fallback: FitFont | null,
  language: Language,
  fitted: FitAdjustment,
  applied: Applied,
): ScriptFace[] {
  const primary = primaryScript(language);
  const scale = applied.sizeAdjust / fitted.sizeAdjust;
  const faces: ScriptFace[] = [];
  for (const script of detectScripts(web.codePoints)) {
    if (script === primary) continue;
    const fit = scriptFit(web, fallback, script);
    if (!fit) continue;
    if (Math.abs(fit.sizeAdjust / fitted.sizeAdjust - 1) < SCRIPT_TOLERANCE) continue;
    const sizeAdjust = fit.sizeAdjust * scale;
    const ratio = applied.sizeAdjust / sizeAdjust;
    faces.push({
      script,
      unicodeRange: SCRIPT_RANGES[script],
      adjustment: {
        sizeAdjust,
        ascentOverride: applied.ascentOverride * ratio,
        descentOverride: applied.descentOverride * ratio,
        lineGapOverride: applied.lineGapOverride * ratio,
      },
    });
  }
  return faces;
}
