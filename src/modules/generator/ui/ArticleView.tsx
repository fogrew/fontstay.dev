import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Icon, Popover, Select } from '@/common/ui';
import { measureShift, type WidthShift } from '../lib/article-shift';
import {
  ARTICLE_LANGUAGES,
  type Article,
  type ArticleId,
  type ArticleKey,
  BUILT_IN,
  isBuiltIn,
  loadArticle,
  type Run,
  siteArticle,
} from '../lib/articles';
import { buildCss } from '../lib/css';
import { drawGlyphBoxes } from '../lib/glyph-boxes';
import { GUIDES, type GuideId, type GuideOffsets, guideImage, guideOffsets } from '../lib/guides';
import { isInstalledOnDevice } from '../lib/installed';
import { codePointLabel, textRuns } from '../lib/missing';
import { slugOf } from '../lib/overview';
import type { PreviewItem, SiteData } from '../lib/preview-item';
import { DeviceShift } from './DeviceShift';
import { IntroGuide } from './IntroGuide';

type Mode = 'overlay' | 'side' | 'loupe' | 'web' | 'fallback' | 'plain';
type Wrap = 'wrap' | 'balance' | 'pretty' | 'stable' | 'nowrap';
type Substitute = 'sans-serif' | 'serif' | 'monospace' | 'system-ui';
type Layer = 'web' | 'fallback';
type Render = 'fill' | 'outline';
type LayerColor = 'text' | 'green' | 'red' | 'blue' | 'amber';

interface LayerStyle {
  render: Render;
  color: LayerColor;
  width: number;
  opacity: number;
}

const LAYERS: readonly Layer[] = ['web', 'fallback'];
const RENDERS: readonly Render[] = ['fill', 'outline'];
const COLORS: readonly LayerColor[] = ['text', 'green', 'red', 'blue', 'amber'];
const COLOR_TOKENS: Record<LayerColor, string> = {
  text: '--ff-text',
  green: '--ff-accent',
  red: '--ff-error',
  blue: '--ff-focus',
  amber: '--ff-rating-needs',
};
const DEFAULT_LAYERS: Record<Layer, LayerStyle> = {
  web: { render: 'fill', color: 'text', width: 1, opacity: 100 },
  fallback: { render: 'outline', color: 'green', width: 1, opacity: 100 },
};

const MODES: readonly Mode[] = ['overlay', 'side', 'loupe', 'web', 'fallback', 'plain'];
const LENS_STEP = 24;
const WRAPS: readonly Wrap[] = ['wrap', 'balance', 'pretty', 'stable', 'nowrap'];
const SUBSTITUTES: readonly Substitute[] = ['sans-serif', 'serif', 'monospace', 'system-ui'];
const KEY_PREFIX = 'ff-web-';
const SYSTEM = '__system__';

const keyOf = (family: string) => `${KEY_PREFIX}${slugOf(family)}`;

interface Coverage {
  heading: Uint32Array | 'all';
  body: Uint32Array | 'all';
  note: (char: string) => string;
  plain: boolean;
}

function Marked({
  text,
  points,
  coverage,
}: {
  text: string;
  points: Uint32Array | 'all';
  coverage: Coverage;
}) {
  if (coverage.plain || points === 'all') return <>{text}</>;
  return (
    <>
      {textRuns(text, points).map((run, index) =>
        run.covered ? (
          <Fragment key={index}>{run.text}</Fragment>
        ) : (
          <mark
            key={index}
            class="ff-article__missing"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: focus reveals why the character is highlighted
            tabIndex={0}
            aria-description={coverage.note(run.text)}
          >
            {run.text}
            <span class="ff-article__tip" aria-hidden="true">
              {coverage.note(run.text)}
            </span>
          </mark>
        ),
      )}
    </>
  );
}

function Runs({ runs, coverage }: { runs: readonly Run[]; coverage: Coverage }) {
  const text = (value: string) => (
    <Marked text={value} points={coverage.body} coverage={coverage} />
  );
  return (
    <>
      {runs.map((run, index) => {
        if (typeof run === 'string') return <Fragment key={index}>{text(run)}</Fragment>;
        if ('bold' in run) return <strong key={index}>{text(run.bold)}</strong>;
        if ('italic' in run) return <em key={index}>{text(run.italic)}</em>;
        if ('sup' in run) return <sup key={index}>{text(run.sup)}</sup>;
        if ('sub' in run) return <sub key={index}>{text(run.sub)}</sub>;
        return <code key={index}>{text(run.code)}</code>;
      })}
    </>
  );
}

