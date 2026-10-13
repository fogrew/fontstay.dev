import {
  type FitAdjustment,
  FitError,
  type FitFont,
  fitFont,
  fitFromAverages,
  languageWeights,
  resolveStack,
  type StackResolution,
  systemFonts,
} from '@/modules/fallback-fit';
import type { FontMetrics } from '@/modules/font-metrics';
import {
  type Block,
  DEFAULT_VIEWPORTS,
  type PredictModel,
  predictViewport,
  sampleBlocks,
  widthMismatch,
} from '@/modules/layout-shift';
import {
  type Category,
  type OsFont,
  type OsId,
  osAvailability,
  osFontMetrics,
  osFontsDataset,
  type StyleVariant,
} from '@/modules/os-fonts';
import { ARTICLES, articleBlocks } from './articles';
import { fallbackPredictFont, webPredictFont } from './predict-input';

export type Language = 'en' | 'ru';
export type FontStyleKey = 'regular' | StyleVariant;

export function styleKeyOf(style: { weight: number; italic: boolean }): FontStyleKey {
  const bold = style.weight >= 600;
  if (bold && style.italic) return 'bold-italic';
  if (bold) return 'bold';
  return style.italic ? 'italic' : 'regular';
}

interface FaceInfo {
  localNames: readonly string[];
  fit: FitFont | null;
  native: Vertical;
}

interface PoolFont {
  id: string;
  family: string;
  localNames: readonly string[];
  category: Category;
  fit: FitFont | null;
  latinWidthEm: number | null;
  native: Vertical;
  dataset: OsFont;
  styles: Partial<Record<StyleVariant, FaceInfo>>;
}

export interface Vertical {
  ascent: number;
  descent: number;
  lineGap: number;
}

function nativeOf(metrics: {
  unitsPerEm: number;
  hhea: { ascent: number; descent: number; lineGap: number };
  typo: { ascent: number; descent: number; lineGap: number; useTypoMetrics: boolean } | null;
}): Vertical {
  const used = metrics.typo?.useTypoMetrics ? metrics.typo : metrics.hhea;
  return {
    ascent: used.ascent / metrics.unitsPerEm,
    descent: Math.abs(used.descent) / metrics.unitsPerEm,
    lineGap: Math.max(0, used.lineGap) / metrics.unitsPerEm,
  };
}

export interface Candidate {
  id: string;
  family: string;
  localNames: readonly string[];
  category: Category;
  adjustment: FitAdjustment;
  coverage: number;
  latinOnly: boolean;
  fit: FitFont | null;
  native: Vertical;
  style: FontStyleKey;
  cost: number;
}

export interface Ranking {
  candidates: Candidate[];
  coverage: number;
  web: { ascent: number; descent: number; lineGap: number };
}

let pool: PoolFont[] | undefined;

function fonts(): PoolFont[] {
  if (pool) return pool;
  const result: PoolFont[] = [];
  const measured = new Set<string>();
  for (const metrics of osFontMetrics()) {
    const dataset = osFontsDataset.fonts.find((font) => font.id === metrics.id);
    if (!dataset) continue;
    measured.add(metrics.id);
    result.push({
      id: metrics.id,
      family: dataset.family,
      localNames: metrics.localNames.length > 0 ? metrics.localNames : [dataset.family],
      category: dataset.category,
      fit: metrics,
      latinWidthEm: null,
      native: nativeOf(metrics),
      dataset,
      get styles() {
        return Object.fromEntries(
          Object.entries(metrics.variants).map(([style, face]) => [
            style,
            {
              localNames: face.localNames.length > 0 ? face.localNames : [dataset.family],
              fit: face,
              native: nativeOf(face),
            },
          ]),
        );
      },
    });
  }
  for (const system of systemFonts) {
    const dataset = osFontsDataset.fonts.find((font) => font.family === system.family);
    if (!dataset || measured.has(dataset.id)) continue;
    result.push({
      id: dataset.id,
      family: dataset.family,
      localNames: system.localNames,
      category: dataset.category,
      fit: null,
      latinWidthEm: system.latinWidthEm,
      native: nativeOf(system.metrics),
      dataset,
      styles: {},
    });
  }
  pool = result;
  return result;
}

