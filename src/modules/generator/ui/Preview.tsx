import { useEffect, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Select } from '@/common/ui';
import type { Category } from '@/modules/os-fonts';
import { covers } from '../lib/compute';
import { buildCss, type Overrides } from '../lib/css';
import { canvasMeasure, isInstalled } from '../lib/installed';
import { codePointLabel, missingCharacters, textRuns } from '../lib/missing';

const PHRASES = ['en', 'ru', 'de', 'fr', 'es', 'pl', 'el'] as const;

const PREVIEW_FAMILY = 'ff-preview-web';

type Mode = 'side' | 'overlay' | 'web' | 'fallback';
type Substitute = 'sans-serif' | 'serif' | 'monospace' | 'system-ui';
const SUBSTITUTES: readonly Substitute[] = ['sans-serif', 'serif', 'monospace', 'system-ui'];
const MAX_LISTED = 12;
const MODES: readonly Mode[] = ['overlay', 'side', 'web', 'fallback'];

function EditableText({
  value,
  onChange,
  label,
  style,
}: {
  value: string;
  onChange: (text: string) => void;
  label: string;
  style: Record<string, string | number>;
}) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = element.current;
    if (node && node.textContent !== value) node.textContent = value;
  }, [value]);
  const editable = { contenteditable: 'plaintext-only' } as Record<string, string>;
  // biome-ignore-start lint/a11y/useSemanticElements: the text must wrap like a paragraph
  return (
    <div
      {...editable}
      ref={element}
      class="ff-preview__text"
      role="textbox"
      tabIndex={0}
      aria-label={label}
      spellcheck={false}
      style={style}
      onInput={(event) => onChange(event.currentTarget.textContent ?? '')}
    />
  );
  // biome-ignore-end lint/a11y/useSemanticElements: the text must wrap like a paragraph
}

