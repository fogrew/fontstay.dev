import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Icon, Select } from '@/common/ui';
import type { PanelInput } from '@/modules/layout-shift';
import { ARTICLE_IDS, ARTICLES, type Article, type ArticleId, type Run } from '../lib/articles';
import { buildCss } from '../lib/css';
import { isInstalledOnDevice } from '../lib/installed';
import { codePointLabel, textRuns } from '../lib/missing';
import { slugOf } from '../lib/overview';
import type { PreviewItem } from '../lib/preview-item';
import { DeviceShift } from './DeviceShift';

type Mode = 'overlay' | 'side' | 'web' | 'fallback' | 'plain';
type Wrap = 'wrap' | 'balance' | 'pretty' | 'stable' | 'nowrap';
type Substitute = 'sans-serif' | 'serif' | 'monospace' | 'system-ui';

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
            title={coverage.note(run.text)}
            data-note={coverage.note(run.text)}
          >
            {run.text}
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
  shift,
  shiftKey,
}: {
  locale: Locale;
  items: readonly PreviewItem[];
  shift: PanelInput | undefined;
  shiftKey: string;
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
  const [loadFailed, setLoadFailed] = useState(false);
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

  if (items.length === 0 || !headingFamily || !bodyFamily) return null;
  const stack = (family: string, kind: 'web' | 'fallback' | 'plain') => {
    const key = keyOf(family);
    if (kind === 'web') return `"${key}", ${substitute}`;
    if (kind === 'fallback') return `"${key} Fallback", ${substitute}`;
    return categoryOf(family);
  };
  const pageStyle = (kind: 'web' | 'fallback' | 'plain') => ({
    '--ff-article-heading': stack(headingFamily, kind),
    '--ff-article-body': stack(bodyFamily, kind),
    '--ff-article-size': `${size}px`,
    '--ff-article-line': String(lineHeight),
    textWrap: wrap,
  });
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
    note: (char) =>
      t.article_unsupported({
        chars: `${char} (${codePointLabel(char)})`,
        font: substituteLabel(substitute),
      }),
  });
  const page = (kind: 'web' | 'fallback' | 'plain', ghost = false) => (
    <article
      class={`ff-article${ghost ? ' ff-article--ghost' : ''}${wrap === 'nowrap' ? ' ff-article--nowrap' : ''}`}
      lang={article.lang}
      dir={article.dir}
      aria-hidden={ghost ? 'true' : undefined}
      style={pageStyle(kind)}
    >
      <ArticleBody article={article} coverage={coverageFor(ghost || kind !== 'web')} />
    </article>
  );
  const familyOptions = families.map((family) => ({ value: family, label: family }));

  return (
    <section class="ff-article-view" aria-label={t.article_heading()}>
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
        </fieldset>
        <fieldset class="ff-article-view__group">
          <legend>{t.article_group_content()}</legend>
          <Select
            compact
            label={t.article_sample_label()}
            value={articleId}
            options={ARTICLE_IDS.map((id) => ({ value: id, label: ARTICLES[id].label }))}
            onChange={(value) => setArticleId(value as ArticleId)}
          />
        </fieldset>
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
      </div>
      {shift && <DeviceShift locale={locale} input={shift} signature={shiftKey} />}
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
        <div class="ff-article-view__side">
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
