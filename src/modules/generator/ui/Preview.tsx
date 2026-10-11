import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Select } from '@/common/ui';
import type { Category } from '@/modules/os-fonts';
import { covers } from '../lib/compute';
import { buildCss, type Overrides } from '../lib/css';

const PHRASES = ['en', 'ru', 'de', 'fr', 'es', 'pl', 'el'] as const;
const CUSTOM = 'custom';

const PREVIEW_FAMILY = 'ff-preview-web';

type Mode = 'side' | 'overlay' | 'web' | 'fallback';

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
  const phraseText = (id: (typeof PHRASES)[number]) => t[`preview_phrase_${id}`]();
  const languageName = new Intl.DisplayNames(locale, { type: 'language' });
  const phrases = PHRASES.filter((id) => covers({ codePoints }, phraseText(id)));
  const phrase = phrases.find((id) => phraseText(id) === sample) ?? CUSTOM;
  const [loadFailed, setLoadFailed] = useState(false);
  const [mode, setMode] = useState<Mode>('overlay');
  const [size, setSize] = useState(28);
  const [lineHeight, setLineHeight] = useState(1.4);
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
  return (
    <section class="ff-preview" aria-label={t.preview_heading()}>
      {loadFailed && (
        <p class="ff-error" role="alert">
          {t.preview_load_failed()}
        </p>
      )}
      <div class="ff-preview__controls">
        <Select
          label={t.preview_mode_label()}
          value={mode}
          options={[
            { value: 'side', label: t.mode_side() },
            { value: 'overlay', label: t.mode_overlay() },
            { value: 'web', label: t.preview_web_label() },
            { value: 'fallback', label: t.preview_fallback_label() },
          ]}
          onChange={(value) => setMode(value as Mode)}
        />
        <div class="ff-field">
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
        <div class="ff-field">
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
      <Select
        label={t.preview_phrase_label()}
        value={phrase}
        options={[
          ...phrases.map((id) => ({ value: id, label: languageName.of(id) ?? id })),
          { value: CUSTOM, label: t.preview_phrase_custom(), disabled: phrase !== CUSTOM },
        ]}
        onChange={(id) => {
          if (id !== CUSTOM) setSample(phraseText(id as (typeof PHRASES)[number]));
        }}
      />
      <div class="ff-field">
        <label for="ff-preview-sample">{t.preview_sample_label()}</label>
        <input
          id="ff-preview-sample"
          class="ff-input"
          type="text"
          value={sample}
          onInput={(event) => setSample(event.currentTarget.value)}
        />
      </div>
      <div class="ff-preview__stage">
        {(mode === 'side' || mode === 'web') && (
          <figure>
            <figcaption>{t.preview_web_label()}</figcaption>
            <p class="ff-preview__text" style={webStyle}>
              {sample}
            </p>
          </figure>
        )}
        {(mode === 'side' || mode === 'fallback') && (
          <figure>
            <figcaption>{t.preview_fallback_label()}</figcaption>
            <p class="ff-preview__text" style={fallbackStyle}>
              {sample}
            </p>
          </figure>
        )}
        {mode === 'overlay' && (
          <figure>
            <figcaption>{t.overlay_legend()}</figcaption>
            <div class="ff-preview__text ff-preview__overlay">
              <p style={{ ...webStyle, margin: 0 }}>{sample}</p>
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
