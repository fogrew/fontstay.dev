import { Fragment } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Icon, Select } from '@/common/ui';
import { measureShift, type WidthShift } from '../lib/article-shift';
import { ARTICLE_IDS, ARTICLES, type Article, type ArticleId, type Run } from '../lib/articles';
import { buildCss } from '../lib/css';
import { drawGlyphBoxes } from '../lib/glyph-boxes';
import { GUIDES, guideImage, guideOffsets } from '../lib/guides';
import { isInstalledOnDevice } from '../lib/installed';
import { codePointLabel, textRuns } from '../lib/missing';
import { slugOf } from '../lib/overview';
import type { PreviewItem } from '../lib/preview-item';
import { DeviceShift } from './DeviceShift';

type Mode = 'overlay' | 'side' | 'web' | 'fallback' | 'plain';
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

const MODES: readonly Mode[] = ['overlay', 'side', 'web', 'fallback', 'plain'];
const WRAPS: readonly Wrap[] = ['wrap', 'balance', 'pretty', 'stable', 'nowrap'];
const SUBSTITUTES: readonly Substitute[] = ['sans-serif', 'serif', 'monospace', 'system-ui'];
const KEY_PREFIX = 'ff-web-';

const keyOf = (family: string) => `${KEY_PREFIX}${slugOf(family)}`;

interface Coverage {
  heading: Uint32Array;
  body: Uint32Array;
  note: (char: string) => string;
  plain: boolean;
}

