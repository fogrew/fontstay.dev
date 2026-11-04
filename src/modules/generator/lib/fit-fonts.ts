import {
  computeOsShares,
  DEFAULT_DESKTOP_SPLIT,
  DEFAULT_QUERY,
  descriptorSupport,
  lacksVerticalOverrides,
  type OsShares,
  resolveQuery,
  splitOsQuery,
} from '@/modules/audience';
import { CssExportError, type ExportInput } from '@/modules/export';
import { compactRanges, formatUnicodeRange, StackResolveError } from '@/modules/fallback-fit';
import type { FontMetrics } from '@/modules/font-metrics';
import { type Category, loadVariantMetrics, type OsId } from '@/modules/os-fonts';
import { fitLanguage, isNoCoverage } from './compute';
import { adjustmentOf, buildCss, fallbackFamilyName } from './css';
import { loadingCss, loadingScript } from './loading';
import { type FontOutput, groupFonts, mergeOutputs } from './overview';
import {
  type Candidate,
  consolidate,
  type FontStyleKey,
  type Language,
  planStack,
  type Ranking,
  rankFor,
  styleKeyOf,
  systemsWithFonts,
} from './per-os';
import { STRATEGY_LINE_HEIGHT } from './predict-input';
import { aspectOf, safariStrategyCss } from './safari';
import { scriptFaces } from './scripts';

const MIN_SHARE = 1;
const ALL_SYSTEMS = ['windows', 'macos', 'ios', 'android', 'linux', 'chromeos'] as const;

export type FitErrorCode = 'invalid-audience' | 'no-systems' | 'no-fit';

export class FitRunError extends Error {
  readonly code: FitErrorCode;

  constructor(code: FitErrorCode, message: string) {
    super(message);
    this.name = 'FitRunError';
    this.code = code;
  }
}

export interface FitFontInput {
  fileName: string;
  metrics: FontMetrics;
  kind?: Category | undefined;
}

export interface FitOptions {
  fonts: readonly FitFontInput[];
  audience?: string | undefined;
  systems?: readonly OsId[] | undefined;
  locale?: Language | undefined;
  unicodeRange?: boolean | undefined;
  scripts?: boolean | undefined;
}

export interface FitFontReport {
  fileName: string;
  family: string;
  kind: Category;
  language: Language;
  coverage: number;
  picks: { system: OsId; share: number; family: string }[];
  fallbackFamilies: string[];
}

export interface FitResult {
  input: ExportInput;
  fonts: FitFontReport[];
  shares: Partial<Record<OsId, number>>;
  systems: OsId[];
  uncovered: OsId[];
  audience: { query: string; browsers: number };
}

interface Picked {
  os: OsId;
  share: number;
  faceId: string;
  candidate: Candidate;
}

function shortFamily(metrics: FontMetrics): string {
  return metrics.names.family?.trim().slice(0, 200) || 'Custom font';
}

