import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import {
  Accordion,
  Button,
  Collapsible,
  clearLayouts,
  Disclosure,
  DOCK_OPEN_EVENT,
  Dock,
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
  OsIcon,
  type OsShares,
  SupportMatrix,
  type SystemInfo,
} from '@/modules/audience';
import { CssExportError, type ExportInput } from '@/modules/export';
import { compactRanges, formatUnicodeRange, StackResolveError } from '@/modules/fallback-fit';
import {
  collectionMemberIndices,
  createFontParser,
  extractCollectionMember,
  type FontMetrics,
  FontParseError,
  type FontParser,
  isFontCollection,
  MAX_FONT_BYTES,
} from '@/modules/font-metrics';
import { FontsourcePicker, GoogleFontsPicker } from '@/modules/font-sources';
import { LayoutShiftPanel, type PanelInput, ratingOf, worstShift } from '@/modules/layout-shift';
import { type Category, loadVariantMetrics, type OsId, osFontsDataset } from '@/modules/os-fonts';
import { cssStack, PRESETS, type PresetId, presetName, presetPicks } from '@/modules/presets';
import {
  discardPending,
  ImportConfirm,
  PENDING_HASH,
  type SiteImport,
  SiteImportPanel,
  takePending,
} from '@/modules/site-import';
import { autoFit } from '../lib/auto-fit';
import { fallbackRatio, webRatio } from '../lib/calibration';
import { displayName, fitLanguage, isNoCoverage, LOW_COVERAGE } from '../lib/compute';
import { adjustmentOf, buildCss, fallbackFamilyName, type Overrides } from '../lib/css';
import { hasSpacing, loadingCss, loadingScript, type SpacingEm } from '../lib/loading';
import { currentFallback, type FontOutput, groupFonts, mergeOutputs } from '../lib/overview';
import { ownOs } from '../lib/own-os';
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
} from '../lib/per-os';
import {
  STRATEGY_LINE_HEIGHT,
  type Variant,
  variantPredictFont,
  webPredictFont,
} from '../lib/predict-input';
import type { PreviewItem, SiteData } from '../lib/preview-item';
import { buildReport } from '../lib/report';
import { aspectOf, safariStrategyCss } from '../lib/safari';
import { detectScripts, type ScriptId, scriptFaces } from '../lib/scripts';
import {
  decodeShareState,
  encodeShareState,
  type FontState,
  HASH_KEY,
  payloadFromHash,
  SHARE_VERSION,
  type ShareState,
} from '../lib/share';
import {
  clearStorage,
  loadSettings,
  loadStoredFonts,
  removeStoredFont,
  saveSettings,
  storeFont,
} from '../lib/storage';
import { ArticleView } from './ArticleView';
import { CoverageMap } from './CoverageMap';
import { CssImport } from './CssImport';
import { ExportPanel } from './ExportPanel';
import { FontUpload } from './FontUpload';
import './generator.css';

interface LoadedFont {
  id: number;
  fileName: string;
  metrics: FontMetrics;
  bytes: ArrayBuffer;
}

const FONT_EXTENSIONS = /\.(woff2|woff|ttf|otf|ttc|otc)$/i;
const isFontFile = (file: File) => FONT_EXTENSIONS.test(file.name) || file.type.startsWith('font/');
const isStyleFile = (file: File) => /\.css$/i.test(file.name) || file.type === 'text/css';

const MAX_FONTS = 8;
const MIN_SHARE = 1;
const MAX_FACES = 16;
const ALL_SYSTEMS = ['windows', 'macos', 'ios', 'android', 'linux', 'chromeos'] as const;

