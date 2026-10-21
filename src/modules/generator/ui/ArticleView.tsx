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
import {
  arrangementOf,
  hasPosition,
  LAYER_IDS,
  type LayerId,
  layersAt,
  PRESETS,
  type Preset,
  presetOf,
  visibleLayers,
} from '../lib/layers';
import { codePointLabel, textRuns } from '../lib/missing';
import { slugOf } from '../lib/overview';
import type { PreviewItem, SiteData } from '../lib/preview-item';
import { DeviceShift } from './DeviceShift';
import { IntroGuide } from './IntroGuide';
import { ToolIcon } from './ToolIcons';

type Wrap = 'wrap' | 'balance' | 'pretty' | 'stable' | 'nowrap';
type Substitute = 'sans-serif' | 'serif' | 'monospace' | 'system-ui';
type Layer = 'web' | 'fallback';
type LensShows = 'overlay' | 'fallback' | 'plain';
type Render = 'fill' | 'outline';
type LayerColor = 'text' | 'green' | 'red' | 'blue' | 'amber';

interface PageOptions {
  ghost?: boolean;
  styled?: boolean;
  copy?: boolean;
}

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
const DEFAULT_LAYERS: Record<LayerId, LayerStyle> = {
  web: { render: 'fill', color: 'text', width: 1, opacity: 100 },
  fallback: { render: 'outline', color: 'green', width: 1, opacity: 100 },
  plain: { render: 'outline', color: 'amber', width: 1, opacity: 100 },
};