function preinstalledOn(font: OsFont, os: OsId): boolean {
  return osAvailability(font, os, osFontsDataset).level === 'preinstalled';
}

function presentOn(font: OsFont, os: OsId): boolean {
  return font.availability.some((entry) => entry.os === os && entry.status === 'preinstalled');
}

export function systemsWithFonts(): OsId[] {
  return (['windows', 'macos', 'ios', 'android', 'linux', 'chromeos'] as const).filter((os) =>
    fonts().some((font) => preinstalledOn(font.dataset, os)),
  );
}

const WIDTH_WEIGHT = 0.05;
const SIZE_WEIGHT = 0.05;

const documents = new Map<Language, Block[][]>();

function documentsFor(language: Language): Block[][] {
  const cached = documents.get(language);
  if (cached) return cached;
  const list = [sampleBlocks(language), articleBlocks(ARTICLES[language === 'ru' ? 'ru' : 'en'])];
  documents.set(language, list);
  return list;
}

function predictedCost(candidate: Candidate, model: PredictModel): number {
  const font = fallbackPredictFont(candidate, candidate.adjustment, { letter: 0, word: 0 });
  if (!font) return 1;
  const scores = documentsFor(model.language).flatMap((blocks) =>
    DEFAULT_VIEWPORTS.map((viewport) => predictViewport(model.web, font, blocks, viewport).score),
  );
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return (
    Math.max(...scores) +
    mean +
    WIDTH_WEIGHT * widthMismatch(model, font) +
    SIZE_WEIGHT * Math.abs(Math.log(candidate.adjustment.sizeAdjust))
  );
}

export function rankFor(
  web: FontMetrics,
  os: OsId,
  language: Language,
  style: FontStyleKey = 'regular',
): Ranking {
  const weights = languageWeights(language);
  const own = fitFont(web, web, weights);
  const model = {
    web: webPredictFont(web, {
      web: {
        ascent: own.ascentOverride,
        descent: own.descentOverride,
        lineGap: own.lineGapOverride,
      },
    }),
    language,
  };
  const candidates: Candidate[] = [];
  for (const base of fonts()) {
    if (!preinstalledOn(base.dataset, os)) continue;
    const variant = style === 'regular' ? undefined : base.styles[style];
    const font = variant ? { ...base, ...variant } : base;
    try {
      if (font.fit) {
        const result = fitFont(web, font.fit, weights);
        const candidate: Candidate = {
          id: font.id,
          family: font.family,
          localNames: font.localNames,
          category: font.category,
          adjustment: result,
          coverage: own.coverage > 0 ? Math.min(1, result.coverage / own.coverage) : 0,
          latinOnly: false,
          fit: font.fit,
          native: font.native,
          style: variant ? style : 'regular',
          cost: 1,
        };
        candidate.cost = predictedCost(candidate, model);
        candidates.push(candidate);
      } else if (font.latinWidthEm !== null && language === 'en') {
        candidates.push({
          id: font.id,
          family: font.family,
          localNames: font.localNames,
          category: font.category,
          adjustment: fitFromAverages(web, own.targetWidthEm, font.latinWidthEm),
          coverage: 1,
          latinOnly: true,
          fit: null,
          native: font.native,
          style: 'regular',
          cost: 1,
        });
      }
    } catch (failure) {
      if (!(failure instanceof FitError)) throw failure;
    }
  }
  candidates.sort(
    (a, b) =>
      Number(b.coverage >= 0.95) - Number(a.coverage >= 0.95) ||
      a.cost - b.cost ||
      Math.abs(Math.log(a.adjustment.sizeAdjust)) - Math.abs(Math.log(b.adjustment.sizeAdjust)),
  );
  return {
    candidates,
    coverage: own.coverage,
    web: {
      ascent: own.ascentOverride,
      descent: own.descentOverride,
      lineGap: own.lineGapOverride,
    },
  };
}

