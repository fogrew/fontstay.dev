import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import {
  Accordion,
  Button,
  CodeBlock,
  Disclosure,
  FitField,
  type FitValue,
  LiveRegion,
  Select,
} from '@/common/ui';
import {
  type AudienceData,
  AudienceEditor,
  buildMatrix,
  DEFAULT_DESKTOP_SPLIT,
  descriptorSupport,
  lacksVerticalOverrides,
  type OsShares,
  SupportMatrix,
  type SystemInfo,
} from '@/modules/audience';
import { CssExportError } from '@/modules/export';
import { StackResolveError } from '@/modules/fallback-fit';
import {
  createFontParser,
  type FontMetrics,
  type FontParser,
  MAX_FONT_BYTES,
} from '@/modules/font-metrics';
import { LayoutShiftPanel, type PanelInput, ratingOf, worstShift } from '@/modules/layout-shift';
import type { Category, OsId } from '@/modules/os-fonts';
import { autoFit } from '../lib/auto-fit';
import { fitLanguage, isNoCoverage, LOW_COVERAGE, sampleText } from '../lib/compute';
import {
  adjustmentOf,
  buildCss,
  fallbackFamilyName,
  fallbackRule,
  type Overrides,
} from '../lib/css';
import { hasSpacing, loadingCss, loadingScript, type SpacingEm } from '../lib/loading';
import {
  type Candidate,
  type Language,
  planStack,
  type Ranking,
  rankFor,
  systemsWithFonts,
} from '../lib/per-os';
import {
  STRATEGY_LINE_HEIGHT,
  type Variant,
  variantPredictFont,
  webPredictFont,
} from '../lib/predict-input';
import { aspectOf, safariStrategyCss } from '../lib/safari';
import { FontUpload } from './FontUpload';
import { Preview } from './Preview';
import './generator.css';

interface LoadedFont {
  id: number;
  fileName: string;
  metrics: FontMetrics;
  bytes: ArrayBuffer;
}

const MAX_FONTS = 8;
const MIN_SHARE = 1;
const MAX_FACES = 16;
const ALL_SYSTEMS = ['windows', 'macos', 'ios', 'android', 'linux', 'chromeos'] as const;

type Field = keyof Overrides;
type Values = Record<Field, FitValue>;

const FIELDS = [
  { key: 'sizeAdjust', label: 'fit_size_label', min: 25, max: 400 },
  { key: 'ascentOverride', label: 'fit_ascent_label', min: 0, max: 400 },
  { key: 'descentOverride', label: 'fit_descent_label', min: 0, max: 400 },
  { key: 'lineGapOverride', label: 'fit_line_gap_label', min: 0, max: 400 },
] as const;

const AUTO: Values = {
  sizeAdjust: { mode: 'auto' },
  ascentOverride: { mode: 'auto' },
  descentOverride: { mode: 'auto' },
  lineGapOverride: { mode: 'auto' },
};