function ArticleBody({ article, coverage }: { article: Article; coverage: Coverage }) {
  const body = (value: string) => (
    <Marked text={value} points={coverage.body} coverage={coverage} />
  );
  const heading = (value: string) => (
    <Marked text={value} points={coverage.heading} coverage={coverage} />
  );
  if (article.id === 'site') {
    return (
      <header class="ff-article__hero">
        {article.title && <h3 class="ff-article__title">{heading(article.title)}</h3>}
        {article.lead && <p class="ff-article__lead">{body(article.lead)}</p>}
      </header>
    );
  }
  return (
    <>
      <header class="ff-article__hero">
        <p class="ff-article__kicker">{body(article.kicker)}</p>
        <h3 class="ff-article__title">{heading(article.title)}</h3>
        <p class="ff-article__lead">{body(article.lead)}</p>
        <p class="ff-article__meta">{body(article.meta)}</p>
      </header>
      {article.factors.length > 0 && (
        <ul class="ff-article__factors">
          {article.factors.map((factor) => (
            <li key={factor.title} class="ff-article__factor">
              <Icon name={factor.icon} />
              <h4>{heading(factor.title)}</h4>
              <p>{body(factor.text)}</p>
            </li>
          ))}
        </ul>
      )}
      <section>
        <h4 class="ff-article__heading">{heading(article.columnsHeading)}</h4>
        <div class="ff-article__columns">
          {article.columns.map((paragraph, index) => (
            <p key={index}>
              <Runs runs={paragraph} coverage={coverage} />
            </p>
          ))}
        </div>
      </section>
      <div class="ff-article__split">
        <figure class="ff-article__quote">
          <blockquote>{body(article.quote.text)}</blockquote>
          <figcaption>{body(article.quote.cite)}</figcaption>
        </figure>
        {article.list.length > 0 && (
          <section>
            <h4 class="ff-article__heading">{heading(article.listHeading)}</h4>
            <ol>
              {article.list.map((item, index) => (
                <li key={index}>
                  <Runs runs={item} coverage={coverage} />
                </li>
              ))}
            </ol>
          </section>
        )}
        {article.tableRows.length > 0 && (
          <section>
            <h4 class="ff-article__heading">{heading(article.tableHeading)}</h4>
            <table>
              <thead>
                <tr>
                  {article.tableHead.map((cell) => (
                    <th key={cell} scope="col">
                      {heading(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {article.tableRows.map((row) => (
                  <tr key={row[0]}>
                    <th scope="row">{heading(row[0])}</th>
                    <td>{body(row[1])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
      <section>
        <h4 class="ff-article__heading">{heading(article.glyphsHeading)}</h4>
        <p class="ff-article__glyphs">{body(article.glyphs)}</p>
      </section>
      <footer class="ff-article__footer">{body(article.footer)}</footer>
    </>
  );
}

export function ArticleView({
  locale,
  items,
  fitting = false,
  site,
  onShift,
}: {
  locale: Locale;
  items: readonly PreviewItem[];
  fitting?: boolean;
  site?: SiteData | undefined;
  onShift?:
    | ((report: { adjusted: WidthShift[]; plain: WidthShift[] } | undefined) => void)
    | undefined;
}) {
  const t = messagesFor(locale);
  const [articleId, setArticleId] = useState<ArticleKey>(locale === 'ru' ? 'ru' : 'en');
  const [mode, setMode] = useState<Mode>('overlay');
  const [size, setSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.5);
  const [wrap, setWrap] = useState<Wrap>('wrap');
  const [substitute, setSubstitute] = useState<Substitute>('sans-serif');
  const [headingPick, setHeadingPick] = useState<string>();
  const [bodyPick, setBodyPick] = useState<string>();
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [stacked, setStacked] = useState(false);
  const [lensShows, setLensShows] = useState<'overlay' | 'fallback'>('overlay');
  const [lensSize, setLensSize] = useState(200);
  const loupe = useRef<HTMLDivElement>(null);
  const [guideOn, setGuideOn] = useState<Record<GuideId, boolean>>({
    ascender: false,
    cap: false,
    x: false,
    baseline: false,
    descender: false,
  });
  const [boxes, setBoxes] = useState(false);
  const [guideMetrics, setGuideMetrics] = useState<Partial<Record<Layer, GuideOffsets>>>({});
  const activeGuides = GUIDES.filter((id) => guideOn[id]);
  const guides = activeGuides.length > 0;
  const view = useRef<HTMLElement>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [loadFailed, setLoadFailed] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [shiftResults, setShiftResults] = useState<{
    adjusted: WidthShift[];
    plain: WidthShift[];
  }>();
  const probe = useRef<HTMLDivElement>(null);
  const [notInstalled, setNotInstalled] = useState<string[]>([]);
  useEffect(() => {
    if (!site) return;
    setArticleId('site');
    if (site.size) setSize(Math.min(32, Math.max(12, Math.round(site.size))));
    if (site.lineHeight)
      setLineHeight(Math.min(2.4, Math.max(1, Math.round(site.lineHeight * 20) / 20)));
  }, [site]);
  const [loaded, setLoaded] = useState<Partial<Record<ArticleId, Article>>>({});
  useEffect(() => {
    if (articleId === 'site' || isBuiltIn(articleId) || loaded[articleId]) return;
    let cancelled = false;
    void loadArticle(articleId).then((value) => {
      if (value && !cancelled) setLoaded((all) => ({ ...all, [articleId]: value }));
    });
    return () => {
      cancelled = true;
    };
  }, [articleId, loaded]);
  const shown =
    articleId === 'site'
      ? undefined
      : isBuiltIn(articleId)
        ? BUILT_IN[articleId]
        : (loaded[articleId] ?? BUILT_IN.en);
  const article =
    articleId === 'site' && site
      ? siteArticle({ heading: site.heading, body: site.body }, t.article_site(), locale)
      : (shown ?? BUILT_IN.en);

  const families = useMemo(() => [...new Set(items.map((item) => item.family))], [items]);
  const siteFamily = (stack: string | undefined) =>
    families.find((family) =>
      (stack ?? '').split(',').some(
        (name) =>
          name
            .trim()
            .replace(/^["']|["']$/g, '')
            .toLowerCase() === family.toLowerCase(),
      ),
    );
  const headingFamily = [...families, SYSTEM].includes(headingPick ?? '')
    ? headingPick
    : (siteFamily(site?.headingStack) ?? families[0]);
  const bodyFamily = [...families, SYSTEM].includes(bodyPick ?? '')
    ? bodyPick
    : (siteFamily(site?.bodyStack) ?? families[1] ?? families[0]);
  const categoryOf = (family: string | undefined) =>
    items.find((item) => item.family === family)?.fallback.category ?? 'sans-serif';

  const localKey = items
    .map((item) => `${item.id}:${item.fallback.localNames.join('|')}`)
    .join(';');
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const missing: string[] = [];
      for (const item of items) {
        if (!(await isInstalledOnDevice(item.fallback.localNames))) {
          missing.push(item.fallback.family);
        }
      }
      if (!cancelled) setNotInstalled([...new Set(missing)]);
    })();
    return () => {
      cancelled = true;
    };
  }, [localKey]);

  const byteKey = items.map((item) => item.id).join(',');
  useEffect(() => {
    setFontsReady(false);
    let cancelled = false;
    const faces = items.map(
      (item) =>
        new FontFace(keyOf(item.family), item.bytes.slice(0), {
          weight: String(item.fontWeight ?? 400),
          style: item.fontStyle ?? 'normal',
        }),
    );
    Promise.all(faces.map((face) => face.load()))
      .then(() => {
        if (cancelled) return;
        for (const face of faces) document.fonts.add(face);
        setLoadFailed(false);
        setFontsReady(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
      for (const face of faces) document.fonts.delete(face);
    };
  }, [byteKey]);

  const fontFaces = items
    .map(
      (item) =>
        buildCss(
          keyOf(item.family),
          [
            {
              family: item.fallback.family,
              localNames: item.fallback.localNames,
              adjustment: item.adjustment,
              scripts: item.scripts,
              unicodeRange: item.unicodeRange,
              fontWeight: item.fontWeight,
              fontStyle: item.fontStyle,
            },
          ],
          item.fallback.category,
        ).fontFaces,
    )
    .join('\n\n');
  useEffect(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(fontFaces);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((entry) => entry !== sheet);
    };
  }, [fontFaces]);

  const pointsOf = (family: string | undefined): Uint32Array | 'all' => {
    if (family === SYSTEM) return 'all';
    const merged = new Set<number>();
    for (const item of items) {
      if (item.family === family) for (const point of item.codePoints) merged.add(point);
    }
    return Uint32Array.from(merged);
  };
  const headingPoints = useMemo(() => pointsOf(headingFamily), [headingFamily, byteKey]);
  const bodyPoints = useMemo(() => pointsOf(bodyFamily), [bodyFamily, byteKey]);

  useEffect(() => {
    if (!fontsReady) return;
    let cancelled = false;
    setShiftResults(undefined);
    const timer = setTimeout(() => {
      void document.fonts.ready.then(() => {
        const wrapper = probe.current;
        const [web, fallback, plain] = wrapper?.querySelectorAll('article') ?? [];
        if (cancelled || !wrapper || !web || !fallback || !plain) return;
        const report = {
          adjusted: measureShift(wrapper, web, fallback),
          plain: measureShift(wrapper, web, plain),
        };
        setShiftResults(report);
        onShift?.(report);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    fontsReady,
    fontFaces,
    size,
    lineHeight,
    wrap,
    articleId,
    headingFamily,
    bodyFamily,
    substitute,
  ]);

  const empty = items.length === 0 || !headingFamily || !bodyFamily;
  const stack = (family: string | undefined, kind: 'web' | 'fallback' | 'plain') => {
    if (!family || family === SYSTEM) return 'system-ui, sans-serif';
    const key = keyOf(family);
    if (kind === 'web') return `"${key}", ${substitute}`;
    if (kind === 'fallback') return `"${key} Fallback", ${substitute}`;
    return categoryOf(family);
  };
  const pageStyle = (kind: 'web' | 'fallback' | 'plain') => {
    const layer = kind === 'plain' ? undefined : layers[kind];
    const styled = layer && mode === 'overlay';
    const inspecting = mode !== 'plain';
    const metrics = kind === 'plain' ? undefined : guideMetrics[kind];
    const image = metrics ? guideImage(metrics, activeGuides) : undefined;
    return {
      '--ff-article-heading': stack(headingFamily, kind),
      '--ff-article-body': stack(bodyFamily, kind),
      '--ff-article-size': `${size}px`,
      '--ff-article-line': String(lineHeight),
      ...(kind !== 'plain' && layer
        ? {
            '--ff-layer-color': `var(${COLOR_TOKENS[styled ? layer.color : DEFAULT_LAYERS[kind].color]})`,
          }
        : {}),
      ...(styled ? { '--ff-layer-stroke': `${layer.width}px`, opacity: layer.opacity / 100 } : {}),
      ...(image && guides && inspecting ? { '--ff-guides': image } : {}),
      textWrap: wrap,
    };
  };
  useEffect(() => {
    if (!guides || mode === 'plain' || !fontsReady || !bodyFamily) return;
    let cancelled = false;
    void (async () => {
      const next: Partial<Record<Layer, GuideOffsets>> = {};
      for (const layer of LAYERS) {
        const family = stack(bodyFamily, layer);
        await document.fonts.load(`${size}px ${family}`).catch(() => []);
        const offsets = guideOffsets(family, size, lineHeight);
        if (offsets) next[layer] = offsets;
      }
      if (!cancelled) setGuideMetrics(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [guides, mode, fontsReady, fontFaces, size, lineHeight, bodyFamily, substitute]);

  useEffect(() => {
    const root = view.current;
    if (!boxes || !root || !fontsReady || mode === 'plain') return;
    const pages = [...root.querySelectorAll<HTMLElement>('.ff-article:not([data-probe])')];
    const draw = () => {
      for (const element of pages) {
        const canvas = element.querySelector<HTMLCanvasElement>('canvas.ff-article__boxes');
        if (canvas) drawGlyphBoxes(element, canvas);
      }
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    void document.fonts.ready.then(schedule);
    const observer = new ResizeObserver(schedule);
    for (const element of pages) observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [
    boxes,
    mode,
    stacked,
    layers,
    fontsReady,
    fontFaces,
    size,
    lineHeight,
    wrap,
    articleId,
    headingFamily,
    bodyFamily,
    substitute,
  ]);

  const modeShort = (value: Mode) => {
    if (value === 'web') return t.mode_web_short();
    if (value === 'fallback') return t.mode_fallback_short();
    if (value === 'plain') return t.mode_plain_short();
    return modeLabel(value);
  };
  const modeLabel = (value: Mode) => {
    if (value === 'overlay') return t.mode_overlay();
    if (value === 'loupe') return t.mode_loupe();
    if (value === 'side') return t.mode_side();
    if (value === 'web') return t.preview_web_label();
    return value === 'fallback' ? t.preview_fallback_label() : t.article_view_plain();
  };
  const wrapLabel = (value: Wrap) => {
    if (value === 'wrap') return t.article_wrap_wrap();
    if (value === 'balance') return t.article_wrap_balance();
    if (value === 'pretty') return t.article_wrap_pretty();
    return value === 'stable' ? t.article_wrap_stable() : t.article_wrap_nowrap();
  };
  const substituteLabel = (value: Substitute) => {
    if (value === 'serif') return t.type_serif();
    if (value === 'monospace') return t.type_mono();
    return value === 'system-ui' ? t.missing_system() : t.type_sans();
  };
  const coverageFor = (plain: boolean): Coverage => ({
    heading: headingPoints,
    body: bodyPoints,
    plain,
    note: (text) => {
      const chars = [...text];
      const listed = chars
        .slice(0, 3)
        .map((char) => `${char} (${codePointLabel(char)})`)
        .join(', ');
      const more = chars.length > 3 ? ` +${chars.length - 3}` : '';
      return t.article_unsupported({
        chars: `${listed}${more}`,
        font: substituteLabel(substitute),
      });
    },
  });
  const page = (kind: 'web' | 'fallback' | 'plain', ghost = false) => (
    <article
      class={`ff-article${ghost ? ' ff-article--ghost' : ''}${wrap === 'nowrap' ? ' ff-article--nowrap' : ''}`}
      lang={article.lang}
      dir={article.dir}
      aria-hidden={ghost ? 'true' : undefined}
      data-render={mode === 'overlay' && kind !== 'plain' ? layers[kind].render : undefined}
      data-guides={guides && mode !== 'plain' ? '' : undefined}
      style={pageStyle(kind)}
    >
      <ArticleBody article={article} coverage={coverageFor(ghost || kind !== 'web')} />
      {boxes && kind !== 'plain' && mode !== 'plain' && (
        // biome-ignore lint/a11y/noAriaHiddenOnFocusable: a decorative canvas without fallback content
        <canvas class="ff-article__boxes" aria-hidden="true" />
      )}
    </article>
  );
  const colorLabel = (value: LayerColor) => {
    if (value === 'text') return t.layer_color_text();
    if (value === 'green') return t.layer_color_green();
    if (value === 'red') return t.layer_color_red();
    return value === 'blue' ? t.layer_color_blue() : t.layer_color_amber();
  };
  const guideLabel = (id: (typeof GUIDES)[number]) => {
    if (id === 'ascender') return t.guide_ascender();
    if (id === 'cap') return t.guide_cap();
    if (id === 'x') return t.guide_x();
    return id === 'baseline' ? t.guide_baseline() : t.guide_descender();
  };
  const setLayer = (layer: Layer, change: Partial<LayerStyle>) =>
    setLayers((all) => ({ ...all, [layer]: { ...all[layer], ...change } }));
  const inspectable = mode !== 'plain';
  const moveLens = (x: number, y: number) => {
    const element = loupe.current;
    if (!element) return;
    element.style.setProperty('--ff-lens-x', `${x}px`);
    element.style.setProperty('--ff-lens-y', `${y}px`);
    element.style.setProperty('--ff-lens-r', `${lensSize / 2}px`);
  };
  const hideLens = () => loupe.current?.style.setProperty('--ff-lens-r', '0px');
  const inspectContent = (
    <>
      <fieldset class="ff-inspect__section" disabled={mode !== 'loupe'}>
        <legend>{t.mode_loupe()}</legend>
        <Select
          compact
          label={t.loupe_shows()}
          value={lensShows}
          options={[
            { value: 'overlay', label: t.mode_overlay() },
            { value: 'fallback', label: t.preview_fallback_label() },
          ]}
          onChange={(value) => setLensShows(value as 'overlay' | 'fallback')}
        />
        <div class="ff-field ff-preview__slider">
          <div class="ff-preview__label">
            <label for="ff-lens-size">{t.loupe_size()}</label>
            <output for="ff-lens-size">{lensSize}px</output>
          </div>
          <input
            id="ff-lens-size"
            type="range"
            min={80}
            max={400}
            step={10}
            value={lensSize}
            onInput={(event) => setLensSize(event.currentTarget.valueAsNumber)}
          />
        </div>
      </fieldset>
      <fieldset class="ff-inspect__section" disabled={!inspectable}>
        <legend>{t.guides_enable()}</legend>
        <ul class="ff-guide-list">
          {GUIDES.map((id) => (
            <li key={id}>
              <label data-guide={id}>
                <input
                  type="checkbox"
                  checked={guideOn[id]}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setGuideOn((all) => ({ ...all, [id]: checked }));
                  }}
                />{' '}
                <span class="ff-guide-list__swatch" aria-hidden="true" /> {guideLabel(id)}
              </label>
            </li>
          ))}
        </ul>
        <label>
          <input
            type="checkbox"
            checked={boxes}
            onChange={(event) => setBoxes(event.currentTarget.checked)}
          />{' '}
          {t.boxes_enable()}
        </label>
      </fieldset>
      <fieldset class="ff-inspect__section ff-layers" disabled={mode !== 'overlay'}>
        <legend>{t.article_group_layers()}</legend>
        {LAYERS.map((layer, row) => {
          const name = layer === 'web' ? t.preview_web_label() : t.preview_fallback_label();
          const caption = row === 0 ? undefined : 'ff-sr-only';
          return (
            <fieldset class="ff-layers__row" key={layer}>
              <legend class="ff-sr-only">{name}</legend>
              <span class="ff-layers__name" aria-hidden="true">
                {name}
              </span>
              <Select
                compact
                hideLabel={row > 0}
                label={t.layer_render()}
                value={layers[layer].render}
                disabled={mode !== 'overlay'}
                options={RENDERS.map((value) => ({
                  value,
                  label: value === 'fill' ? t.layer_render_fill() : t.layer_render_outline(),
                }))}
                onChange={(value) => setLayer(layer, { render: value as Render })}
              />
              <Select
                compact
                hideLabel={row > 0}
                label={t.layer_color()}
                value={layers[layer].color}
                disabled={mode !== 'overlay'}
                options={COLORS.map((value) => ({ value, label: colorLabel(value) }))}
                onChange={(value) => setLayer(layer, { color: value as LayerColor })}
              />
              <div class="ff-field ff-preview__slider">
                <div class="ff-preview__label">
                  <label class={caption} for={`ff-layer-${layer}-width`}>
                    {t.layer_width()}
                  </label>
                  <output for={`ff-layer-${layer}-width`}>{layers[layer].width}px</output>
                </div>
                <input
                  id={`ff-layer-${layer}-width`}
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.5}
                  value={layers[layer].width}
                  disabled={mode !== 'overlay' || layers[layer].render !== 'outline'}
                  onInput={(event) => setLayer(layer, { width: event.currentTarget.valueAsNumber })}
                />
              </div>
              <div class="ff-field ff-preview__slider">
                <div class="ff-preview__label">
                  <label class={caption} for={`ff-layer-${layer}-opacity`}>
                    {t.layer_opacity()}
                  </label>
                  <output for={`ff-layer-${layer}-opacity`}>{layers[layer].opacity}%</output>
                </div>
                <input
                  id={`ff-layer-${layer}-opacity`}
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={layers[layer].opacity}
                  disabled={mode !== 'overlay'}
                  onInput={(event) =>
                    setLayer(layer, { opacity: event.currentTarget.valueAsNumber })
                  }
                />
              </div>
            </fieldset>
          );
        })}
      </fieldset>
    </>
  );
  const familyOptions = [
    ...families.map((family) => ({ value: family, label: family })),
    { value: SYSTEM, label: t.article_font_system() },
  ];
  const contentGroup = (
    <fieldset class="ff-article-view__group">
      <legend>{t.article_group_content()}</legend>
      <div class="ff-field ff-preview__slider">
        <div class="ff-preview__label">
          <label for="ff-article-size">{t.preview_size_label()}</label>
          <output for="ff-article-size">{size}px</output>
        </div>
        <input
          id="ff-article-size"
          type="range"
          min={12}
          max={32}
          value={size}
          onInput={(event) => setSize(event.currentTarget.valueAsNumber)}
        />
      </div>
      <div class="ff-field ff-preview__slider">
        <div class="ff-preview__label">
          <label for="ff-article-line">{t.preview_line_height_label()}</label>
          <output for="ff-article-line">{lineHeight}</output>
        </div>
        <input
          id="ff-article-line"
          type="range"
          min={1}
          max={2.4}
          step={0.05}
          value={lineHeight}
          onInput={(event) => setLineHeight(event.currentTarget.valueAsNumber)}
        />
      </div>
      <Select
        compact
        label={t.article_wrap_label()}
        value={wrap}
        options={WRAPS.map((value) => ({ value, label: wrapLabel(value) }))}
        onChange={(value) => setWrap(value as Wrap)}
      />
      <Select
        compact
        label={t.article_sample_label()}
        value={articleId}
        options={[
          ...(site ? [{ value: 'site', label: t.article_site() }] : []),
          ...ARTICLE_LANGUAGES.map(([id, label]) => ({ value: id, label })),
        ]}
        onChange={(value) => setArticleId(value as ArticleKey)}
      />
    </fieldset>
  );

  if (empty) {
    return (
      <section class="ff-article-view" aria-label={t.article_heading()}>
        <IntroGuide locale={locale} />
        <p class="ff-article-view__hint">{t.article_empty_hint()}</p>
        <div class="ff-article-view__controls">{contentGroup}</div>
        <article
          class={`ff-article${wrap === 'nowrap' ? ' ff-article--nowrap' : ''}`}
          lang={article.lang}
          dir={article.dir}
          style={hydrated ? pageStyle('web') : undefined}
        >
          <ArticleBody article={article} coverage={coverageFor(true)} />
        </article>
      </section>
    );
  }

  return (
    <section class="ff-article-view" aria-label={t.article_heading()} ref={view}>
      <div class="ff-article-probe" ref={probe} aria-hidden="true" {...{ inert: true }}>
        {(['web', 'fallback', 'plain'] as const).map((kind) => (
          <article
            key={kind}
            data-probe=""
            class={`ff-article${wrap === 'nowrap' ? ' ff-article--nowrap' : ''}`}
            lang={article.lang}
            dir={article.dir}
            style={pageStyle(kind)}
          >
            <ArticleBody article={article} coverage={coverageFor(true)} />
          </article>
        ))}
      </div>
      <div class="ff-article-view__controls ff-toolbar">
        <fieldset class="ff-preview__modes ff-toolbar__modes">
          <legend class="ff-sr-only">{t.preview_mode_label()}</legend>
          {MODES.map((value) => (
            <Fragment key={value}>
              <button
                type="button"
                class="ff-button ff-button--secondary"
                aria-pressed={mode === value}
                aria-label={modeLabel(value)}
                title={modeLabel(value)}
                onClick={() => setMode(value)}
              >
                {modeShort(value)}
              </button>
              {value === 'side' && (
                <span class="ff-preview__arrange" data-active={mode === 'side'}>
                  {(['horizontal', 'stacked'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      class="ff-button ff-button--secondary ff-preview__arrange-button"
                      aria-pressed={stacked === (kind === 'stacked')}
                      aria-label={kind === 'stacked' ? t.side_stacked() : t.side_horizontal()}
                      title={kind === 'stacked' ? t.side_stacked() : t.side_horizontal()}
                      disabled={mode !== 'side'}
                      onClick={() => setStacked(kind === 'stacked')}
                    >
                      <span class="ff-arrange-icon" data-kind={kind} aria-hidden="true" />
                    </button>
                  ))}
                </span>
              )}
            </Fragment>
          ))}
        </fieldset>
        <Popover label={t.article_group_content()}>{contentGroup}</Popover>
        <Popover label={t.article_group_fonts()}>
          <Select
            compact
            label={t.article_heading_font()}
            value={headingFamily ?? SYSTEM}
            options={familyOptions}
            onChange={setHeadingPick}
          />
          <Select
            compact
            label={t.article_body_font()}
            value={bodyFamily ?? SYSTEM}
            options={familyOptions}
            onChange={setBodyPick}
          />
          <Select
            compact
            label={t.article_missing_font()}
            value={substitute}
            options={SUBSTITUTES.map((value) => ({ value, label: substituteLabel(value) }))}
            onChange={(value) => setSubstitute(value as Substitute)}
          />
        </Popover>
        <Popover label={t.article_group_inspect()} badge={activeGuides.length + (boxes ? 1 : 0)}>
          {inspectContent}
        </Popover>
        <DeviceShift
          locale={locale}
          results={shiftResults?.adjusted}
          baseline={shiftResults?.plain}
          fitting={fitting}
        />
      </div>
      {loadFailed && (
        <p class="ff-error" role="alert">
          {t.preview_load_failed()}
        </p>
      )}
      {notInstalled.length > 0 && (
        <p role="status">
          <span class="ff-error">{t.preview_not_installed({ font: notInstalled.join(', ') })}</span>{' '}
          <span class="ff-muted">{t.preview_not_installed_note()}</span>
        </p>
      )}
      {mode === 'overlay' && (
        <div class="ff-article-view__overlay">
          {page('web')}
          {page('fallback', true)}
          <p class="ff-muted ff-article-view__legend">{t.overlay_legend()}</p>
        </div>
      )}
      {mode === 'side' && (
        <div class="ff-article-view__side" data-stacked={stacked ? '' : undefined}>
          <figure>
            <figcaption>{t.preview_web_label()}</figcaption>
            {page('web')}
          </figure>
          <figure>
            <figcaption>{t.preview_fallback_label()}</figcaption>
            {page('fallback')}
          </figure>
        </div>
      )}
      {mode === 'loupe' && (
        <div
          class="ff-article-view__loupe"
          ref={loupe}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: the lens follows the arrow keys
          tabIndex={0}
          role="application"
          aria-label={t.loupe_label()}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            moveLens(event.clientX - box.left, event.clientY - box.top);
          }}
          onPointerLeave={hideLens}
          onFocus={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            moveLens(box.width / 2, Math.min(box.height / 2, 240));
          }}
          onBlur={hideLens}
          onKeyDown={(event) => {
            const element = event.currentTarget;
            const x = Number.parseFloat(element.style.getPropertyValue('--ff-lens-x')) || 0;
            const y = Number.parseFloat(element.style.getPropertyValue('--ff-lens-y')) || 0;
            const moves: Record<string, [number, number]> = {
              ArrowLeft: [-LENS_STEP, 0],
              ArrowRight: [LENS_STEP, 0],
              ArrowUp: [0, -LENS_STEP],
              ArrowDown: [0, LENS_STEP],
            };
            const move = moves[event.key];
            if (move) {
              event.preventDefault();
              moveLens(x + move[0], y + move[1]);
            } else if (event.key === 'Escape') {
              hideLens();
            }
          }}
        >
          {page('web')}
          <div class="ff-article-view__lens" aria-hidden="true" {...{ inert: true }}>
            {lensShows === 'overlay' ? (
              <div class="ff-article-view__overlay">
                {page('web')}
                {page('fallback', true)}
              </div>
            ) : (
              page('fallback')
            )}
          </div>
          <span class="ff-article-view__ring" aria-hidden="true" />
        </div>
      )}
      {(mode === 'web' || mode === 'fallback' || mode === 'plain') && page(mode)}
    </section>
  );
}