export interface SystemPick {
  os: OsId;
  share: number;
  faceId: string;
}

export interface Plan {
  order: string[];
  resolution: StackResolution;
}

export function rankKey(os: string, rank: number): string {
  return rank === 0 ? os : `${os}#${rank + 1}`;
}

export function planStack(picks: readonly SystemPick[], order?: readonly string[]): Plan {
  const ranked = [...picks].sort((a, b) => b.share - a.share);
  const defaults = [...new Set(ranked.map((pick) => pick.faceId))];
  const valid =
    order &&
    order.length === defaults.length &&
    defaults.every((id) => order.includes(id)) &&
    new Set(order).size === order.length;
  const finalOrder = valid ? [...order] : defaults;
  const byId = new Map(fonts().map((font) => [font.id, font]));

  const bySystem = new Map<OsId, string[]>();
  for (const pick of picks) bySystem.set(pick.os, [...(bySystem.get(pick.os) ?? []), pick.faceId]);

  const availability = new Map<string, string[]>(finalOrder.map((id) => [id, []]));
  const preferences: { platform: string; preferredFace: string }[] = [];
  for (const [os, list] of bySystem) {
    for (const [rank, faceId] of list.entries()) {
      const key = rankKey(os, rank);
      preferences.push({ platform: key, preferredFace: faceId });
      const earlier = new Set(list.slice(0, rank));
      for (const id of finalOrder) {
        const font = byId.get(id);
        if (font && presentOn(font.dataset, os) && !earlier.has(id))
          availability.get(id)?.push(key);
      }
    }
  }
  const faces = finalOrder.map((id) => ({ id, availableOn: availability.get(id) ?? [] }));
  return { order: finalOrder, resolution: resolveStack(faces, preferences) };
}

export function candidateById(id: string) {
  return fonts().find((font) => font.id === id);
}

const COST_TOLERANCE = 0.004;
const COST_RELATIVE = 0.5;

export function consolidate(
  lists: Partial<Record<OsId, readonly Candidate[]>>,
  shares: Partial<Record<OsId, number>>,
): Partial<Record<OsId, Candidate>> {
  const best = new Map<OsId, Candidate>();
  for (const [os, list] of Object.entries(lists) as [OsId, readonly Candidate[]][]) {
    const first = list[0];
    if (first) best.set(os, first);
  }
  const acceptable = (os: OsId, candidate: Candidate) => {
    const top = best.get(os);
    return (
      top !== undefined &&
      candidate.coverage >= 0.95 &&
      candidate.cost <= top.cost + Math.max(COST_TOLERANCE, top.cost * COST_RELATIVE)
    );
  };
  const options = new Map<string, Candidate>();
  for (const list of Object.values(lists))
    for (const item of list ?? []) options.set(item.id, item);
  const result: Partial<Record<OsId, Candidate>> = {};
  let pending = [...best.keys()];
  while (pending.length > 0) {
    let choice: { candidate: Candidate; covers: OsId[]; share: number } | undefined;
    for (const candidate of options.values()) {
      const covers = pending.filter(
        (os) => lists[os]?.some((item) => item.id === candidate.id) && acceptable(os, candidate),
      );
      if (covers.length === 0) continue;
      const share = covers.reduce((sum, os) => sum + (shares[os] ?? 0), 0);
      if (
        !choice ||
        share > choice.share ||
        (share === choice.share && candidate.cost < choice.candidate.cost)
      ) {
        choice = { candidate, covers, share };
      }
    }
    if (!choice) break;
    for (const os of choice.covers) {
      const match = lists[os]?.find((item) => item.id === choice?.candidate.id);
      if (match) result[os] = match;
    }
    pending = pending.filter((os) => !choice?.covers.includes(os));
  }
  for (const [os, candidate] of best) result[os] ??= candidate;
  return result;
}