function Marked({
  text,
  points,
  coverage,
}: {
  text: string;
  points: Uint32Array;
  coverage: Coverage;
}) {
  if (coverage.plain) return <>{text}</>;
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
  return (
    <>
      <header class="ff-article__hero">
        <p class="ff-article__kicker">{body(article.kicker)}</p>
        <h3 class="ff-article__title">{heading(article.title)}</h3>
        <p class="ff-article__lead">{body(article.lead)}</p>
        <p class="ff-article__meta">{body(article.meta)}</p>
      </header>
      <ul class="ff-article__factors">
        {article.factors.map((factor) => (
          <li key={factor.title} class="ff-article__factor">
            <Icon name={factor.icon} />
            <h4>{heading(factor.title)}</h4>
            <p>{body(factor.text)}</p>
          </li>
        ))}
      </ul>
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
}: {
  locale: Locale;
  items: readonly PreviewItem[];
  fitting?: boolean;
}) {
  const t = messagesFor(locale);
  const [articleId, setArticleId] = useState<ArticleId>(locale === 'ru' ? 'ru' : 'en');
  const [mode, setMode] = useState<Mode>('overlay');
  const [size, setSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.5);
  const [wrap, setWrap] = useState<Wrap>('wrap');
  const [substitute, setSubstitute] = useState<Substitute>('sans-serif');
  const [headingPick, setHeadingPick] = useState<string>();
  const [bodyPick, setBodyPick] = useState<string>();
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [stacked, setStacked] = useState(false);
  const [guides, setGuides] = useState(false);
  const [boxes, setBoxes] = useState(false);
  const [guideImages, setGuideImages] = useState<Partial<Record<Layer, string>>>({});
  const view = useRef<HTMLElement>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [loadFailed, setLoadFailed] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [shiftResults, setShiftResults] = useState<WidthShift[]>();
  const probe = useRef<HTMLDivElement>(null);
  const [notInstalled, setNotInstalled] = useState<string[]>([]);
  const article = ARTICLES[articleId];

  const families = useMemo(() => [...new Set(items.map((item) => item.family))], [items]);
  const headingFamily = families.includes(headingPick ?? '') ? headingPick : families[0];
  const bodyFamily = families.includes(bodyPick ?? '') ? bodyPick : (families[1] ?? families[0]);
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

  const pointsOf = (family: string | undefined) => {
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
        const [web, fallback] = wrapper?.querySelectorAll('article') ?? [];
        if (cancelled || !wrapper || !web || !fallback) return;
        setShiftResults(measureShift(wrapper, web, fallback));
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
    if (!family) return 'system-ui, sans-serif';
    const key = keyOf(family);
    if (kind === 'web') return `"${key}", ${substitute}`;
    if (kind === 'fallback') return `"${key} Fallback", ${substitute}`;
    return categoryOf(family);
  };
  const pageStyle = (kind: 'web' | 'fallback' | 'plain') => {
    const layer = kind === 'plain' ? undefined : layers[kind];
    const styled = layer && mode === 'overlay';
    const image = kind === 'plain' ? undefined : guideImages[kind];
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
      ...(image && guides && mode === 'side' ? { '--ff-guides': image } : {}),
      textWrap: wrap,
    };
  };
  useEffect(() => {
    if (!guides || mode !== 'side' || !fontsReady || !bodyFamily) return;
    let cancelled = false;
    void (async () => {
      const next: Partial<Record<Layer, string>> = {};
      for (const layer of LAYERS) {
        const family = stack(bodyFamily, layer);
        await document.fonts.load(`${size}px ${family}`).catch(() => []);
        const offsets = guideOffsets(family, size, lineHeight);
        if (offsets) next[layer] = guideImage(offsets);
      }
      if (!cancelled) setGuideImages(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [guides, mode, fontsReady, fontFaces, size, lineHeight, bodyFamily, substitute]);

  useEffect(() => {
    const root = view.current;
    if (!boxes || !root || !fontsReady || (mode !== 'overlay' && mode !== 'side')) return;
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

  const modeLabel = (value: Mode) => {
    if (value === 'overlay') return t.mode_overlay();
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
      data-guides={guides && mode === 'side' ? '' : undefined}
      style={pageStyle(kind)}
    >
      <ArticleBody article={article} coverage={coverageFor(ghost || kind !== 'web')} />
      {boxes && kind !== 'plain' && (mode === 'overlay' || mode === 'side') && (
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
  const layerControls = (
    <div class="ff-article-view__controls">
      <fieldset class="ff-article-view__group">
        <legend>{t.article_group_layers()}</legend>
        {mode === 'side' && (
          <>
            <Select
              compact
              label={t.side_arrangement()}
              value={stacked ? 'stacked' : 'horizontal'}
              options={[
                { value: 'horizontal', label: t.side_horizontal() },
                { value: 'stacked', label: t.side_stacked() },
              ]}
              onChange={(value) => setStacked(value === 'stacked')}
            />
            <label>
              <input
                type="checkbox"
                checked={guides}
                onChange={(event) => setGuides(event.currentTarget.checked)}
              />{' '}
              {t.guides_enable()}
            </label>
          </>
        )}
        <label>
          <input
            type="checkbox"
            checked={boxes}
            onChange={(event) => setBoxes(event.currentTarget.checked)}
          />{' '}
          {t.boxes_enable()}
        </label>
      </fieldset>
      {mode === 'overlay' &&
        LAYERS.map((layer) => (
          <fieldset key={layer} class="ff-article-view__group">
            <legend>{layer === 'web' ? t.preview_web_label() : t.preview_fallback_label()}</legend>
            <Select
              compact
              label={t.layer_render()}
              value={layers[layer].render}
              options={RENDERS.map((value) => ({
                value,
                label: value === 'fill' ? t.layer_render_fill() : t.layer_render_outline(),
              }))}
              onChange={(value) => setLayer(layer, { render: value as Render })}
            />
            <Select
              compact
              label={t.layer_color()}
              value={layers[layer].color}
              options={COLORS.map((value) => ({ value, label: colorLabel(value) }))}
              onChange={(value) => setLayer(layer, { color: value as LayerColor })}
            />
            {layers[layer].render === 'outline' && (
              <div class="ff-field ff-preview__slider">
                <div class="ff-preview__label">
                  <label for={`ff-layer-${layer}-width`}>{t.layer_width()}</label>
                  <output for={`ff-layer-${layer}-width`}>{layers[layer].width}px</output>
                </div>
                <input
                  id={`ff-layer-${layer}-width`}
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.5}
                  value={layers[layer].width}
                  onInput={(event) => setLayer(layer, { width: event.currentTarget.valueAsNumber })}
                />
              </div>
            )}
            <div class="ff-field ff-preview__slider">
              <div class="ff-preview__label">
                <label for={`ff-layer-${layer}-opacity`}>{t.layer_opacity()}</label>
                <output for={`ff-layer-${layer}-opacity`}>{layers[layer].opacity}%</output>
              </div>
              <input
                id={`ff-layer-${layer}-opacity`}
                type="range"
                min={0}
                max={100}
                step={5}
                value={layers[layer].opacity}
                onInput={(event) => setLayer(layer, { opacity: event.currentTarget.valueAsNumber })}
              />
            </div>
          </fieldset>
        ))}
      {mode === 'side' && guides && (
        <ul class="ff-article-view__guides ff-muted" aria-label={t.guides_enable()}>
          {GUIDES.map((id) => (
            <li key={id} data-guide={id}>
              {guideLabel(id)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
  const familyOptions = families.map((family) => ({ value: family, label: family }));
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
        options={ARTICLE_IDS.map((id) => ({ value: id, label: ARTICLES[id].label }))}
        onChange={(value) => setArticleId(value as ArticleId)}
      />
    </fieldset>
  );

  if (empty) {
    return (
      <section class="ff-article-view" aria-label={t.article_heading()}>
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
        {(['web', 'fallback'] as const).map((kind) => (
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
      <div class="ff-article-view__controls">
        <fieldset class="ff-article-view__group">
          <legend>{t.article_group_view()}</legend>
          <fieldset class="ff-preview__modes">
            <legend class="ff-sr-only">{t.preview_mode_label()}</legend>
            {MODES.map((value) => (
              <button
                key={value}
                type="button"
                class="ff-button ff-button--secondary"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
              >
                {modeLabel(value)}
              </button>
            ))}
          </fieldset>
        </fieldset>
        {contentGroup}
      </div>
      <div class="ff-article-view__controls">
        <fieldset class="ff-article-view__group">
          <legend>{t.article_group_fonts()}</legend>
          {families.length > 1 && (
            <>
              <Select
                compact
                label={t.article_heading_font()}
                value={headingFamily}
                options={familyOptions}
                onChange={setHeadingPick}
              />
              <Select
                compact
                label={t.article_body_font()}
                value={bodyFamily}
                options={familyOptions}
                onChange={setBodyPick}
              />
            </>
          )}
          <Select
            compact
            label={t.missing_label()}
            value={substitute}
            options={SUBSTITUTES.map((value) => ({ value, label: substituteLabel(value) }))}
            onChange={(value) => setSubstitute(value as Substitute)}
          />
        </fieldset>
        <DeviceShift locale={locale} results={shiftResults} />
        {fitting && <p class="ff-muted ff-article-view__fitting">{t.fit_running()}</p>}
      </div>
      {(mode === 'overlay' || mode === 'side') && layerControls}
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
      {(mode === 'web' || mode === 'fallback' || mode === 'plain') && page(mode)}
    </section>
  );
}