export function Preview({
  locale,
  bytes,
  fallback,
  adjustment,
  defaultSample,
  codePoints,
  unicodeRange,
  fontWeight,
  fontStyle,
}: {
  locale: Locale;
  bytes: ArrayBuffer;
  fallback: { family: string; localNames: readonly string[]; category: Category };
  adjustment: Overrides;
  defaultSample: string;
  codePoints: Uint32Array;
  unicodeRange?: string | undefined;
  fontWeight?: number | undefined;
  fontStyle?: 'italic' | undefined;
}) {
  const t = messagesFor(locale);
  const [sample, setSample] = useState(defaultSample);
  const [loadFailed, setLoadFailed] = useState(false);
  const [installed, setInstalled] = useState(true);
  const localKey = fallback.localNames.join('|');
  useEffect(() => {
    const measure = canvasMeasure();
    setInstalled(measure ? isInstalled(fallback.localNames, measure) : true);
  }, [localKey]);
  const [mode, setMode] = useState<Mode>('overlay');
  const [substitute, setSubstitute] = useState<Substitute>('sans-serif');
  const [size, setSize] = useState(28);
  const [lineHeight, setLineHeight] = useState(1.4);
  const languageName = new Intl.DisplayNames(locale, { type: 'language' });
  const options = PHRASES.filter((id) => covers({ codePoints }, t[`preview_phrase_${id}`]())).map(
    (id) => ({
      text: t[`preview_phrase_${id}`](),
      value: `${languageName.of(id) ?? id}: ${t[`preview_phrase_${id}`]()}`,
    }),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const face = new FontFace(PREVIEW_FAMILY, bytes.slice(0));
    face
      .load()
      .then(() => {
        if (!cancelled) {
          document.fonts.add(face);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
      document.fonts.delete(face);
    };
  }, [bytes]);
  const css = buildCss(
    PREVIEW_FAMILY,
    [
      {
        family: fallback.family,
        localNames: fallback.localNames,
        adjustment,
        unicodeRange,
        fontWeight,
        fontStyle,
      },
    ],
    fallback.category,
  );
  useEffect(() => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css.fontFaces);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet);
    };
  }, [css.fontFaces]);
  const shared = { fontSize: `${size}px`, lineHeight: String(lineHeight) };
  const webStyle = { ...shared, fontFamily: `"${PREVIEW_FAMILY}", ${substitute}` };
  const fallbackStyle = { ...shared, fontFamily: `"${PREVIEW_FAMILY} Fallback", ${substitute}` };
  const runs = textRuns(sample, codePoints);
  const missing = missingCharacters(runs);
  const substituteLabel = (value: Substitute) => {
    if (value === 'serif') return t.type_serif();
    if (value === 'monospace') return t.type_mono();
    return value === 'system-ui' ? t.missing_system() : t.type_sans();
  };
  const modeLabel = (value: Mode) => {
    if (value === 'side') return t.mode_side();
    if (value === 'overlay') return t.mode_overlay();
    return value === 'web' ? t.preview_web_label() : t.preview_fallback_label();
  };
  return (
    <section class="ff-preview" aria-label={t.preview_heading()}>
      {loadFailed && (
        <p class="ff-error" role="alert">
          {t.preview_load_failed()}
        </p>
      )}
      <div class="ff-preview__controls">
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
            <label for="ff-preview-size">{t.preview_size_label()}</label>
            <output for="ff-preview-size">{size}px</output>
          </div>
          <input
            id="ff-preview-size"
            type="range"
            min={12}
            max={72}
            value={size}
            onInput={(event) => setSize(event.currentTarget.valueAsNumber)}
          />
        </div>
        <div class="ff-field ff-preview__slider">
          <div class="ff-preview__label">
            <label for="ff-preview-line">{t.preview_line_height_label()}</label>
            <output for="ff-preview-line">{lineHeight}</output>
          </div>
          <input
            id="ff-preview-line"
            type="range"
            min={1}
            max={2}
            step={0.05}
            value={lineHeight}
            onInput={(event) => setLineHeight(event.currentTarget.valueAsNumber)}
          />
        </div>
      </div>
      {!installed && (
        <p class="ff-muted" role="status">
          {t.preview_not_installed({ font: fallback.family })}
        </p>
      )}
      <div class="ff-preview__field">
        <div class="ff-preview__samples">
          <button
            type="button"
            class="ff-icon-button"
            aria-label={t.preview_phrase_label()}
            aria-haspopup="true"
            aria-expanded={menuOpen}
            aria-controls="ff-preview-samples"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">▾</span>
          </button>
          {menuOpen && (
            <ul id="ff-preview-samples" class="ff-preview__menu">
              {options.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      setSample(option.text);
                      setMenuOpen(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setMenuOpen(false);
                    }}
                  >
                    {option.value}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div class="ff-preview__stage">
          {(mode === 'side' || mode === 'web') && (
            <figure>
              <figcaption>{t.preview_web_label()}</figcaption>
              <EditableText
                value={sample}
                onChange={setSample}
                label={t.preview_sample_label()}
                style={webStyle}
              />
            </figure>
          )}
          {(mode === 'side' || mode === 'fallback') && (
            <figure>
              <figcaption>{t.preview_fallback_label()}</figcaption>
              <EditableText
                value={sample}
                onChange={setSample}
                label={t.preview_sample_label()}
                style={fallbackStyle}
              />
            </figure>
          )}
          {mode === 'overlay' && (
            <figure>
              <figcaption>{t.overlay_legend()}</figcaption>
              <div class="ff-preview__text ff-preview__overlay">
                <EditableText
                  value={sample}
                  onChange={setSample}
                  label={t.preview_sample_label()}
                  style={{ ...webStyle, margin: 0 }}
                />
                <p
                  class="ff-preview__outline"
                  aria-hidden="true"
                  style={{ ...fallbackStyle, margin: 0 }}
                >
                  {sample}
                </p>
              </div>
            </figure>
          )}
        </div>
      </div>
      {missing.length > 0 && (
        <section class="ff-preview__missing" aria-label={t.missing_heading()}>
          <Select
            label={t.missing_label()}
            value={substitute}
            options={SUBSTITUTES.map((value) => ({ value, label: substituteLabel(value) }))}
            onChange={(value) => setSubstitute(value as Substitute)}
          />
          <p role="status">
            {t.missing_summary({
              count: missing.length,
              list: missing
                .slice(0, MAX_LISTED)
                .map((char) => `${char} (${codePointLabel(char)})`)
                .join(', '),
              font: substituteLabel(substitute),
            })}
            {missing.length > MAX_LISTED &&
              ` ${t.missing_more({ count: missing.length - MAX_LISTED })}`}
          </p>
          <p class="ff-preview__map" aria-hidden="true" style={{ ...webStyle, margin: 0 }}>
            {runs.map((run, index) =>
              run.covered ? (
                <span key={index}>{run.text}</span>
              ) : (
                <mark key={index} class="ff-preview__missing-run">
                  {run.text}
                </mark>
              ),
            )}
          </p>
        </section>
      )}
    </section>
  );
}
