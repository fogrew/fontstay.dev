import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import type { Category } from '@/modules/os-fonts';
import { covers } from '../lib/compute';
import { buildCss, type Overrides } from '../lib/css';
import { canvasMeasure, isInstalled } from '../lib/installed';

const PHRASES = ['en', 'ru', 'de', 'fr', 'es', 'pl', 'el'] as const;

const PREVIEW_FAMILY = 'ff-preview-web';

type Mode = 'side' | 'overlay' | 'web' | 'fallback';
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
  style: JSX.CSSProperties;
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
}: {
  locale: Locale;
  bytes: ArrayBuffer;
  fallback: { family: string; localNames: readonly string[]; category: Category };
  adjustment: Overrides;
  defaultSample: string;
  codePoints: Uint32Array;
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
  const [size, setSize] = useState(28);
  const [lineHeight, setLineHeight] = useState(1.4);
  const languageName = new Intl.DisplayNames(locale, { type: 'language' });
  const options = PHRASES.filter((id) => covers({ codePoints }, t[`preview_phrase_${id}`]())).map(
    (id) => ({
      text: t[`preview_phrase_${id}`](),
      value: `${languageName.of(id) ?? id}: ${t[`preview_phrase_${id}`]()}`,
    }),
  );
  const [draft, setDraft] = useState('');
  useEffect(() => {
    const match = options.find((option) => option.text === sample);
    setDraft(match?.value ?? '');
  }, [sample]);
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
    [{ family: fallback.family, localNames: fallback.localNames, adjustment }],
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
  const webStyle = { ...shared, fontFamily: `"${PREVIEW_FAMILY}", sans-serif` };
  const fallbackStyle = { ...shared, fontFamily: `"${PREVIEW_FAMILY} Fallback", sans-serif` };
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
        <div class="ff-field ff-preview__samples">
          <label for="ff-preview-sample">{t.preview_phrase_label()}</label>
          <input
            id="ff-preview-sample"
            class="ff-input"
            type="text"
            list="ff-preview-samples"
            autocomplete="off"
            placeholder={t.preview_phrase_placeholder()}
            value={draft}
            onInput={(event) => {
              const value = event.currentTarget.value;
              setDraft(value);
              const match = options.find((option) => option.value === value);
              if (match) setSample(match.text);
            }}
          />
          <datalist id="ff-preview-samples">
            {options.map((option) => (
              <option key={option.value} value={option.value} />
            ))}
          </datalist>
        </div>
      </div>
      {!installed && (
        <p class="ff-muted" role="status">
          {t.preview_not_installed({ font: fallback.family })}
        </p>
      )}
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
    </section>
  );
}