export function GeneratorApp({ locale }: { locale: Locale }) {
  const t = messagesFor(locale);
  const errors: Record<string, string> = {
    'too-large': t.error_too_large(),
    'invalid-font': t.error_invalid_font(),
    'unsupported-format': t.error_unsupported_format(),
    timeout: t.error_timeout(),
    'worker-error': t.error_worker_error(),
    busy: t.error_busy(),
    disposed: t.error_disposed(),
  };
  const parser = useRef<FontParser>();
  const nextId = useRef(1);
  const [fonts, setFonts] = useState<LoadedFont[]>([]);
  const [selectedId, setSelectedId] = useState<number>();
  const [kindChoice, setKindChoice] = useState<{ fontId: number | undefined; kind: Category }>();
  const [shares, setShares] = useState<OsShares>();
  const [manualSystems, setManualSystems] = useState(false);
  const [audience, setAudience] = useState<AudienceData>();
  const [enabledSystems, setEnabledSystems] = useState<Partial<Record<OsId, boolean>>>({});
  const [activeOs, setActiveOs] = useState<OsId>();
  const [picks, setPicks] = useState<Partial<Record<OsId, string[]>>>({});
  const [editId, setEditId] = useState<string>();
  const [focusSlot, setFocusSlot] = useState<number>();
  const [values, setValues] = useState<Record<string, Values>>({});
  const [optimized, setOptimized] = useState<Record<string, Partial<Overrides>>>({});
  const [spacingResult, setSpacingResult] = useState<{ key: string; value: SpacingEm }>();
  const [spacingOn, setSpacingOn] = useState(false);
  const [fitting, setFitting] = useState(false);
  const [spacingValues, setSpacingValues] = useState<{ letter: FitValue; word: FitValue }>({
    letter: { mode: 'auto' },
    word: { mode: 'auto' },
  });
  const handleShares = useCallback((next: OsShares, mode: 'browsers' | 'manual') => {
    setShares(next);
    setManualSystems(mode === 'manual');
  }, []);
  const resetOptimization = () => {
    setOptimized({});
    setSpacingResult(undefined);
  };
  const [planNote, setPlanNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  useEffect(() => () => parser.current?.dispose(), []);
  useEffect(() => {
    if (focusSlot === undefined) return;
    document.querySelector<HTMLElement>(`[data-slot="${focusSlot}"] select`)?.focus();
    setFocusSlot(undefined);
  }, [focusSlot]);

  const addFiles = async (files: File[]) => {
    if (files.length === 0 || busy) return;
    parser.current ??= createFontParser();
    setBusy(true);
    setError('');
    setAnnouncement(t.upload_reading());
    const added: LoadedFont[] = [];
    const failures: string[] = [];
    try {
      for (const file of files) {
        if (fonts.length + added.length >= MAX_FONTS) {
          failures.push(`${file.name}: ${t.error_too_many()}`);
          continue;
        }
        if (file.size > MAX_FONT_BYTES) {
          failures.push(`${file.name}: ${t.error_too_large()}`);
          continue;
        }
        try {
          const buffer = await file.arrayBuffer();
          const bytes = buffer.slice(0);
          const result = await parser.current.parse(buffer);
          if (result.ok) {
            added.push({ id: nextId.current++, fileName: file.name, metrics: result.font, bytes });
          } else {
            failures.push(`${file.name}: ${errors[result.error.code] ?? t.error_invalid_font()}`);
          }
        } catch {
          failures.push(`${file.name}: ${t.error_worker_error()}`);
        }
      }
    } finally {
      setBusy(false);
    }
    setError(failures.join(' '));
    if (added.length > 0) {
      setFonts((current) => [...current, ...added]);
      setSelectedId((current) => current ?? added[0]?.id);
      setAnnouncement(`${t.upload_added()}: ${fonts.length + added.length}`);
    } else {
      setAnnouncement('');
    }
  };

  const selected = fonts.find((font) => font.id === selectedId) ?? fonts[0];
  const language: Language = fitLanguage(selected?.metrics, locale);
  const kind: Category =
    kindChoice && kindChoice.fontId === selected?.id
      ? kindChoice.kind
      : (selected?.metrics.style.category ?? 'sans-serif');

  const systems = useMemo(() => {
    if (!shares) return [];
    return systemsWithFonts()
      .filter((os) => shares[os] >= MIN_SHARE)
      .sort((a, b) => shares[b] - shares[a]);
  }, [shares]);
  const uncovered = shares
    ? ALL_SYSTEMS.filter((os) => shares[os] >= MIN_SHARE && !systems.includes(os))
    : [];

  const rankings = useMemo(() => {
    const result: Partial<Record<OsId, Ranking>> = {};
    let noCoverage = false;
    if (selected) {
      for (const os of systems) {
        try {
          result[os] = rankFor(selected.metrics, os, language);
        } catch (thrown) {
          if (!isNoCoverage(thrown)) throw thrown;
          noCoverage = true;
        }
      }
    }
    return { result, noCoverage };
  }, [selected, systems, language]);

  const candidatesOf = (os: OsId): Candidate[] =>
    (rankings.result[os]?.candidates ?? []).filter((item) => item.category === kind);
  const listFor = (os: OsId): Candidate[] => {
    const all = candidatesOf(os);
    const explicit = (picks[os] ?? []).flatMap((id) => all.find((item) => item.id === id) ?? []);
    return explicit.length > 0 ? explicit : all.slice(0, 1);
  };

  const current = activeOs && systems.includes(activeOs) ? activeOs : systems[0];
  const currentList = current ? listFor(current) : [];
  const currentCandidates = current ? candidatesOf(current) : [];
  const currentPick = currentList.find((item) => item.id === editId) ?? currentList[0];
  const setList = (os: OsId, next: Candidate[]) =>
    setPicks((all) => ({ ...all, [os]: next.map((item) => item.id) }));
  const coverage = Math.min(
    1,
    ...Object.values(rankings.result).map((ranking) => ranking?.coverage ?? 1),
  );

  const valueKey = (id: string) => `${selected?.id ?? 0}:${id}`;
  const baseOf = (candidate: Candidate) => ({
    ...candidate.adjustment,
    ...optimized[valueKey(candidate.id)],
  });
  const manualOf = (id: string): Partial<Overrides> => {
    const manual: Partial<Overrides> = {};
    for (const { key } of FIELDS) {
      const value = values[valueKey(id)]?.[key];
      if (value?.mode === 'manual') manual[key] = value.value / 100;
    }
    return manual;
  };

  const isEnabled = (os: OsId) => enabledSystems[os] !== false;
  const chosen = systems
    .filter(isEnabled)
    .flatMap((os) =>
      shares
        ? listFor(os).map((pick) => ({ os, share: shares[os], faceId: pick.id, candidate: pick }))
        : [],
    );
  const faceIds = new Set(chosen.map((item) => item.faceId));
  let plan: ReturnType<typeof planStack> | undefined;
  let reordered = false;
  try {
    plan = chosen.length > 0 ? planStack(chosen) : undefined;
    const suggestion = plan?.resolution.suggestion?.order;
    if (suggestion) {
      plan = planStack(chosen, suggestion);
      reordered = true;
    }
  } catch (failure) {
    if (!(failure instanceof StackResolveError)) throw failure;
  }
  const previewPick = currentPick ?? chosen[0]?.candidate;
  const spacingKey = JSON.stringify([selected?.id, language, kind, previewPick?.id]);
  const optimizedSpacing = spacingResult?.key === spacingKey ? spacingResult.value : undefined;

  const spacingEm: SpacingEm = spacingOn
    ? {
        letter:
          spacingValues.letter.mode === 'manual'
            ? spacingValues.letter.value / 100
            : (optimizedSpacing?.letter ?? 0),
        word:
          spacingValues.word.mode === 'manual'
            ? spacingValues.word.value / 100
            : (optimizedSpacing?.word ?? 0),
      }
    : { letter: 0, word: 0 };
  const systemName = (os: OsId) => t[`audience_os_${os}`]();
  let simulation: PanelInput | undefined;
  let output: ReturnType<typeof buildCss> | undefined;
  let adjustment: Overrides | undefined;
  if (selected && plan && previewPick) {
    const faces = plan.order.flatMap((id) => {
      const candidate = chosen.find((item) => item.faceId === id)?.candidate;
      return candidate
        ? [
            {
              family: candidate.family,
              localNames: candidate.localNames,
              adjustment: adjustmentOf(baseOf(candidate), manualOf(id)),
            },
          ]
        : [];
    });
    adjustment = adjustmentOf(baseOf(previewPick), manualOf(previewPick.id));
    try {
      const family = selected.metrics.names.family?.trim().slice(0, 200) || 'Custom font';
      output = buildCss(family, faces, kind);
      if (selected) {
        simulation = {
          webBytes: selected.bytes,
          fallbackFontFaces: output.fontFaces,
          fallbackFamilies: faces.map((face) =>
            fallbackFamilyName(family, face.family, faces.length),
          ),
          generic: kind,
          language,
          spacing: { letterEm: spacingEm.letter, wordEm: spacingEm.word },
        };
      }
    } catch (failure) {
      if (!(failure instanceof CssExportError)) throw failure;
    }
  }

  const vertical = audience ? lacksVerticalOverrides(descriptorSupport(audience.entries)) : 0;
  const aspect = selected ? aspectOf(selected.metrics) : null;
  const safariCss =
    aspect !== null && vertical > 0.05 ? safariStrategyCss(aspect, STRATEGY_LINE_HEIGHT) : '';

  const anyRanking = Object.values(rankings.result).find(Boolean);
  const winnerOf = (os: OsId) => {
    const winner = plan?.resolution.platforms.find((item) => item.platform === os)?.winner;
    return (
      chosen.find((item) => item.os === os && item.faceId === winner) ??
      chosen.find((item) => item.os === os)
    );
  };
  const shiftCache = new Map<string, number | null>();
  const systemInfo = (os: OsId): SystemInfo => ({
    available: systems.includes(os),
    enabled: isEnabled(os) && chosen.some((item) => item.os === os),
    fonts: [
      ...new Set(chosen.filter((item) => item.os === os).map((item) => item.candidate.family)),
    ].join(', '),
    shift: (variant: Variant) => {
      const key = `${os}:${variant}`;
      if (shiftCache.has(key)) return shiftCache.get(key) ?? null;
      const entry = winnerOf(os);
      let value: number | null = null;
      if (entry && selected && anyRanking) {
        const web = webPredictFont(
          selected.metrics,
          anyRanking,
          variant === 'partial' ? STRATEGY_LINE_HEIGHT : undefined,
        );
        const font = variantPredictFont(
          entry.candidate,
          adjustmentOf(baseOf(entry.candidate), manualOf(entry.candidate.id)),
          spacingEm,
          variant,
        );
        if (font) {
          value = worstShift({ web, language }, font);
        }
      }
      shiftCache.set(key, value);
      return value;
    },
  });
  const matrixKey = JSON.stringify([
    selected?.id,
    language,
    kind,
    enabledSystems,
    spacingEm,
    chosen.map((item) => [
      item.os,
      item.faceId,
      adjustmentOf(baseOf(item.candidate), manualOf(item.candidate.id)),
    ]),
    plan?.order,
  ]);
  const matrixGroups = useMemo(
    () =>
      audience && selected && anyRanking
        ? buildMatrix(
            audience.entries,
            DEFAULT_DESKTOP_SPLIT,
            Object.fromEntries(ALL_SYSTEMS.map((os) => [os, systemInfo(os)])),
            { released: audience.released },
          )
        : [],
    [audience, matrixKey],
  );

  const fitFaces = [
    ...new Map(
      [...(previewPick ? [previewPick] : []), ...chosen.map((item) => item.candidate)].map(
        (candidate) => [candidate.id, candidate],
      ),
    ).values(),
  ];
  const fitKey = JSON.stringify([
    selected?.id,
    language,
    kind,
    spacingOn,
    spacingOn ? [spacingKey, spacingValues] : null,
    fitFaces.map((candidate) => [candidate.id, manualOf(candidate.id)]),
  ]);
  useEffect(() => {
    if (!selected || !anyRanking || fitFaces.length === 0) return;
    const controller = new AbortController();
    setFitting(true);
    const model = { web: webPredictFont(selected.metrics, anyRanking), language };
    const { letter: letterValue, word: wordValue } = spacingValues;
    const letterManual = letterValue.mode === 'manual';
    const wordManual = wordValue.mode === 'manual';
    void (async () => {
      let spacing = {
        letter: spacingOn && letterValue.mode === 'manual' ? letterValue.value / 100 : 0,
        word: spacingOn && wordValue.mode === 'manual' ? wordValue.value / 100 : 0,
      };
      const found: Record<string, Overrides> = {};
      const missing: string[] = [];
      let spacingFound: SpacingEm | undefined;
      for (const [index, candidate] of fitFaces.entries()) {
        const free = spacingOn && index === 0;
        const result = await autoFit({
          candidate,
          manual: manualOf(candidate.id),
          spacing,
          pinSpacing: { letter: !free || letterManual, word: !free || wordManual },
          model,
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!result) {
          missing.push(valueKey(candidate.id));
          continue;
        }
        found[valueKey(candidate.id)] = result.adjustment;
        if (free) {
          spacing = result.spacing;
          spacingFound = result.spacing;
        }
      }
      setOptimized((all) => {
        const next = { ...all, ...found };
        for (const key of missing) delete next[key];
        return next;
      });
      setFitting(false);
      if (spacingFound) setSpacingResult({ key: spacingKey, value: spacingFound });
    })();
    return () => {
      controller.abort();
      setFitting(false);
    };
  }, [fitKey]);
  const ratingText = (shift: number) => {
    const rating = ratingOf(shift);
    if (rating === 'good') return { level: 'good' as const, label: t.cls_rating_good() };
    return rating === 'needs-improvement'
      ? { level: 'needs' as const, label: t.cls_rating_needs() }
      : { level: 'poor' as const, label: t.cls_rating_poor() };
  };

  const percent = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  const familyOf = (id: string) =>
    chosen.find((item) => item.faceId === id)?.candidate.family ?? id;
  const currentValues = currentPick ? (values[valueKey(currentPick.id)] ?? AUTO) : AUTO;
  const shadowed = plan?.resolution.platforms.filter((item) => item.status === 'shadowed') ?? [];
  const planIssue =
    plan?.resolution.blockedBy === 'cycle'
      ? t.plan_blocked()
      : shadowed
          .map((item) =>
            t.plan_shadowed({
              system: systemName(item.platform.split('#')[0] as OsId),
              winner: familyOf(item.winner ?? ''),
              font: familyOf(item.preferredFace),
            }),
          )
          .join(' ');
  const optionLabel = (item: Candidate) =>
    `${item.family} (${(item.adjustment.sizeAdjust * 100).toFixed(1)}%)${
      item.latinOnly ? ` · ${t.fit_font_latin_only()}` : ''
    }`;

  return (
    <div class="ff-generator">
      <div class="ff-generator__settings" id="ff-settings">
        <FontUpload locale={locale} busy={busy} compact={fonts.length > 0} onFiles={addFiles} />
        {error && (
          <p class="ff-error" role="alert">
            {error}
          </p>
        )}
        <LiveRegion>{announcement}</LiveRegion>
        <LiveRegion>{planIssue || planNote}</LiveRegion>
        {fonts.length > 0 && (
          <section
            class="ff-generator__section ff-generator__section--plain"
            aria-labelledby="ff-fonts-heading"
          >
            <h2 id="ff-fonts-heading" class="ff-sr-only">
              {t.upload_fonts_label()}
            </h2>
            {fonts.length > 1 && (
              <Select
                label={t.upload_select_label()}
                value={String(selected?.id ?? '')}
                options={fonts.map((font) => ({
                  value: String(font.id),
                  label: `${font.metrics.names.fullName ?? font.fileName} (${font.fileName})`,
                }))}
                onChange={(value) => {
                  setSelectedId(Number(value));
                  setPicks({});
                  resetOptimization();
                }}
              />
            )}
            <ul>
              {fonts.map((font) => (
                <li key={font.id}>
                  <span>{font.fileName}</span>
                  <Button
                    onClick={() => {
                      setFonts((list) => list.filter((item) => item.id !== font.id));
                      setSelectedId((id) => (id === font.id ? undefined : id));
                      setValues({});
                      resetOptimization();
                    }}
                    aria-label={`${t.upload_remove()}: ${font.fileName}`}
                  >
                    {t.upload_remove()}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {selected && rankings.noCoverage && Object.keys(rankings.result).length === 0 && (
          <p role="alert">{t.fit_no_coverage()}</p>
        )}
        {selected && !shares && <p class="ff-muted">{t.plan_waiting()}</p>}
        {selected && current && (
          <section class="ff-generator__section" aria-labelledby="ff-fit-heading">
            <h2 id="ff-fit-heading" class="ff-sr-only">
              {t.fit_heading()}
            </h2>
            <div class="ff-generator__pair">
              <Select
                label={t.fit_system_label()}
                value={current}
                options={systems.map((os) => ({
                  value: os,
                  label: systemName(os),
                }))}
                onChange={(value) => {
                  setActiveOs(value as OsId);
                  setEditId(undefined);
                }}
              />
              <Select
                label={t.fit_type_label()}
                value={kind}
                options={[
                  { value: 'sans-serif', label: t.type_sans() },
                  { value: 'serif', label: t.type_serif() },
                  { value: 'monospace', label: t.type_mono() },
                ]}
                onChange={(value) => {
                  setKindChoice({ fontId: selected?.id, kind: value as Category });
                  setPicks({});
                  resetOptimization();
                  setEditId(undefined);
                }}
              />
            </div>
            {selected &&
              selected.metrics.style.category === null &&
              kindChoice?.fontId !== selected.id && <p class="ff-muted">{t.font_type_unknown()}</p>}
            {selected?.metrics.style.italic && <p class="ff-muted">{t.font_italic_note()}</p>}
            {selected && selected.metrics.style.weight !== 400 && (
              <p class="ff-muted">
                {t.font_weight_note({ weight: selected.metrics.style.weight })}
              </p>
            )}
            <fieldset class="ff-generator__systems">
              <legend>{t.systems_legend()}</legend>
              {systems.map((os) => (
                <label key={os}>
                  <input
                    type="checkbox"
                    checked={isEnabled(os)}
                    onChange={(event) => {
                      const checked = event.currentTarget.checked;
                      setEnabledSystems((all) => ({ ...all, [os]: checked }));
                    }}
                  />{' '}
                  {t.systems_share({ system: systemName(os), share: percent(shares?.[os] ?? 0) })}
                </label>
              ))}
            </fieldset>
            {currentList.map((pick, index) => (
              <div class="ff-generator__row" key={`${current}-${index}`} data-slot={index}>
                <Select
                  label={t.fallback_font_n({ n: index + 1 })}
                  value={pick.id}
                  options={currentCandidates
                    .filter(
                      (item) =>
                        item.id === pick.id || !currentList.some((other) => other.id === item.id),
                    )
                    .map((item) => ({ value: item.id, label: optionLabel(item) }))}
                  onChange={(value) => {
                    const replacement = currentCandidates.find((item) => item.id === value);
                    if (replacement) {
                      setList(
                        current,
                        currentList.map((item) => (item.id === pick.id ? replacement : item)),
                      );
                    }
                  }}
                />
                <div class="ff-generator__buttons">
                  {index === currentList.length - 1 && (
                    <Button
                      disabled={
                        currentCandidates.length <= currentList.length ||
                        (faceIds.size >= MAX_FACES &&
                          !currentCandidates.every((item) => faceIds.has(item.id)))
                      }
                      onClick={() => {
                        const next = currentCandidates.find(
                          (item) => !currentList.some((other) => other.id === item.id),
                        );
                        if (!next) return;
                        setList(current, [...currentList, next]);
                        setPlanNote(t.plan_added());
                        setFocusSlot(currentList.length);
                      }}
                    >
                      {t.plan_add()}
                    </Button>
                  )}
                  {currentList.length > 1 && (
                    <Button
                      aria-label={`${t.plan_remove()}: ${t.fallback_font_n({ n: index + 1 })}`}
                      onClick={() => {
                        setList(
                          current,
                          currentList.filter((item) => item.id !== pick.id),
                        );
                        setPlanNote(t.plan_removed());
                        setFocusSlot(Math.max(0, index - 1));
                      }}
                    >
                      {t.plan_remove()}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {currentCandidates.length <= currentList.length && (
              <p class="ff-muted">{t.plan_no_more({ system: systemName(current) })}</p>
            )}
            {currentList.length > 1 && currentPick && (
              <Select
                label={t.fit_edit_label()}
                value={currentPick.id}
                options={currentList.map((item) => ({ value: item.id, label: item.family }))}
                onChange={setEditId}
              />
            )}
            {currentPick ? (
              <>
                {currentPick.coverage < 0.95 && (
                  <p class="ff-muted" role="status">
                    {t.fit_font_partial({ percent: percent(currentPick.coverage * 100) })}
                  </p>
                )}
                {FIELDS.map(({ key, label, min, max }) => (
                  <FitField
                    key={`${currentPick.id}-${key}`}
                    compact
                    locale={locale}
                    label={t[label]()}
                    unit={t.fit_percent_unit()}
                    value={currentValues[key]}
                    autoValue={baseOf(currentPick)[key] * 100}
                    min={min}
                    max={max}
                    step={0.1}
                    onChange={(next) =>
                      setValues((all) => ({
                        ...all,
                        [valueKey(currentPick.id)]: {
                          ...(all[valueKey(currentPick.id)] ?? AUTO),
                          [key]: next,
                        },
                      }))
                    }
                  />
                ))}
                <Disclosure summary={t.spacing_heading()}>
                  <p class="ff-muted">{t.spacing_note()}</p>
                  <label>
                    <input
                      type="checkbox"
                      checked={spacingOn}
                      onChange={(event) => setSpacingOn(event.currentTarget.checked)}
                    />{' '}
                    {t.spacing_enable()}
                  </label>
                  {(spacingOn
                    ? ([
                        ['letter', t.spacing_letter_label(), -5, 5, 0.01],
                        ['word', t.spacing_word_label(), -30, 30, 0.1],
                      ] as const)
                    : []
                  ).map(([name, label, min, max, step]) => (
                    <FitField
                      key={name}
                      compact
                      locale={locale}
                      label={label}
                      unit={t.spacing_unit()}
                      value={spacingValues[name]}
                      autoValue={(optimizedSpacing?.[name] ?? 0) * 100}
                      min={min}
                      max={max}
                      step={step}
                      onChange={(next) => setSpacingValues((all) => ({ ...all, [name]: next }))}
                    />
                  ))}
                </Disclosure>
              </>
            ) : (
              <p class="ff-muted">{t.plan_no_kind({ system: systemName(current) })}</p>
            )}
          </section>
        )}
        <AudienceEditor
          locale={locale}
          onShares={handleShares}
          onEntries={setAudience}
          active={fonts.length > 0}
        />
      </div>
      <div class="ff-generator__main">
        <div class="ff-generator__stage">
          {output && selected && coverage < LOW_COVERAGE && (
            <p class="ff-error" role="status">
              {t.fit_low_coverage()} {Math.round(coverage * 100)}%
            </p>
          )}
          <LiveRegion>{fitting ? t.fit_running() : ''}</LiveRegion>
          {fitting && <p class="ff-muted">{t.fit_running()}</p>}
          {reordered && <p class="ff-muted">{t.plan_reordered()}</p>}
          {plan &&
            (shadowed.length > 0 ||
              plan.resolution.blockedBy === 'cycle' ||
              uncovered.length > 0) && (
              <div class="ff-generator__notes" id="ff-notes" tabIndex={-1}>
                {shadowed.map((item) => (
                  <p key={item.platform} class="ff-error">
                    {t.plan_shadowed({
                      system: systemName(item.platform.split('#')[0] as OsId),
                      winner: familyOf(item.winner ?? ''),
                      font: familyOf(item.preferredFace),
                    })}
                  </p>
                ))}
                {plan.resolution.blockedBy === 'cycle' && (
                  <p class="ff-error">{t.plan_blocked()}</p>
                )}
                {uncovered.length > 0 && shares && (
                  <p class="ff-muted">
                    {t.plan_uncovered({
                      systems: uncovered.map(systemName).join(', '),
                      share: percent(uncovered.reduce((sum, os) => sum + shares[os], 0)),
                    })}
                  </p>
                )}
              </div>
            )}
          {output && selected && previewPick && adjustment ? (
            <Accordion
              items={[
                {
                  id: 'preview',
                  label: t.preview_tab(),
                  content: (
                    <Preview
                      key={selected.id}
                      defaultSample={sampleText(selected.metrics, t.preview_sample_default())}
                      codePoints={selected.metrics.codePoints}
                      locale={locale}
                      bytes={selected.bytes}
                      fallback={previewPick}
                      adjustment={adjustment}
                    />
                  ),
                },
                {
                  id: 'css',
                  label: t.shell_tab_css(),
                  content: (
                    <>
                      <section class="ff-generator__section" aria-label={t.css_heading()}>
                        <p class="ff-muted">{t.fit_latin_note()}</p>
                        <CodeBlock
                          locale={locale}
                          label={t.css_code_label()}
                          code={[
                            output.fontFaces,
                            fallbackRule(output.fontFamily, safariCss),
                            loadingCss(spacingEm),
                          ]
                            .filter(Boolean)
                            .join('\n\n')}
                        />
                      </section>
                      {hasSpacing(spacingEm) && (
                        <section class="ff-generator__section" aria-labelledby="ff-loading-heading">
                          <h2 id="ff-loading-heading">{t.loading_heading()}</h2>
                          <p class="ff-muted">{t.loading_note()}</p>
                          <CodeBlock
                            locale={locale}
                            label={t.loading_code_label()}
                            code={loadingScript(
                              selected.metrics.names.family?.trim().slice(0, 200) || 'Custom font',
                            )}
                          />
                        </section>
                      )}
                    </>
                  ),
                },
                {
                  id: 'support',
                  label: t.matrix_heading(),
                  content: (
                    <>
                      {manualSystems ? (
                        <p class="ff-muted">{t.matrix_manual()}</p>
                      ) : (
                        <SupportMatrix locale={locale} groups={matrixGroups} rating={ratingText} />
                      )}
                      {simulation && (
                        <LayoutShiftPanel
                          locale={locale}
                          verify={simulation}
                          signature={output.fontFaces}
                        />
                      )}
                    </>
                  ),
                },
              ]}
            />
          ) : (
            <p class="ff-generator__empty">{t.results_empty()}</p>
          )}
          {plan && !output && selected && <p role="alert">{t.css_error()}</p>}
        </div>
      </div>
    </div>
  );
}
