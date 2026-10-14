import {
  compactRanges,
  type FitAdjustment,
  FitError,
  type FitFont,
  fitFont,
  formatUnicodeRange,
  type GlyphWeight,
  languageWeights,
} from '@/modules/fallback-fit';
import type { FontMetrics } from '@/modules/font-metrics';
import type { Language } from './per-os';

export const SCRIPT_IDS = ['latin', 'cyrillic', 'greek'] as const;
export type ScriptId = (typeof SCRIPT_IDS)[number];

type Span = readonly [number, number];

const SPANS: Record<ScriptId, readonly Span[]> = {
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

const rangeOf = (spans: readonly Span[]) =>
  formatUnicodeRange(spans.map(([from, to]): [number, number] => [from, to]));

const MIN_LETTERS = 20;
const SCRIPT_TOLERANCE = 0.01;

const GREEK_FREQUENCIES: Record<string, number> = {
  α: 11,
  ο: 9.5,
  ε: 8.5,
  τ: 8,
  ι: 7.5,
  ν: 7,
  σ: 6,
  ς: 2.5,
  ρ: 5,
  η: 4.5,
  κ: 4.5,
  π: 4,
  μ: 3.5,
  υ: 3.5,
  λ: 3,
  δ: 2.5,
  ω: 2,
  γ: 1.5,
  χ: 1.2,
  θ: 1,
  φ: 0.9,
  β: 0.6,
  ξ: 0.5,
  ζ: 0.4,
  ψ: 0.3,
  ά: 0.8,
  έ: 0.8,
  ή: 0.5,
  ί: 0.6,
  ό: 0.9,
  ύ: 0.4,
  ώ: 0.4,
};

const inScript = (codePoint: number, script: ScriptId) =>
  SPANS[script].some(([from, to]) => codePoint >= from && codePoint <= to);

const detected = new WeakMap<object, ScriptId[]>();

export function detectScripts(codePoints: ArrayLike<number>): ScriptId[] {
  const cached = detected.get(codePoints);
  if (cached) return cached;
  const counts: Record<ScriptId, number> = { latin: 0, cyrillic: 0, greek: 0 };
  for (let index = 0; index < codePoints.length; index++) {
    const codePoint = codePoints[index] as number;
    for (const script of SCRIPT_IDS) {
      if (inScript(codePoint, script) && /\p{L}/u.test(String.fromCodePoint(codePoint))) {
        counts[script]++;
      }
    }
  }
  const result = SCRIPT_IDS.filter((script) => counts[script] >= MIN_LETTERS);
  detected.set(codePoints, result);
  return result;
}

export const primaryScript = (language: Language): ScriptId =>
  language === 'ru' ? 'cyrillic' : 'latin';

export function scriptWeights(script: ScriptId): GlyphWeight[] {
  if (script === 'greek') {
    return Object.entries(GREEK_FREQUENCIES).map(([char, weight]) => ({
      codePoint: char.codePointAt(0) ?? 0,
      weight,
    }));
  }
  return languageWeights(script === 'cyrillic' ? 'ru' : 'en').filter(
    ({ codePoint }) =>
      /\p{L}/u.test(String.fromCodePoint(codePoint)) && inScript(codePoint, script),
  );
}

const fits = new WeakMap<object, WeakMap<object, Map<ScriptId, FitAdjustment | null>>>();

function scriptFit(
  web: FontMetrics,
  fallback: FitFont | null,
  script: ScriptId,
): FitAdjustment | null {
  if (!fallback) return null;
  const byFallback = fits.get(web) ?? new WeakMap();
  fits.set(web, byFallback);
  const byScript = byFallback.get(fallback) ?? new Map();
  byFallback.set(fallback, byScript);
  if (byScript.has(script)) return byScript.get(script) ?? null;
  let result: FitAdjustment | null = null;
  try {
    result = fitFont(web, fallback, scriptWeights(script));
  } catch (failure) {
    if (!(failure instanceof FitError)) throw failure;
  }
  byScript.set(script, result);
  return result;
}

export interface Applied {
  sizeAdjust: number;
  ascentOverride: number;
  descentOverride: number;
  lineGapOverride: number;
}

export interface ScriptOverride {
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
  coveredOnly = false,
): ScriptOverride[] {
  const primary = primaryScript(language);
  const scale = applied.sizeAdjust / fitted.sizeAdjust;
  const faces: ScriptOverride[] = [];
  for (const script of detectScripts(web.codePoints)) {
    if (script === primary) continue;
    const fit = scriptFit(web, fallback, script);
    if (!fit) continue;
    if (Math.abs(fit.sizeAdjust / fitted.sizeAdjust - 1) < SCRIPT_TOLERANCE) continue;
    const sizeAdjust = fit.sizeAdjust * scale;
    const ratio = applied.sizeAdjust / sizeAdjust;
    const own = coveredOnly
      ? compactRanges([...web.codePoints].filter((codePoint) => inScript(codePoint, script)))
      : undefined;
    faces.push({
      script,
      unicodeRange: own ? formatUnicodeRange(own) : rangeOf(SPANS[script]),
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
