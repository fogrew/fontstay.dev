import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Select } from '@/common/ui';
import { buildCss } from '../lib/css';
import type { PreviewItem } from './Preview';

type View = 'web' | 'adjusted' | 'plain';
const VIEWS: readonly View[] = ['web', 'adjusted', 'plain'];
const FAMILY = 'ff-article';
const MIN_WIDTH = 280;
const MAX_WIDTH = 760;

export function ArticlePreview({
  locale,
  items,
}: {
  locale: Locale;
  items: readonly PreviewItem[];
}) {
  const t = messagesFor(locale);
  const [view, setView] = useState<View>('adjusted');
  const [width, setWidth] = useState(520);
  const [pickedId, setPickedId] = useState<number>();
  const item = items.find((entry) => entry.id === pickedId) ?? items[0];
  const familyName = item ? `${FAMILY}-${item.id}` : FAMILY;

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    const face = new FontFace(familyName, item.bytes.slice(0));
    face
      .load()
      .then(() => {
        if (!cancelled) document.fonts.add(face);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      document.fonts.delete(face);
    };
  }, [item?.bytes, familyName]);

  const fontFaces = item
    ? buildCss(
        familyName,
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
      ).fontFaces
    : '';
  useEffect(() => {
    if (!fontFaces) return;
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(fontFaces);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((entry) => entry !== sheet);
    };
  }, [fontFaces]);

  if (!item) return null;
  const generic = item.fallback.category;
  const fontFamily =
    view === 'web'
      ? `"${familyName}", ${generic}`
      : view === 'adjusted'
        ? `"${familyName} Fallback", ${generic}`
        : generic;
  const viewLabel = (value: View) => {
    if (value === 'web') return t.article_view_web();
    return value === 'adjusted' ? t.article_view_adjusted() : t.article_view_plain();
  };

  return (
    <section class="ff-article" aria-label={t.article_heading()}>
      <div class="ff-article__controls">
        {items.length > 1 && (
          <Select
            label={t.article_font_label()}
            value={String(item.id)}
            options={items.map((entry) => ({ value: String(entry.id), label: entry.name }))}
            onChange={(value) => setPickedId(Number(value))}
          />
        )}
        <fieldset class="ff-preview__modes">
          <legend class="ff-sr-only">{t.article_view_label()}</legend>
          {VIEWS.map((value) => (
            <button
              key={value}
              type="button"
              class="ff-button ff-button--secondary"
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {viewLabel(value)}
            </button>
          ))}
        </fieldset>
        <div class="ff-field ff-preview__slider">
          <div class="ff-preview__label">
            <label for="ff-article-width">{t.article_width_label()}</label>
            <output for="ff-article-width">{width}px</output>
          </div>
          <input
            id="ff-article-width"
            type="range"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            step={10}
            value={width}
            onInput={(event) => setWidth(event.currentTarget.valueAsNumber)}
          />
        </div>
      </div>
      <article class="ff-article__page" style={{ fontFamily, maxInlineSize: `${width}px` }}>
        <h3>{t.article_title()}</h3>
        <p>{t.article_lead()}</p>
        <h4>{t.article_what_moves()}</h4>
        <p>{t.article_moves_text()}</p>
        <ul>
          <li>{t.article_item_width()}</li>
          <li>{t.article_item_height()}</li>
          <li>{t.article_item_spacing()}</li>
        </ul>
        <h4>{t.article_what_helps()}</h4>
        <p>{t.article_helps_text()}</p>
        <blockquote>{t.article_quote()}</blockquote>
        <p>{t.article_closing()}</p>
      </article>
    </section>
  );
}