function fitFont(
  font: FitFontInput,
  systems: readonly OsId[],
  shares: OsShares,
  options: FitOptions,
  strategy: boolean,
): { output: FontOutput; report: FitFontReport } | undefined {
  const { metrics } = font;
  const language = fitLanguage(metrics, options.locale ?? 'en');
  const style: FontStyleKey = styleKeyOf(metrics.style);
  const kind: Category = font.kind ?? metrics.style.category ?? 'sans-serif';

  let coverage = 1;
  const lists: Partial<Record<OsId, Candidate[]>> = {};
  for (const os of systems) {
    let ranking: Ranking;
    try {
      ranking = rankFor(metrics, os, language, style);
    } catch (thrown) {
      if (!isNoCoverage(thrown)) throw thrown;
      continue;
    }
    coverage = Math.min(coverage, ranking.coverage);
    lists[os] = ranking.candidates.filter((item) => item.category === kind);
  }
  const defaults = consolidate(lists, shares);
  const chosen: Picked[] = systems.flatMap((os) => {
    const all = lists[os];
    if (!all) return [];
    const pick = defaults[os] ?? all[0];
    return pick ? [{ os, share: shares[os], faceId: pick.id, candidate: pick }] : [];
  });
  if (chosen.length === 0) return undefined;

  let plan: ReturnType<typeof planStack>;
  try {
    plan = planStack(chosen);
    const suggestion = plan.resolution.suggestion?.order;
    if (suggestion) plan = planStack(chosen, suggestion);
  } catch (failure) {
    if (failure instanceof StackResolveError) return undefined;
    throw failure;
  }

  const ranges = compactRanges(metrics.codePoints);
  const range = options.unicodeRange && ranges.length > 0 ? formatUnicodeRange(ranges) : undefined;
  const perScript = options.scripts ?? true;
  const faces = plan.order.flatMap((id) => {
    const candidate = chosen.find((item) => item.faceId === id)?.candidate;
    if (!candidate) return [];
    const adjustment = adjustmentOf(candidate.adjustment, {});
    return [
      {
        family: candidate.family,
        localNames: candidate.localNames,
        adjustment,
        scripts: perScript
          ? scriptFaces(
              metrics,
              candidate.fit,
              language,
              candidate.adjustment,
              adjustment,
              options.unicodeRange ?? false,
            ).map(({ unicodeRange, adjustment: scriptAdjustment }) => ({
              unicodeRange,
              adjustment: scriptAdjustment,
            }))
          : undefined,
        unicodeRange: range,
        fontWeight: style === 'bold' || style === 'bold-italic' ? 700 : undefined,
        fontStyle: style === 'italic' || style === 'bold-italic' ? ('italic' as const) : undefined,
      },
    ];
  });
  const family = shortFamily(metrics);
  let css: ReturnType<typeof buildCss>;
  try {
    css = buildCss(family, faces, kind);
  } catch (failure) {
    if (failure instanceof CssExportError) return undefined;
    throw failure;
  }
  const aspect = aspectOf(metrics);
  const fallbackFamilies = faces.map((face) =>
    fallbackFamilyName(family, face.family, faces.length),
  );
  return {
    output: {
      targetFamily: family,
      generic: kind,
      fontFaces: css.fontFaces,
      families: css.families,
      strategy: strategy && aspect !== null ? safariStrategyCss(aspect, STRATEGY_LINE_HEIGHT) : '',
      fileName: font.fileName,
      weight: style.includes('bold') ? 700 : 400,
      style: style.includes('italic') ? 'italic' : 'normal',
    },
    report: {
      fileName: font.fileName,
      family,
      kind,
      language,
      coverage,
      picks: chosen.map((item) => ({
        system: item.os,
        share: item.share,
        family: item.candidate.family,
      })),
      fallbackFamilies,
    },
  };
}

export async function fitFonts(options: FitOptions): Promise<FitResult> {
  const query = options.audience?.trim() || DEFAULT_QUERY;
  const osQuery = splitOsQuery(query);
  const resolution = await resolveQuery(osQuery.browsers || DEFAULT_QUERY);
  if (!resolution.ok) {
    throw new FitRunError(
      'invalid-audience',
      `Invalid audience "${query}": ${resolution.detail || resolution.code}`,
    );
  }
  const wanted = options.systems ? new Set<string>(options.systems) : undefined;
  const shares = computeOsShares(
    resolution.entries,
    DEFAULT_DESKTOP_SPLIT,
    (os) =>
      !osQuery.exclude.includes(os) &&
      (osQuery.include.length === 0 || osQuery.include.includes(os)) &&
      (!wanted || wanted.has(os)),
  );
  const systems = systemsWithFonts()
    .filter((os) => shares[os] >= MIN_SHARE)
    .sort((a, b) => shares[b] - shares[a]);
  if (systems.length === 0) {
    throw new FitRunError('no-systems', 'No system in the audience has fallback fonts to fit.');
  }
  if (options.fonts.some((font) => styleKeyOf(font.metrics.style) !== 'regular')) {
    await loadVariantMetrics();
  }
  const strategy = lacksVerticalOverrides(descriptorSupport(resolution.entries)) > 0.05;
  const outputs: FontOutput[] = [];
  const reports: FitFontReport[] = [];
  for (const font of options.fonts) {
    const fitted = fitFont(font, systems, shares, options, strategy);
    if (!fitted) {
      throw new FitRunError('no-fit', `No fallback could be fitted for ${font.fileName}.`);
    }
    outputs.push(fitted.output);
    reports.push(fitted.report);
  }
  const families = groupFonts(outputs);
  const input: ExportInput = {
    families,
    fontFaces: [
      ...new Set(outputs.flatMap((entry) => entry.fontFaces.split('\n\n')).filter(Boolean)),
    ].join('\n\n'),
    strategy: outputs[0]?.strategy ?? '',
    css: mergeOutputs(outputs, loadingCss({ letter: 0, word: 0 })),
    loadingScript: loadingScript(families.map((family) => family.targetFamily)),
  };
  const uncovered = ALL_SYSTEMS.filter((os) => shares[os] >= MIN_SHARE && !systems.includes(os));
  return {
    input,
    fonts: reports,
    shares: Object.fromEntries(systems.map((os) => [os, shares[os]])),
    systems,
    uncovered,
    audience: { query, browsers: resolution.count },
  };
}