type Picks = Partial<Record<OsId, string[]>>;
const NO_PICKS: Picks = {};

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
  const [selectedId, setSelectedId] = useState<number | 'all'>();
  const [fontOpen, setFontOpen] = useState(true);
  const [kindChoices, setKindChoices] = useState<Record<number, Category>>({});
  const [presetId, setPresetId] = useState<PresetId>();
  const [styleChoices, setStyleChoices] = useState<Record<number, FontStyleKey>>({});
  const [shares, setShares] = useState<OsShares>();
  const [audience, setAudience] = useState<AudienceData>();
  const [enabledSystems, setEnabledSystems] = useState<Partial<Record<OsId, boolean>>>({});
  const [activeOs, setActiveOs] = useState<OsId>();
  const [picksByFont, setPicksByFont] = useState<Record<number, Picks>>({});
  const [editId, setEditId] = useState<string>();
  const [focusSlot, setFocusSlot] = useState<number>();
  const [values, setValues] = useState<Record<string, Values>>({});
  const [optimized, setOptimized] = useState<Record<string, Partial<Overrides>>>({});
  const [spacingResult, setSpacingResult] = useState<{ key: string; value: SpacingEm }>();
  const [spacingOn, setSpacingOn] = useState(false);
  const [rangeOn, setRangeOn] = useState(false);
  const [perScript, setPerScript] = useState(true);
  const [openSystem, setOpenSystem] = useState<OsId | null | undefined>();
  const [fitting, setFitting] = useState(false);
  const [spacingValues, setSpacingValues] = useState<{ letter: FitValue; word: FitValue }>({
    letter: { mode: 'auto' },
    word: { mode: 'auto' },
  });
  const [forgotten, setForgotten] = useState<string>();
  const [initialQuery, setInitialQuery] = useState<string>();
  const [query, setQuery] = useState<string>();
  const [restored, setRestored] = useState(false);
  const pending = useRef<ShareState | null>(null);
  const [shareMessage, setShareMessage] = useState('');
  const handleShares = useCallback((next: OsShares) => setShares(next), []);
  const resetOptimization = () => {
    setOptimized({});
    setSpacingResult(undefined);
  };
  const [planNote, setPlanNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [incoming, setIncoming] = useState<SiteImport | null>(null);
  const [site, setSite] = useState<SiteData>();
  useEffect(() => {
    if (location.hash !== PENDING_HASH) return;
    history.replaceState(null, '', location.pathname + location.search);
    void takePending().then(setIncoming);
  }, []);
  const acceptImport = () => {
    if (!incoming) return;
    const value = incoming;
    setIncoming(null);
    const body = value.used.find((item) => item.role === 'body');
    const heading = value.used.find((item) => ['h1', 'h2', 'h3'].includes(item.role));
    setSite({
      origin: value.origin,
      heading: value.samples.find((item) => item.role === 'heading')?.text,
      body: value.samples.find((item) => item.role === 'body')?.text,
      size: body?.size,
      lineHeight: body?.lineHeight,
      headingStack: heading?.family,
      bodyStack: body?.family,
    });
    if (value.files.length > 0) {
      void addFiles(value.files.map((file) => new File([file.bytes], file.name)));
      setAnnouncement(t.import_done({ count: value.files.length, origin: value.origin }));
    }
  };

  const [announcement, setAnnouncement] = useState('');
  useEffect(() => () => parser.current?.dispose(), []);
  useEffect(() => {
    if (focusSlot === undefined) return;
    document.querySelector<HTMLElement>(`[data-slot="${focusSlot}"] select`)?.focus();
    setFocusSlot(undefined);
  }, [focusSlot]);

  const addFiles = async (files: File[], persist = true) => {
    if (files.length === 0 || busy) return;
    parser.current ??= createFontParser();
    setBusy(true);
    setError('');
    setAnnouncement(t.upload_reading());
    const added: LoadedFont[] = [];
    const failures: string[] = [];
    try {
      for (const file of files) {
        const fileName = displayName(file.name);
        if (fonts.length + added.length >= MAX_FONTS) {
          failures.push(`${fileName}: ${t.error_too_many()}`);
          continue;
        }
        if (file.size > MAX_FONT_BYTES) {
          failures.push(`${fileName}: ${t.error_too_large()}`);
          continue;
        }
        let buffer: ArrayBuffer;
        try {
          buffer = await file.arrayBuffer();
        } catch {
          failures.push(`${fileName}: ${t.error_worker_error()}`);
          continue;
        }
        let indices: (number | undefined)[];
        try {
          indices = isFontCollection(buffer) ? collectionMemberIndices(buffer) : [undefined];
        } catch (failure) {
          const known = failure instanceof FontParseError ? errors[failure.code] : undefined;
          failures.push(`${fileName}: ${known ?? t.error_invalid_font()}`);
          continue;
        }
        for (const index of indices) {
          if (fonts.length + added.length >= MAX_FONTS) {
            failures.push(`${fileName}: ${t.error_too_many()}`);
            break;
          }
          const name = index === undefined ? fileName : `${fileName} #${index + 1}`;
          try {
            const data = index === undefined ? buffer : extractCollectionMember(buffer, index);
            const bytes = data.slice(0);
            const result = await parser.current.parse(data);
            if (result.ok) {
              added.push({ id: nextId.current++, fileName: name, metrics: result.font, bytes });
            } else {
              failures.push(`${name}: ${errors[result.error.code] ?? t.error_invalid_font()}`);
            }
          } catch (failure) {
            const known = failure instanceof FontParseError ? errors[failure.code] : undefined;
            failures.push(`${name}: ${known ?? t.error_worker_error()}`);
          }
        }
      }
    } finally {
      setBusy(false);
    }
    setError(failures.join(' '));
    if (added.length > 0) {
      if (persist) {
        for (const item of added)
          void storeFont({ name: item.fileName, bytes: item.bytes.slice(0) });
      }
      setFonts((current) => [...current, ...added]);
      setAnnouncement(`${t.upload_added()}: ${fonts.length + added.length}`);
    } else {
      setAnnouncement('');
    }
  };

  useEffect(() => {
    let current = true;
    void (async () => {
      const payload = payloadFromHash(location.hash);
      let state = payload ? await decodeShareState(payload) : null;
      state ??= loadSettings();
      if (payload && state) history.replaceState(null, '', location.pathname + location.search);
      if (state && current) {
        setInitialQuery(state.query);
        setEnabledSystems(Object.fromEntries((state.disabled ?? []).map((os) => [os, false])));
        setRangeOn(state.range ?? false);
        setPerScript(state.scripts ?? true);
        setPresetId(PRESETS.find((item) => item.id === state.preset)?.id);
        if (state.spacing) {
          setSpacingOn(state.spacing.on);
          const value = (number: number | undefined): FitValue =>
            number === undefined ? { mode: 'auto' } : { mode: 'manual', value: number };
          setSpacingValues({
            letter: value(state.spacing.letter),
            word: value(state.spacing.word),
          });
        }
        pending.current = state;
      }
      const stored = await loadStoredFonts();
      if (stored.length > 0 && current) {
        await addFiles(
          stored.map((item) => new File([item.bytes], item.name)),
          false,
        );
      }
      if (current) setRestored(true);
    })();
    return () => {
      current = false;
    };
  }, []);
  useEffect(() => {
    const state = pending.current;
    if (!state || fonts.length === 0) return;
    if (state.fontName === undefined && fonts.length > 1) {
      pending.current = null;
      return;
    }
    const target =
      state.fontName === undefined
        ? fonts[0]
        : fonts.find((font) => font.fileName === state.fontName);
    if (!target) {
      if (restored) pending.current = null;
      return;
    }
    pending.current = null;
    setSelectedId(fonts.length > 1 ? target.id : undefined);
    const restoredValues: Record<string, Values> = {};
    const apply = (font: LoadedFont, saved: FontState) => {
      setPicksByFont((all) => ({ ...all, [font.id]: saved.picks ?? {} }));
      const savedKind = saved.kind;
      if (savedKind) setKindChoices((all) => ({ ...all, [font.id]: savedKind }));
      const savedStyle = saved.style;
      if (savedStyle) setStyleChoices((all) => ({ ...all, [font.id]: savedStyle }));
      for (const [faceId, entry] of Object.entries(saved.manual ?? {})) {
        const next: Values = { ...AUTO };
        for (const [key, value] of Object.entries(entry)) {
          next[key as Field] = { mode: 'manual', value };
        }
        restoredValues[`${font.id}:${faceId}`] = next;
      }
    };
    apply(target, state);
    for (const font of fonts) {
      const saved = font === target ? undefined : state.others?.[font.fileName];
      if (saved) apply(font, saved);
    }
    setValues(restoredValues);
  }, [fonts, restored]);

  const selected = fonts.find((font) => font.id === selectedId) ?? fonts[0];
  const allMode = fonts.length > 1 && (selectedId === undefined || selectedId === 'all');
  const descriptorsOf = (style: FontStyleKey) => ({
    fontWeight: style === 'bold' || style === 'bold-italic' ? 700 : undefined,
    fontStyle: style === 'italic' || style === 'bold-italic' ? ('italic' as const) : undefined,
  });
  const language: Language = fitLanguage(selected?.metrics, locale);
  const [variantsReady, setVariantsReady] = useState(false);
  const [webK, setWebK] = useState<Record<string, number>>({});
  const [fallbackK, setFallbackK] = useState<Record<string, number | null>>({});
  const calibrationKey = (id: string | number, font: LoadedFont) =>
    `${id}:${fitLanguage(font.metrics, locale)}`;
  useEffect(() => {
    for (const font of fonts) {
      const key = calibrationKey(font.id, font);
      if (webK[key] !== undefined) continue;
      void webRatio(font.bytes, font.metrics, fitLanguage(font.metrics, locale)).then((value) =>
        setWebK((current) => ({ ...current, [key]: value })),
      );
    }
  }, [fonts, locale]);
  const factorOf = (font: LoadedFont) => webK[calibrationKey(font.id, font)] ?? 1;
  const fallbackFactor = (candidate: Candidate, font: LoadedFont) =>
    fallbackK[calibrationKey(candidate.id, font)] ?? 1;
  const styleOf = (font: (typeof fonts)[number]): FontStyleKey =>
    styleChoices[font.id] ?? styleKeyOf(font.metrics.style);
  const styleKey: FontStyleKey = selected ? styleOf(selected) : 'regular';
  const needsVariants = fonts.some((font) => styleOf(font) !== 'regular');
  useEffect(() => {
    if (!needsVariants || variantsReady) return;
    void loadVariantMetrics().then(() => setVariantsReady(true));
  }, [needsVariants, variantsReady]);
  const preset = PRESETS.find((item) => item.id === presetId);
  const presetMap = useMemo(
    () => (preset ? presetPicks(preset, osFontsDataset, ALL_SYSTEMS) : undefined),
    [preset],
  );
  const kind: Category =
    (selected ? kindChoices[selected.id] : undefined) ??
    preset?.kind ??
    selected?.metrics.style.category ??
    'sans-serif';
  const picks = (selected ? picksByFont[selected.id] : undefined) ?? presetMap ?? NO_PICKS;
  const setPicks = (next: Picks | ((all: Picks) => Picks)) => {
    if (!selected) return;
    setPicksByFont((all) => ({
      ...all,
      [selected.id]:
        typeof next === 'function' ? next(all[selected.id] ?? presetMap ?? NO_PICKS) : next,
    }));
  };

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
          result[os] = rankFor(selected.metrics, os, language, styleKey);
        } catch (thrown) {
          if (!isNoCoverage(thrown)) throw thrown;
          noCoverage = true;
        }
      }
    }
    return { result, noCoverage };
  }, [selected, systems, language, styleKey, variantsReady]);

  const isEnabled = (os: OsId) => enabledSystems[os] !== false;
  const candidatesOf = (os: OsId): Candidate[] =>
    (rankings.result[os]?.candidates ?? []).filter((item) => item.category === kind);
  const defaultPicks = consolidate(
    Object.fromEntries(systems.filter(isEnabled).map((os) => [os, candidatesOf(os)])),
    shares ?? {},
  );
  const listFor = (os: OsId): Candidate[] => {
    const all = candidatesOf(os);
    const explicit = (picks[os] ?? []).flatMap((id) => all.find((item) => item.id === id) ?? []);
    const fallback = defaultPicks[os];
    if (explicit.length > 0) return explicit;
    return fallback ? [fallback] : all.slice(0, 1);
  };

  const [own, setOwn] = useState<OsId>();
  useEffect(() => setOwn(ownOs()), []);
  const current =
    activeOs && systems.includes(activeOs)
      ? activeOs
      : own && systems.includes(own)
        ? own
        : systems[0];
  const currentList = current ? listFor(current) : [];
  const currentCandidates = current ? candidatesOf(current) : [];
  const currentPick = currentList.find((item) => item.id === editId) ?? currentList[0];
  const setList = (os: OsId, next: Candidate[]) =>
    setPicks((all) => ({ ...all, [os]: next.map((item) => item.id) }));
  const coverage = Math.min(
    1,
    ...Object.values(rankings.result).map((ranking) => ranking?.coverage ?? 1),
  );

  const valueKeyOf = (fontId: number, id: string) => `${fontId}:${id}`;
  const valueKey = (id: string) => valueKeyOf(selected?.id ?? 0, id);
  const baseOf = (candidate: Candidate) => ({
    ...candidate.adjustment,
    ...optimized[valueKey(candidate.id)],
  });
  const manualFor = (fontId: number, id: string): Partial<Overrides> => {
    const manual: Partial<Overrides> = {};
    for (const { key } of FIELDS) {
      const value = values[valueKeyOf(fontId, id)]?.[key];
      if (value?.mode === 'manual') manual[key] = value.value / 100;
    }
    return manual;
  };
  const manualOf = (id: string): Partial<Overrides> => manualFor(selected?.id ?? 0, id);

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
  const reportText = () =>
    buildReport({
      locale,
      family: exportFamily,
      fileName: selected?.fileName ?? '',
      audienceCount: audience?.entries.length,
      matrix: matrixGroups,
      support: audience ? descriptorSupport(audience.entries) : [],
      fontCoverage: coverage,
      systems: systems.map((os) => ({
        os,
        label: systemName(os),
        enabled: isEnabled(os),
        fonts: [
          ...new Set(chosen.filter((item) => item.os === os).map((item) => item.candidate.family)),
        ].join(', '),
      })),
      warnings: [
        ...(coverage < LOW_COVERAGE
          ? [`${t.fit_low_coverage()} ${Math.round(coverage * 100)}%`]
          : []),
        ...(reordered ? [t.plan_reordered()] : []),
        ...shadowed.map((item) =>
          t.plan_shadowed({
            system: systemName(item.platform.split('#')[0] as OsId),
            winner: familyOf(item.winner ?? ''),
            font: familyOf(item.preferredFace),
          }),
        ),
        ...(uncovered.length > 0 && shares
          ? [
              t.plan_uncovered({
                systems: uncovered.map(systemName).join(', '),
                share: percent(uncovered.reduce((sum, os) => sum + shares[os], 0)),
              }),
            ]
          : []),
      ],
      strategy: safariCss !== '',
      spacing: spacingOn && hasSpacing(spacingEm),
      rating: (shift) => ratingText(shift).level,
    });
  const coverageRanges = useMemo(
    () => (selected ? compactRanges(selected.metrics.codePoints) : []),
    [selected],
  );
  const scriptsOf = (font: LoadedFont, candidate: Candidate, lang: Language, applied: Overrides) =>
    perScript
      ? scriptFaces(font.metrics, candidate.fit, lang, candidate.adjustment, applied, rangeOn).map(
          ({ unicodeRange, adjustment }) => ({ unicodeRange, adjustment }),
        )
      : undefined;
  const detectedScripts = useMemo(
    () => (selected ? detectScripts(selected.metrics.codePoints) : []),
    [selected],
  );
  const scriptLabel = (script: ScriptId) => {
    if (script === 'cyrillic') return t.script_cyrillic();
    return script === 'greek' ? t.script_greek() : t.script_latin();
  };
  const coverageRange = coverageRanges.length > 0 ? formatUnicodeRange(coverageRanges) : undefined;
  let simulation: PanelInput | undefined;
  let output: ReturnType<typeof buildCss> | undefined;
  if (selected && plan && previewPick) {
    const faces = plan.order.flatMap((id) => {
      const candidate = chosen.find((item) => item.faceId === id)?.candidate;
      return candidate
        ? [
            {
              family: candidate.family,
              localNames: candidate.localNames,
              adjustment: adjustmentOf(baseOf(candidate), manualOf(id)),
              scripts: scriptsOf(
                selected,
                candidate,
                language,
                adjustmentOf(baseOf(candidate), manualOf(id)),
              ),
              unicodeRange: rangeOn ? coverageRange : undefined,
              ...descriptorsOf(candidate.style),
            },
          ]
        : [];
    });
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

  const rankCache = useRef(new Map<string, Ranking | null>());
  const rankOf = (font: LoadedFont, os: OsId, lang: Language, style: FontStyleKey) => {
    const cacheKey = `${font.id}|${os}|${lang}|${style}|${variantsReady}`;
    if (!rankCache.current.has(cacheKey)) {
      try {
        rankCache.current.set(cacheKey, rankFor(font.metrics, os, lang, style));
      } catch (thrown) {
        if (!isNoCoverage(thrown)) throw thrown;
        rankCache.current.set(cacheKey, null);
      }
    }
    return rankCache.current.get(cacheKey) ?? null;
  };
  const strategyOf = (font: LoadedFont) => {
    const lacking = audience ? lacksVerticalOverrides(descriptorSupport(audience.entries)) : 0;
    const ratio = aspectOf(font.metrics);
    return ratio !== null && lacking > 0.05 ? safariStrategyCss(ratio, STRATEGY_LINE_HEIGHT) : '';
  };
  const outputOfFont = (font: LoadedFont) => {
    if (!shares) return undefined;
    const lang: Language = fitLanguage(font.metrics, locale);
    const fontStyle = styleOf(font);
    const fontKind: Category =
      kindChoices[font.id] ?? preset?.kind ?? font.metrics.style.category ?? 'sans-serif';
    const fontPicks = picksByFont[font.id] ?? presetMap ?? NO_PICKS;
    let anyFontRanking: Ranking | undefined;
    const enabledSystems = systems.filter(isEnabled);
    const listsByOs: Partial<Record<OsId, Candidate[]>> = {};
    for (const os of enabledSystems) {
      const ranking = rankOf(font, os, lang, fontStyle);
      if (!ranking) continue;
      anyFontRanking ??= ranking;
      listsByOs[os] = ranking.candidates.filter((item) => item.category === fontKind);
    }
    const fontDefaults = consolidate(listsByOs, shares);
    const fontChosen = enabledSystems.flatMap((os) => {
      const all = listsByOs[os];
      if (!all) return [];
      const explicit = (fontPicks[os] ?? []).flatMap(
        (id) => all.find((item) => item.id === id) ?? [],
      );
      const fallback = fontDefaults[os];
      return (explicit.length > 0 ? explicit : fallback ? [fallback] : all.slice(0, 1)).map(
        (pick) => ({
          os,
          share: shares[os],
          faceId: pick.id,
          candidate: pick,
        }),
      );
    });
    if (fontChosen.length === 0 || !anyFontRanking) return undefined;
    let fontPlan: ReturnType<typeof planStack>;
    try {
      fontPlan = planStack(fontChosen);
      const suggestion = fontPlan.resolution.suggestion?.order;
      if (suggestion) fontPlan = planStack(fontChosen, suggestion);
    } catch (failure) {
      if (failure instanceof StackResolveError) return undefined;
      throw failure;
    }
    const ranges = compactRanges(font.metrics.codePoints);
    const range = rangeOn && ranges.length > 0 ? formatUnicodeRange(ranges) : undefined;
    const adjust = (candidate: Candidate) =>
      adjustmentOf(
        { ...candidate.adjustment, ...optimized[valueKeyOf(font.id, candidate.id)] },
        manualFor(font.id, candidate.id),
      );
    const faces = fontPlan.order.flatMap((id) => {
      const candidate = fontChosen.find((item) => item.faceId === id)?.candidate;
      return candidate
        ? [
            {
              family: candidate.family,
              localNames: candidate.localNames,
              adjustment: adjust(candidate),
              scripts: scriptsOf(font, candidate, lang, adjust(candidate)),
              unicodeRange: range,
              ...descriptorsOf(candidate.style),
            },
          ]
        : [];
    });
    const family = font.metrics.names.family?.trim().slice(0, 200) || 'Custom font';
    let css: ReturnType<typeof buildCss>;
    try {
      css = buildCss(family, faces, fontKind);
    } catch (failure) {
      if (failure instanceof CssExportError) return undefined;
      throw failure;
    }
    const fallback = currentFallback(fontPlan, fontChosen, current);
    return {
      font,
      family,
      kind: fontKind,
      language: lang,
      range,
      strategy: strategyOf(font),
      fallbackFamilies: faces.map((face) => fallbackFamilyName(family, face.family, faces.length)),
      css,
      fallback,
      adjustment: fallback ? adjust(fallback) : undefined,
      scripts: fallback ? scriptsOf(font, fallback, lang, adjust(fallback)) : undefined,
      anyRanking: anyFontRanking,
      candidates: [
        ...new Map(fontChosen.map((item) => [item.candidate.id, item.candidate])).values(),
      ],
    };
  };
  const overview = fonts.map(outputOfFont);
  const overviewReady = overview.filter((entry) => entry !== undefined);

  const vertical = audience ? lacksVerticalOverrides(descriptorSupport(audience.entries)) : 0;
  const aspect = selected ? aspectOf(selected.metrics) : null;
  const safariCss =
    aspect !== null && vertical > 0.05 ? safariStrategyCss(aspect, STRATEGY_LINE_HEIGHT) : '';

  const exportFamily = selected?.metrics.names.family?.trim().slice(0, 200) || 'Custom font';
  const exportEntries = allMode
    ? overviewReady
    : overviewReady.filter((entry) => entry.font.id === selected?.id);
  const exportOutputs: FontOutput[] = exportEntries.map((entry) => ({
    targetFamily: entry.family,
    generic: entry.kind,
    fontFaces: entry.css.fontFaces,
    families: entry.css.families,
    strategy: entry.strategy,
    fileName: entry.font.fileName,
    weight: styleOf(entry.font).includes('bold') ? 700 : 400,
    style: styleOf(entry.font).includes('italic') ? 'italic' : 'normal',
  }));
  const exportFamilies = groupFonts(exportOutputs);
  const exportInput: ExportInput = {
    families: exportFamilies,
    fontFaces: [
      ...new Set(exportOutputs.flatMap((entry) => entry.fontFaces.split('\n\n')).filter(Boolean)),
    ].join('\n\n'),
    strategy: exportEntries[0]?.strategy ?? '',
    css: mergeOutputs(exportOutputs, loadingCss(spacingEm)),
    loadingScript: loadingScript(exportFamilies.map((family) => family.targetFamily)),
  };
  const anyRanking = Object.values(rankings.result).find(Boolean);
  const manualValuesOf = (fontId: number) => {
    const manual: NonNullable<ShareState['manual']> = {};
    for (const [key, entry] of Object.entries(values)) {
      if (!key.startsWith(`${fontId}:`)) continue;
      const faceId = key.slice(String(fontId).length + 1);
      const numbers: Partial<Record<Field, number>> = {};
      for (const { key: field } of FIELDS) {
        const item = entry[field];
        if (item.mode === 'manual') numbers[field] = item.value;
      }
      if (Object.keys(numbers).length > 0) manual[faceId] = numbers;
    }
    return manual;
  };
  const othersOf = (): Record<string, FontState> =>
    Object.fromEntries(
      fonts
        .filter((font) => font.id !== selected?.id)
        .map((font): [string, FontState] => {
          const manual = manualValuesOf(font.id);
          return [
            font.fileName,
            {
              ...(kindChoices[font.id] ? { kind: kindChoices[font.id] } : {}),
              ...(styleChoices[font.id] ? { style: styleChoices[font.id] } : {}),
              ...(picksByFont[font.id] ? { picks: picksByFont[font.id] } : {}),
              ...(Object.keys(manual).length > 0 ? { manual } : {}),
            },
          ];
        })
        .filter(([, saved]) => Object.keys(saved).length > 0),
    );
  const currentShareState = (): ShareState => {
    const manual = selected ? manualValuesOf(selected.id) : {};
    const letter = spacingValues.letter;
    const word = spacingValues.word;
    return {
      v: SHARE_VERSION,
      ...(query ? { query } : {}),
      ...(selected && !allMode ? { fontName: selected.fileName } : {}),
      ...(selected && kindChoices[selected.id] ? { kind: kindChoices[selected.id] } : {}),
      ...(presetId ? { preset: presetId } : {}),
      ...(selected && styleChoices[selected.id] ? { style: styleChoices[selected.id] } : {}),
      disabled: ALL_SYSTEMS.filter((os) => enabledSystems[os] === false),
      picks,
      manual,
      others: othersOf(),
      range: rangeOn,
      ...(perScript ? {} : { scripts: false }),
      spacing: {
        on: spacingOn,
        ...(letter.mode === 'manual' ? { letter: letter.value } : {}),
        ...(word.mode === 'manual' ? { word: word.value } : {}),
      },
    };
  };
  const stateKey = restored ? JSON.stringify(currentShareState()) : '';
  useEffect(() => {
    if (!restored || stateKey === '' || pending.current || stateKey === forgotten) return;
    const timer = setTimeout(() => saveSettings(JSON.parse(stateKey) as ShareState), 400);
    return () => clearTimeout(timer);
  }, [stateKey, restored, forgotten]);
  const [dragging, setDragging] = useState(false);
  const [cssDrop, setCssDrop] = useState<{ id: number; files: File[] }>();
  const dropHandler = useRef<(files: File[]) => void>(() => undefined);
  dropHandler.current = (files) => {
    const fontFiles = files.filter(isFontFile);
    const styleFiles = files.filter(isStyleFile);
    if (fontFiles.length > 0) void addFiles(fontFiles);
    if (styleFiles.length > 0) setCssDrop({ id: Date.now(), files: styleFiles });
    if (fontFiles.length > 0 || styleFiles.length > 0) {
      window.dispatchEvent(new CustomEvent(DOCK_OPEN_EVENT, { detail: 'inputs' }));
    } else if (files.length > 0) {
      setError(t.drop_unsupported());
    }
  };
  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => Boolean(event.dataTransfer?.types.includes('Files'));
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth++;
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      dropHandler.current([...(event.dataTransfer?.files ?? [])]);
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);
  useEffect(() => {
    if (!shareMessage) return;
    const timer = setTimeout(() => setShareMessage(''), 5000);
    return () => clearTimeout(timer);
  }, [shareMessage]);
  const copyLink = async () => {
    try {
      const payload = await encodeShareState(currentShareState());
      const link = `${location.origin}${location.pathname}#${HASH_KEY}${payload}`;
      await navigator.clipboard.writeText(link);
      setShareMessage(t.share_copied());
    } catch {
      setShareMessage(t.share_failed());
    }
  };
  const forget = async () => {
    await clearStorage();
    clearLayouts();
    setForgotten(stateKey);
    setShareMessage(t.share_forgotten());
  };
  const actions = useRef({ copyLink, forget });
  actions.current = { copyLink, forget };
  useEffect(() => {
    const share = document.getElementById('ff-share') as HTMLButtonElement | null;
    const reset = document.getElementById('ff-forget') as HTMLButtonElement | null;
    const onShare = () => void actions.current.copyLink();
    const onForget = () => void actions.current.forget();
    share?.addEventListener('click', onShare);
    reset?.addEventListener('click', onForget);
    if (share) share.disabled = false;
    if (reset) reset.disabled = false;
    return () => {
      share?.removeEventListener('click', onShare);
      reset?.removeEventListener('click', onForget);
    };
  }, []);
  useEffect(() => {
    const status = document.getElementById('ff-header-status');
    if (status) status.textContent = shareMessage;
  }, [shareMessage]);
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
          factorOf(selected),
        );
        const font = variantPredictFont(
          entry.candidate,
          adjustmentOf(baseOf(entry.candidate), manualOf(entry.candidate.id)),
          spacingEm,
          variant,
          fallbackFactor(entry.candidate, selected),
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
  const fitJobs = [
    ...(selected && anyRanking && fitFaces.length > 0
      ? [{ font: selected, language, anyRanking, faces: fitFaces }]
      : []),
    ...overviewReady
      .filter((entry) => entry.font.id !== selected?.id)
      .map((entry) => ({
        font: entry.font,
        language: entry.language,
        anyRanking: entry.anyRanking,
        faces: entry.candidates,
      })),
  ];
  useEffect(() => {
    const found: Record<string, number | null> = {};
    for (const job of fitJobs) {
      for (const candidate of job.faces) {
        const key = calibrationKey(candidate.id, job.font);
        if (fallbackK[key] === undefined && found[key] === undefined) {
          found[key] = fallbackRatio(candidate, fitLanguage(job.font.metrics, locale));
        }
      }
    }
    if (Object.keys(found).length > 0) setFallbackK((current) => ({ ...current, ...found }));
  }, [
    fitJobs
      .map((job) => `${job.font.id}:${job.faces.map((candidate) => candidate.id).join(',')}`)
      .join(';'),
  ]);
  const fitKey = JSON.stringify([
    selected?.id,
    language,
    kind,
    styleKey,
    spacingOn,
    spacingOn ? [spacingKey, spacingValues] : null,
    fitJobs.map((job) => [
      job.font.id,
      factorOf(job.font),
      job.faces.map((candidate) => fallbackFactor(candidate, job.font)),
      job.language,
      styleOf(job.font),
      job.faces.map((candidate) => [candidate.id, manualFor(job.font.id, candidate.id)]),
    ]),
  ]);
  useEffect(() => {
    if (fitJobs.length === 0) return;
    const controller = new AbortController();
    setFitting(true);
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
      for (const [jobIndex, job] of fitJobs.entries()) {
        const model = {
          web: webPredictFont(job.font.metrics, job.anyRanking, undefined, factorOf(job.font)),
          language: job.language,
        };
        for (const [index, candidate] of job.faces.entries()) {
          const free = spacingOn && jobIndex === 0 && index === 0;
          const result = await autoFit({
            candidate,
            manual: manualFor(job.font.id, candidate.id),
            widthK: fallbackFactor(candidate, job.font),
            spacing,
            pinSpacing: { letter: !free || letterManual, word: !free || wordManual },
            model,
            signal: controller.signal,
          });
          if (controller.signal.aborted) return;
          const key = valueKeyOf(job.font.id, candidate.id);
          if (!result) {
            missing.push(key);
            continue;
          }
          found[key] = result.adjustment;
          if (free) {
            spacing = result.spacing;
            spacingFound = result.spacing;
          }
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

  const unmatchedFonts = [
    ...new Set(
      chosen
        .filter((item) => item.candidate.style === 'regular')
        .map((item) => item.candidate.family),
    ),
  ];
  const fitBody =
    selected && current ? (
      <section
        class="ff-generator__section ff-generator__section--plain"
        aria-label={t.fit_heading()}
      >
        <Select
          label={t.fit_type_label()}
          value={kind}
          options={[
            { value: 'sans-serif', label: t.type_sans() },
            { value: 'serif', label: t.type_serif() },
            { value: 'monospace', label: t.type_mono() },
          ]}
          onChange={(value) => {
            setKindChoices((all) => ({ ...all, [selected.id]: value as Category }));
            setPicks({});
            resetOptimization();
            setEditId(undefined);
          }}
        />
        {selected.metrics.style.category === null && kindChoices[selected.id] === undefined && (
          <p class="ff-muted">{t.font_type_unknown()}</p>
        )}
        <label>
          <input
            type="checkbox"
            checked={rangeOn}
            onChange={(event) => setRangeOn(event.currentTarget.checked)}
          />{' '}
          {t.range_enable()}
        </label>
        <p class="ff-muted">{t.range_note({ count: coverageRanges.length })}</p>
        {detectedScripts.length > 1 && (
          <>
            <label>
              <input
                type="checkbox"
                checked={perScript}
                onChange={(event) => setPerScript(event.currentTarget.checked)}
              />{' '}
              {t.script_enable()}
            </label>
            <p class="ff-muted">
              {t.script_note({ scripts: detectedScripts.map(scriptLabel).join(', ') })}
            </p>
          </>
        )}
        {styleKey !== 'regular' && unmatchedFonts.length > 0 && (
          <p class="ff-muted">{t.style_unmatched({ fonts: unmatchedFonts.join(', ') })}</p>
        )}
        <p class="ff-muted">{t.systems_legend()}</p>
        {systems.map((os) => (
          <Collapsible
            key={os}
            icon={<OsIcon os={os} />}
            title={t.systems_share({ system: systemName(os), share: percent(shares?.[os] ?? 0) })}
            open={(openSystem === undefined ? current : openSystem) === os}
            onToggle={(next) => {
              if (next) {
                setActiveOs(os);
                setEditId(undefined);
                setOpenSystem(os);
              } else {
                setOpenSystem(null);
              }
            }}
            before={
              <input
                type="checkbox"
                aria-label={t.systems_include({ system: systemName(os) })}
                checked={isEnabled(os)}
                onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setEnabledSystems((all) => ({ ...all, [os]: checked }));
                }}
              />
            }
          >
            {os === current && (
              <>
                {currentList.map((pick, index) => (
                  <div class="ff-generator__row" key={`${current}-${index}`} data-slot={index}>
                    <Select
                      label={t.fallback_font_n({ n: index + 1 })}
                      value={pick.id}
                      options={currentCandidates
                        .filter(
                          (item) =>
                            item.id === pick.id ||
                            !currentList.some((other) => other.id === item.id),
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
                <p class="ff-muted">{t.fallback_percent_note()}</p>
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
              </>
            )}
          </Collapsible>
        ))}
      </section>
    ) : null;

  const systemSelect =
    current && systems.length > 0 ? (
      <Select
        label={t.tuning_system_label()}
        value={current}
        options={systems.map((os) => ({
          value: os,
          label: t.systems_share({ system: systemName(os), share: percent(shares?.[os] ?? 0) }),
          icon: <OsIcon os={os} />,
        }))}
        onChange={(os) => {
          setActiveOs(os as OsId);
          setOpenSystem(os as OsId);
        }}
      />
    ) : null;
  const previewItems: PreviewItem[] = overviewReady.flatMap((entry) =>
    entry.fallback && entry.adjustment
      ? [
          {
            id: entry.font.id,
            name: displayName(entry.font.metrics.names.fullName ?? entry.font.fileName),
            family: entry.family,
            bytes: entry.font.bytes,
            codePoints: entry.font.metrics.codePoints,
            metrics: entry.font.metrics,
            fallback: entry.fallback,
            adjustment: entry.adjustment,
            unicodeRange: entry.range,
            scripts: entry.scripts,
            ...descriptorsOf(entry.fallback.style),
          },
        ]
      : [],
  );
  const warnings = (
    <>
      {!allMode && output && selected && coverage < LOW_COVERAGE && (
        <p class="ff-error" role="status">
          {t.fit_low_coverage()} {Math.round(coverage * 100)}%
        </p>
      )}
      {!allMode &&
        plan &&
        (shadowed.length > 0 || plan.resolution.blockedBy === 'cycle' || uncovered.length > 0) && (
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
            {plan.resolution.blockedBy === 'cycle' && <p class="ff-error">{t.plan_blocked()}</p>}
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
      {!allMode && plan && !output && selected && <p role="alert">{t.css_error()}</p>}
    </>
  );
  const showResults = allMode ? overviewReady.length > 0 : Boolean(output && selected);
  const fontDetails = fonts.map((font) => {
    const isOpen = fonts.length === 1 ? fontOpen : !allMode && font.id === selected?.id;
    return (
      <Collapsible
        key={font.id}
        title={displayName(font.metrics.names.fullName ?? font.fileName)}
        open={isOpen}
        onToggle={(next) => {
          if (fonts.length === 1) setFontOpen(next);
          else if (next) {
            setSelectedId(font.id);
            setOpenSystem(undefined);
          } else setSelectedId('all');
        }}
        after={
          <>
            <Select
              compact
              hideLabel
              label={t.style_label()}
              value={styleOf(font)}
              options={[
                { value: 'regular', label: t.style_regular() },
                { value: 'italic', label: t.style_italic() },
                { value: 'bold', label: t.style_bold() },
                { value: 'bold-italic', label: t.style_bold_italic() },
              ]}
              onChange={(next) => {
                const key = next as FontStyleKey;
                setStyleChoices((choices) => ({ ...choices, [font.id]: key }));
                resetOptimization();
              }}
            />
            <button
              type="button"
              class="ff-icon-button"
              aria-label={`${t.upload_remove()}: ${font.fileName}`}
              onClick={() => {
                void removeStoredFont(font.fileName);
                setFonts((current) => current.filter((item) => item.id !== font.id));
                setSelectedId((id) => (id === font.id ? undefined : id));
                setValues({});
                resetOptimization();
              }}
            >
              <span aria-hidden="true">×</span>
            </button>
          </>
        }
      >
        {isOpen && fitBody}
      </Collapsible>
    );
  });
  return (
    <div class="ff-generator">
      {dragging && (
        <div class="ff-dropzone" aria-hidden="true">
          {t.drop_anywhere()}
        </div>
      )}
      <Dock
        storageKey="dock"
        resizeLabel={(left, right) => t.columns_resize({ left, right })}
        items={[
          {
            id: 'inputs',
            label: t.col_inputs(),
            weight: 1,
            content: (
              <div class="ff-generator__settings" id="ff-settings">
                <FontUpload
                  locale={locale}
                  busy={busy}
                  compact={fonts.length > 0}
                  onFiles={addFiles}
                />
                <GoogleFontsPicker
                  locale={locale}
                  busy={busy}
                  onFile={(file) => void addFiles([file])}
                />
                <FontsourcePicker
                  locale={locale}
                  busy={busy}
                  onFile={(file) => void addFiles([file])}
                />
                <CssImport locale={locale} busy={busy} onFiles={addFiles} dropped={cssDrop} />
                <SiteImportPanel locale={locale} onImport={setIncoming} />
                {incoming && (
                  <ImportConfirm
                    locale={locale}
                    value={incoming}
                    onAccept={acceptImport}
                    onDiscard={() => {
                      setIncoming(null);
                      void discardPending();
                    }}
                  />
                )}
                {error && (
                  <p class="ff-error" role="alert">
                    {error}
                  </p>
                )}
                <LiveRegion>{announcement}</LiveRegion>
                <LiveRegion>{planIssue || planNote}</LiveRegion>
                {selected && rankings.noCoverage && Object.keys(rankings.result).length === 0 && (
                  <p role="alert">{t.fit_no_coverage()}</p>
                )}
                {selected && !shares && <p class="ff-muted">{t.plan_waiting()}</p>}
                {restored && (
                  <AudienceEditor
                    defaultOpen
                    initialQuery={initialQuery}
                    onQueryChange={setQuery}
                    locale={locale}
                    onShares={handleShares}
                    onEntries={setAudience}
                    active={fonts.length > 0}
                  />
                )}
              </div>
            ),
          },
          {
            id: 'tuning',
            label: t.col_tuning(),
            weight: 1,
            content: (
              <div class="ff-generator__settings">
                {warnings}
                {preset && (
                  <section class="ff-generator__section" aria-label={t.preset_applied_heading()}>
                    <p>{t.preset_applied({ name: presetName(t, preset.id) })}</p>
                    <p class="ff-muted">{cssStack(preset)}</p>
                    <Button
                      onClick={() => {
                        setPresetId(undefined);
                        setPicksByFont({});
                        setKindChoices({});
                        resetOptimization();
                      }}
                    >
                      {t.preset_clear()}
                    </Button>
                  </section>
                )}
                {fonts.length === 0 && <p class="ff-muted">{t.tuning_empty()}</p>}
                {allMode && (
                  <>
                    <p class="ff-muted">{t.tuning_all_note()}</p>
                    {systemSelect}
                  </>
                )}
                {fontDetails}
              </div>
            ),
          },
          {
            id: 'results',
            label: t.col_results(),
            weight: 2,
            content: showResults ? (
              <Accordion
                storageKey="results"
                resizable={false}
                resizeLabel={(above, below) => t.accordion_resize({ above, below })}
                items={[
                  {
                    id: 'export',
                    label: t.export_heading(),
                    content: (
                      <ExportPanel
                        locale={locale}
                        input={exportInput}
                        report={reportText}
                        reordered={reordered}
                        multi={allMode}
                      />
                    ),
                  },
                  {
                    id: 'coverage',
                    label: t.coverage_heading(),
                    open: false,
                    content: allMode ? (
                      <p class="ff-muted">{t.results_pick_font()}</p>
                    ) : (
                      selected && (
                        <CoverageMap locale={locale} codePoints={selected.metrics.codePoints} />
                      )
                    ),
                  },
                  {
                    id: 'support',
                    label: t.matrix_heading(),
                    open: false,
                    content: allMode ? (
                      <p class="ff-muted">{t.results_pick_font()}</p>
                    ) : (
                      <>
                        <SupportMatrix locale={locale} groups={matrixGroups} rating={ratingText} />
                        {simulation && output && (
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
            ),
          },
        ]}
      />
      <div class="ff-generator__stage">
        <LiveRegion>{fitting ? t.fit_running() : ''}</LiveRegion>
        <ArticleView locale={locale} items={previewItems} fitting={fitting} site={site} />
      </div>
    </div>
  );
}