const PRESET_ORDER: readonly Preset[] = ['overlay', 'side', 'slider', 'web', 'fallback', 'plain'];
const LENS_STEP = 24;
const SAMPLE_CODE = `@font-face {
  font-family: "Brand Fallback";
  src: local("Arial");
  size-adjust: 104.5%;
  ascent-override: 92%;
  descent-override: 24%;
}
body {
  font-family: "Brand", "Brand Fallback", sans-serif;
}`;
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
        {article.columnsHeading && (
          <h4 class="ff-article__heading">{heading(article.columnsHeading)}</h4>
        )}
        {article.columns.length > 0 && (
          <div class="ff-article__columns">
            {article.columns.map((paragraph, index) => (
              <p key={index}>
                <Runs runs={paragraph} coverage={coverage} />
              </p>
            ))}
          </div>
        )}
        {article.quote.text && (
          <figure class="ff-article__quote">
            <blockquote>{body(article.quote.text)}</blockquote>
          </figure>
        )}
        {article.list.length > 0 && (
          <ul>
            {article.list.map((item, index) => (
              <li key={index}>
                <Runs runs={item} coverage={coverage} />
              </li>
            ))}
          </ul>
        )}
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
      <pre class="ff-article__code" lang="en" dir="ltr">
        <code>{SAMPLE_CODE}</code>
      </pre>
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
  const [positions, setPositions] = useState(PRESETS.overlay);
  const [xray, setXray] = useState(false);
  const [size, setSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.5);
  const [wrap, setWrap] = useState<Wrap>('wrap');
  const [substitute, setSubstitute] = useState<Substitute>('sans-serif');
  const [headingPick, setHeadingPick] = useState<string>();
  const [bodyPick, setBodyPick] = useState<string>();
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [stacked, setStacked] = useState(false);
  const [lensShows, setLensShows] = useState<LensShows>('overlay');
  const [lensSize, setLensSize] = useState(200);
  const [split, setSplit] = useState(50);
  const [introOpen, setIntroOpen] = useState(() => {
    try {
      return localStorage.getItem('fontstay:intro') === 'open';
    } catch {
      return false;
    }
  });
  const toggleIntro = () =>
    setIntroOpen((open) => {
      try {
        localStorage.setItem('fontstay:intro', open ? 'closed' : 'open');
      } catch {
        // storage may be unavailable
      }
      return !open;
    });
  const slider = useRef<HTMLDivElement>(null);
  const loupe = useRef<HTMLDivElement>(null);
  const arrangement = arrangementOf(positions);
  const clipped = hasPosition(positions, 'clip');
  const inspectable = visibleLayers(positions).some((id) => id !== 'plain');
  const overlaid = hasPosition(positions, 'ghost');
  const preset = presetOf(positions);
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
    if (site.meaningful) setArticleId('site');
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
    articleId === 'site' && site?.meaningful
      ? siteArticle(site.blocks, t.article_site(), locale)
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
  const stack = (family: string | undefined, kind: LayerId) => {
    if (!family || family === SYSTEM) return 'system-ui, sans-serif';
    const key = keyOf(family);
    if (kind === 'web') return `"${key}", ${substitute}`;
    if (kind === 'fallback') return `"${key} Fallback", ${substitute}`;
    return categoryOf(family);
  };
  const pageStyle = (kind: LayerId, styled = false) => {
    const layer = layers[kind];
    const metrics = kind === 'plain' ? undefined : guideMetrics[kind];
    const image = metrics ? guideImage(metrics, activeGuides) : undefined;
    return {
      '--ff-article-heading': stack(headingFamily, kind),
      '--ff-article-body': stack(bodyFamily, kind),
      '--ff-article-size': `${size}px`,
      '--ff-article-line': String(lineHeight),
      '--ff-layer-color': `var(${COLOR_TOKENS[styled ? layer.color : DEFAULT_LAYERS[kind].color]})`,
      ...(styled ? { '--ff-layer-stroke': `${layer.width}px`, opacity: layer.opacity / 100 } : {}),
      ...(image && guides ? { '--ff-guides': image } : {}),
      textWrap: wrap,
    };
  };
  useEffect(() => {
    if (!guides || !inspectable || !fontsReady || !bodyFamily) return;
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
  }, [guides, inspectable, fontsReady, fontFaces, size, lineHeight, bodyFamily, substitute]);

  useEffect(() => {
    const root = view.current;
    if (!boxes || !root || !fontsReady || !inspectable) return;
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
    positions,
    xray,
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

  const presetLabel = (value: Preset) => {
    if (value === 'overlay') return t.mode_overlay();
    if (value === 'side') return t.mode_side();
    if (value === 'slider') return t.mode_slider();
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
  const page = (
    kind: LayerId,
    { ghost = false, styled = false, copy = false }: PageOptions = {},
  ) => (
    <article
      class={`ff-article${ghost ? ' ff-article--ghost' : ''}${wrap === 'nowrap' ? ' ff-article--nowrap' : ''}`}
      lang={article.lang}
      dir={article.dir}
      aria-hidden={ghost || copy ? 'true' : undefined}
      data-render={styled && kind !== 'plain' ? layers[kind].render : undefined}
      data-guides={guides && kind !== 'plain' ? '' : undefined}
      style={pageStyle(kind, styled)}
    >
      <IntroGuide
        locale={locale}
        collapsed={!introOpen}
        interactive={kind === 'web' && !ghost && !copy}
        onToggle={toggleIntro}
      />
      <ArticleBody article={article} coverage={coverageFor(ghost || copy || kind !== 'web')} />
      {boxes && kind !== 'plain' && (
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
  const moveLens = (x: number, y: number) => {
    const element = loupe.current;
    if (!element) return;
    const box = element.getBoundingClientRect();
    const panes = [...element.querySelectorAll<HTMLElement>('[data-pane]')];
    const pane =
      panes.find((candidate) => {
        const rect = candidate.getBoundingClientRect();
        return (
          x + box.left >= rect.left &&
          x + box.left <= rect.right &&
          y + box.top >= rect.top &&
          y + box.top <= rect.bottom
        );
      }) ?? panes[0];
    if (pane) {
      const rect = pane.getBoundingClientRect();
      element.style.setProperty('--ff-lens-ox', `${rect.left - box.left}px`);
      element.style.setProperty('--ff-lens-oy', `${rect.top - box.top}px`);
      element.style.setProperty('--ff-lens-w', `${rect.width}px`);
    }
    element.style.setProperty('--ff-lens-x', `${x}px`);
    element.style.setProperty('--ff-lens-y', `${y}px`);
    element.style.setProperty('--ff-lens-r', `${lensSize / 2}px`);
    element.dataset.active = '';
  };
  const hideLens = () => {
    loupe.current?.style.setProperty('--ff-lens-r', '0px');
    if (loupe.current) delete loupe.current.dataset.active;
  };
  useEffect(() => {
    const element = loupe.current;
    if (element && 'active' in element.dataset) {
      element.style.setProperty('--ff-lens-r', `${lensSize / 2}px`);
    }
  }, [lensSize]);
  const moveSplit = (event: { clientX: number; clientY: number }) => {
    const box = slider.current?.getBoundingClientRect();
    if (!box) return;
    const ratio = stacked
      ? (event.clientY - box.top) / box.height
      : (event.clientX - box.left) / box.width;
    setSplit(Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 10);
  };
  const familyOptions = [
    ...families.map((family) => ({ value: family, label: family })),
    { value: SYSTEM, label: t.article_font_system() },
  ];
  const xrayContent = (
    <>
      <Select
        compact
        label={t.loupe_shows()}
        value={lensShows}
        options={[
          { value: 'overlay', label: t.mode_overlay() },
          { value: 'fallback', label: t.preview_fallback_label() },
          { value: 'plain', label: t.article_view_plain() },
        ]}
        onChange={(value) => setLensShows(value as LensShows)}
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
    </>
  );
  const inspectContent = (
    <>
      <fieldset class="ff-inspect__section">
        <legend>{t.article_group_fonts()}</legend>
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
      </fieldset>
      <fieldset class="ff-inspect__section ff-layers" disabled={!overlaid}>
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
                disabled={!overlaid}
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
                disabled={!overlaid}
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
                  disabled={!overlaid || layers[layer].render !== 'outline'}
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
                  disabled={!overlaid}
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
          ...(site?.meaningful ? [{ value: 'site', label: t.article_site() }] : []),
          ...ARTICLE_LANGUAGES.map(([id, label]) => ({ value: id, label })),
        ]}
        onChange={(value) => setArticleId(value as ArticleKey)}
      />
    </fieldset>
  );

  const fewText = site && !site.meaningful && (
    <p class="ff-muted" role="status">
      {t.import_few_text({ origin: site.origin })}
    </p>
  );

  if (empty) {
    return (
      <section class="ff-article-view" aria-label={t.article_heading()}>
        {fewText}
        <p class="ff-article-view__hint">{t.article_empty_hint()}</p>
        <div class="ff-article-view__controls">{contentGroup}</div>
        <article
          class={`ff-article${wrap === 'nowrap' ? ' ff-article--nowrap' : ''}`}
          lang={article.lang}
          dir={article.dir}
          style={hydrated ? pageStyle('web') : undefined}
        >
          <IntroGuide locale={locale} />
          <ArticleBody article={article} coverage={coverageFor(true)} />
        </article>
      </section>
    );
  }

  return (
    <section class="ff-article-view" aria-label={t.article_heading()} ref={view}>
      {fewText}
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
        <fieldset class="ff-preview__modes ff-toolbar__modes ff-button-group">
          <legend class="ff-sr-only">{t.preview_mode_label()}</legend>
          {PRESET_ORDER.map((value) => (
            <button
              key={value}
              type="button"
              class="ff-button ff-button--secondary ff-tool-button"
              aria-pressed={preset === value}
              aria-label={presetLabel(value)}
              title={presetLabel(value)}
              onClick={() => setPositions(PRESETS[value])}
            >
              <ToolIcon name={value} />
            </button>
          ))}
        </fieldset>
        <span
          class="ff-preview__arrange ff-button-group"
          data-active={arrangement === 'columns' || clipped}
        >
          {(['horizontal', 'stacked'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              class="ff-button ff-button--secondary ff-preview__arrange-button"
              aria-pressed={stacked === (kind === 'stacked')}
              aria-label={kind === 'stacked' ? t.side_stacked() : t.side_horizontal()}
              title={kind === 'stacked' ? t.side_stacked() : t.side_horizontal()}
              disabled={arrangement !== 'columns' && !clipped}
              onClick={() => setStacked(kind === 'stacked')}
            >
              <span class="ff-arrange-icon" data-kind={kind} aria-hidden="true" />
            </button>
          ))}
        </span>
        <div class="ff-button-group ff-toolbar__xray">
          <button
            type="button"
            class="ff-button ff-button--secondary ff-tool-button"
            aria-pressed={xray}
            aria-label={t.mode_loupe()}
            title={t.mode_loupe()}
            onClick={() => setXray((on) => !on)}
          >
            <ToolIcon name="xray" />
          </button>
          <Popover label={t.loupe_settings()} compact>
            {xrayContent}
          </Popover>
        </div>
        <fieldset class="ff-toolbar__guides ff-button-group" disabled={!inspectable}>
          <legend class="ff-sr-only">{t.guides_enable()}</legend>
          {GUIDES.map((id) => (
            <button
              key={id}
              type="button"
              class="ff-button ff-button--secondary ff-tool-button"
              data-guide={id}
              aria-pressed={guideOn[id]}
              aria-label={guideLabel(id)}
              title={guideLabel(id)}
              onClick={() => setGuideOn((all) => ({ ...all, [id]: !all[id] }))}
            >
              <ToolIcon name={id} />
            </button>
          ))}
          <button
            type="button"
            class="ff-button ff-button--secondary ff-tool-button"
            aria-pressed={boxes}
            aria-label={t.boxes_enable()}
            title={t.boxes_enable()}
            onClick={() => setBoxes((on) => !on)}
          >
            <ToolIcon name="boxes" />
          </button>
        </fieldset>
        <Popover label={t.article_group_content()}>{contentGroup}</Popover>
        <Popover label={t.article_group_inspect()}>{inspectContent}</Popover>
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
      <div
        ref={loupe}
        class={xray ? 'ff-article-view__loupe' : 'ff-article-view__stage'}
        {...(xray
          ? {
              tabIndex: 0,
              role: 'application',
              'aria-label': t.loupe_label(),
              onPointerMove: (event: PointerEvent) => {
                const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
                moveLens(event.clientX - box.left, event.clientY - box.top);
              },
              onPointerLeave: hideLens,
              onWheel: (event: WheelEvent) => {
                if (!event.shiftKey && !event.altKey) return;
                event.preventDefault();
                const delta =
                  Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
                setLensSize((current) =>
                  Math.min(400, Math.max(80, current + (delta < 0 ? 20 : -20))),
                );
              },
              onFocus: (event: FocusEvent) => {
                const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
                moveLens(box.width / 2, Math.min(box.height / 2, 240));
              },
              onBlur: hideLens,
              onKeyDown: (event: KeyboardEvent) => {
                const element = event.currentTarget as HTMLElement;
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
              },
            }
          : {})}
      >
        {arrangement === 'columns' ? (
          <div class="ff-article-view__side" data-stacked={stacked ? '' : undefined}>
            {(['start', 'end'] as const)
              .flatMap((position) => layersAt(positions, position))
              .map((id) => (
                <figure key={id} data-pane="">
                  <figcaption>{presetLabel(id)}</figcaption>
                  {page(id)}
                </figure>
              ))}
          </div>
        ) : (
          <div
            class={clipped ? 'ff-article-view__slider' : 'ff-article-view__overlay'}
            ref={slider}
            data-pane=""
            data-stacked={clipped && stacked ? '' : undefined}
            style={clipped ? { '--ff-split': `${split}%` } : undefined}
          >
            {LAYER_IDS.filter((id) => positions[id] !== 'hidden').map((id) =>
              positions[id] === 'clip' ? (
                <div
                  key={id}
                  class="ff-article-view__slider-fallback"
                  aria-hidden="true"
                  {...{ inert: true }}
                >
                  {page(id, { copy: true })}
                </div>
              ) : (
                <Fragment key={id}>
                  {page(id, { ghost: positions[id] === 'ghost', styled: overlaid })}
                </Fragment>
              ),
            )}
            {clipped && (
              <div
                class="ff-article-view__divider"
                role="slider"
                tabIndex={0}
                aria-label={t.slider_label()}
                aria-orientation={stacked ? 'vertical' : 'horizontal'}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(split)}
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  moveSplit(event);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) moveSplit(event);
                }}
                onKeyDown={(event) => {
                  const back = stacked ? 'ArrowUp' : 'ArrowLeft';
                  const forward = stacked ? 'ArrowDown' : 'ArrowRight';
                  const step = event.shiftKey ? 10 : 2;
                  if (event.key === back) setSplit((value) => Math.max(0, value - step));
                  else if (event.key === forward) setSplit((value) => Math.min(100, value + step));
                  else if (event.key === 'Home') setSplit(0);
                  else if (event.key === 'End') setSplit(100);
                  else return;
                  event.preventDefault();
                }}
              />
            )}
          </div>
        )}
        {xray && (
          <>
            <div class="ff-article-view__lens" aria-hidden="true" {...{ inert: true }}>
              <div class="ff-article-view__lens-pane">
                {lensShows === 'overlay' ? (
                  <div class="ff-article-view__overlay">
                    {page('web', { copy: true, styled: true })}
                    {page('fallback', { ghost: true, styled: true })}
                  </div>
                ) : (
                  page(lensShows, { copy: true })
                )}
              </div>
            </div>
            <span class="ff-article-view__ring" aria-hidden="true" />
          </>
        )}
      </div>
      {overlaid && <p class="ff-muted ff-article-view__legend">{t.overlay_legend()}</p>}
      {clipped && <p class="ff-muted ff-article-view__legend">{t.slider_legend()}</p>}
    </section>
  );
}
