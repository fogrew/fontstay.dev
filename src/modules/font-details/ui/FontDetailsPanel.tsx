import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Locale, type Messages, messagesFor } from '@/common/i18n';
import { Button, CodeBlock, Tabs } from '@/common/ui';
import {
  type FontFeature,
  type FontMetrics,
  loadLanguageRequirements,
  supportedLanguages,
} from '@/modules/font-metrics';
import { buildDetailsCss, changedAxes, changedFeatures } from '../lib/css';
import { classifyFeature, DEFAULT_PREVIEW, isDefaultOn, sampleFor } from '../lib/features';
import './font-details.css';

export interface FontDetailsPanelProps {
  locale: Locale;
  metrics: FontMetrics;
  bytes: ArrayBuffer;
  fontId: number;
}

const URL_PROTOCOLS = new Set(['http:', 'https:']);

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return URL_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function featureTitle(t: Messages, feature: FontFeature): string {
  const kind = classifyFeature(feature.tag);
  switch (kind.kind) {
    case 'known':
      return t[`details_feature_${kind.tag}`]();
    case 'stylistic-set':
      return feature.label ?? t.details_feature_stylistic_set({ number: kind.number });
    case 'character-variant':
      return feature.label ?? t.details_feature_character_variant({ number: kind.number });
    case 'joining':
      return t.details_feature_joining();
    case 'shaping':
      return t.details_feature_shaping();
    default:
      return t.details_feature_unknown();
  }
}

const settingsOf = (tags: Record<string, number>) =>
  Object.entries(tags)
    .map(([tag, value]) => `"${tag}" ${value}`)
    .join(', ');

export function FontDetailsPanel({ locale, metrics, bytes, fontId }: FontDetailsPanelProps) {
  const t = messagesFor(locale);
  const { details } = metrics;
  const family = `ff-details-${fontId}`;
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [axisValues, setAxisValues] = useState<Record<string, number>>({});
  const [text, setText] = useState(DEFAULT_PREVIEW);
  const [loaded, setLoaded] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [languages, setLanguages] = useState<string[]>();

  useEffect(() => {
    let cancelled = false;
    setLoaded('loading');
    const face = new FontFace(family, bytes.slice(0));
    face
      .load()
      .then(() => {
        if (cancelled) return;
        document.fonts.add(face);
        setLoaded('ready');
      })
      .catch(() => {
        if (!cancelled) setLoaded('failed');
      });
    return () => {
      cancelled = true;
      document.fonts.delete(face);
    };
  }, [bytes, family]);

  useEffect(() => {
    let cancelled = false;
    setLanguages(undefined);
    void loadLanguageRequirements().then((requirements) => {
      if (!cancelled) setLanguages(supportedLanguages(metrics.codePoints, requirements));
    });
    return () => {
      cancelled = true;
    };
  }, [metrics.codePoints]);

  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'language' });
    } catch {
      return undefined;
    }
  }, [locale]);
  const languageList = useMemo(
    () =>
      (languages ?? [])
        .map((code) => ({ code, name: names?.of(code) ?? code }))
        .sort((a, b) => a.name.localeCompare(b.name, locale)),
    [languages, names, locale],
  );

  const css = buildDetailsCss(details.axes, { features, axes: axisValues });
  const featureSettings = settingsOf(
    Object.fromEntries(changedFeatures(features).map(({ tag, on }) => [tag, on ? 1 : 0])),
  );
  const variationSettings = settingsOf(
    Object.fromEntries(changedAxes(details.axes, axisValues).map(({ tag, value }) => [tag, value])),
  );
  const selectedStyle = {
    fontFamily: `"${family}"`,
    fontFeatureSettings: featureSettings || 'normal',
    fontVariationSettings: variationSettings || 'normal',
  };
  const touched = css !== '';
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });

  const field = (label: string, value: string | null, href?: string | null) => (
    <>
      <dt class="ff-details__term">{label}</dt>
      <dd class="ff-details__value">
        {value === null ? (
          <span class="ff-muted">{t.details_none()}</span>
        ) : href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </>
  );

  const overview = (
    <dl class="ff-details__fields">
      {field(t.details_field_family(), metrics.names.family)}
      {field(t.details_field_full_name(), metrics.names.fullName)}
      {field(t.details_field_postscript(), metrics.names.postscript)}
      {field(
        t.details_field_kind(),
        metrics.isVariable ? t.details_kind_variable() : t.details_kind_static(),
      )}
      {field(t.details_field_version(), details.names.version)}
      {field(
        t.details_field_designer(),
        details.names.designer,
        safeUrl(details.names.designerUrl),
      )}
      {field(
        t.details_field_manufacturer(),
        details.names.manufacturer,
        safeUrl(details.names.vendorUrl),
      )}
      {field(t.details_field_license(), details.names.license, safeUrl(details.names.licenseUrl))}
      {field(t.details_field_description(), details.names.description)}
      {field(t.details_field_copyright(), details.names.copyright)}
      {field(t.details_field_characters(), number.format(metrics.codePoints.length))}
      {field(
        t.details_field_scripts(),
        details.scripts.length > 0 ? details.scripts.join(', ') : null,
      )}
    </dl>
  );

  const featureList =
    details.features.length === 0 ? (
      <p class="ff-muted">{t.details_features_none()}</p>
    ) : (
      <>
        <p class="ff-details__note">
          {t.details_features_summary({ count: details.features.length })}
        </p>
        <ul class="ff-details__features">
          {details.features.map((feature) => {
            const on = features[feature.tag] ?? isDefaultOn(feature.tag);
            const id = `ff-details-${fontId}-${feature.tag}`;
            return (
              <li key={feature.tag} class="ff-details__feature">
                <input
                  id={id}
                  class="ff-details__check"
                  type="checkbox"
                  checked={on}
                  aria-label={t.details_feature_toggle({ tag: feature.tag })}
                  onChange={(event) =>
                    setFeatures({ ...features, [feature.tag]: event.currentTarget.checked })
                  }
                />
                <div class="ff-details__feature-text">
                  <label for={id}>
                    <code class="ff-details__tag">{feature.tag}</code>{' '}
                    <span>{featureTitle(t, feature)}</span>
                  </label>
                  <span class="ff-details__meta">
                    {feature.tables
                      .map((table) =>
                        table === 'GSUB' ? t.details_feature_gsub() : t.details_feature_gpos(),
                      )
                      .join(' · ')}
                    {isDefaultOn(feature.tag) && ` · ${t.details_feature_default_on()}`}
                  </span>
                </div>
                <span
                  class="ff-details__sample"
                  role="img"
                  aria-label={t.details_feature_sample({ tag: feature.tag })}
                  style={{
                    fontFamily: `"${family}"`,
                    fontFeatureSettings: `"${feature.tag}" 1`,
                    fontVariationSettings: variationSettings || 'normal',
                  }}
                >
                  {sampleFor(feature.tag)}
                </span>
              </li>
            );
          })}
        </ul>
      </>
    );

  const axesView =
    details.axes.length === 0 ? (
      <p class="ff-muted">{t.details_axes_none()}</p>
    ) : (
      <>
        <p class="ff-details__note">
          {t.details_axes_summary({
            count: details.axes.length,
            instances: details.instances.length,
          })}
        </p>
        <ul class="ff-details__axes">
          {details.axes.map((axis) => {
            const value = axisValues[axis.tag] ?? axis.default;
            const step = axis.max - axis.min <= 10 ? 0.01 : 1;
            const name = t.details_axis_label({ name: axis.name, tag: axis.tag });
            return (
              <li key={axis.tag} class="ff-details__axis">
                <label class="ff-field">
                  <span>{name}</span>
                  <span class="ff-details__axis-controls">
                    <input
                      type="range"
                      class="ff-details__range"
                      min={axis.min}
                      max={axis.max}
                      step={step}
                      value={value}
                      aria-label={t.details_axis_value({ name })}
                      onInput={(event) =>
                        setAxisValues({
                          ...axisValues,
                          [axis.tag]: Number(event.currentTarget.value),
                        })
                      }
                    />
                    <output class="ff-details__axis-value">{number.format(value)}</output>
                  </span>
                </label>
                <span class="ff-details__meta">
                  {t.details_axis_range({
                    min: number.format(axis.min),
                    max: number.format(axis.max),
                    initial: number.format(axis.default),
                  })}
                </span>
              </li>
            );
          })}
        </ul>
        {details.instances.length > 0 && (
          <>
            <h4 class="ff-details__subheading">{t.details_instances_heading()}</h4>
            <fieldset class="ff-button-group ff-button-group--compact">
              <legend class="ff-sr-only">{t.details_instances_label()}</legend>
              {details.instances.map((instance, index) => {
                const pressed = details.axes.every(
                  (axis) =>
                    (axisValues[axis.tag] ?? axis.default) ===
                    (instance.coordinates[axis.tag] ?? axis.default),
                );
                return (
                  <button
                    key={`${instance.name}-${index}`}
                    type="button"
                    class="ff-button"
                    aria-pressed={pressed}
                    onClick={() => setAxisValues({ ...instance.coordinates })}
                  >
                    {instance.name || index + 1}
                  </button>
                );
              })}
            </fieldset>
          </>
        )}
      </>
    );

  const languagesView =
    languages === undefined ? (
      <p class="ff-muted" role="status">
        {t.details_languages_loading()}
      </p>
    ) : languageList.length === 0 ? (
      <p class="ff-muted">{t.details_languages_none()}</p>
    ) : (
      <>
        <p class="ff-details__note">
          {t.details_languages_summary({ count: languageList.length })}
        </p>
        <ul class="ff-details__languages" aria-label={t.details_languages_list()}>
          {languageList.map((language) => (
            <li key={language.code} class="ff-details__language" title={language.code}>
              {language.name}
            </li>
          ))}
        </ul>
      </>
    );

  const colorView =
    details.colorFormats.length === 0 && !details.palettes ? (
      <p class="ff-muted">{t.details_color_none()}</p>
    ) : (
      <>
        {details.colorFormats.length > 0 && (
          <p class="ff-details__note">
            {t.details_color_formats({ formats: details.colorFormats.join(', ') })}
          </p>
        )}
        {details.palettes && (
          <>
            <p class="ff-details__note">
              {t.details_palettes_summary({
                count: details.palettes.palettes.length,
                entries: details.palettes.entries,
              })}
            </p>
            <ul class="ff-details__palettes">
              {details.palettes.palettes.map((palette, index) => (
                <li key={palette.join()} class="ff-details__palette">
                  <span>{t.details_palette_label({ number: index + 1 })}</span>
                  <span class="ff-details__swatches" role="img" aria-label={palette.join(', ')}>
                    {palette.map((color, position) => (
                      <span
                        key={position}
                        class="ff-details__swatch"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </>
    );

  const cssView = touched ? (
    <CodeBlock locale={locale} code={css} label={t.details_css_label()} language="css" />
  ) : (
    <p class="ff-muted">{t.details_css_empty()}</p>
  );

  return (
    <div class="ff-details">
      <div class="ff-details__preview">
        <label class="ff-field">
          <span>{t.details_preview_label()}</span>
          <input
            class="ff-input"
            type="text"
            value={text}
            onInput={(event) => setText(event.currentTarget.value)}
          />
        </label>
        <p class="ff-details__stage" style={loaded === 'ready' ? selectedStyle : undefined}>
          {text}
        </p>
        {loaded === 'failed' && (
          <p class="ff-error" role="alert">
            {t.details_load_failed()}
          </p>
        )}
        {touched && (
          <Button
            onClick={() => {
              setFeatures({});
              setAxisValues({});
            }}
          >
            {t.details_preview_reset()}
          </Button>
        )}
      </div>
      <Tabs
        label={t.details_tabs_label()}
        items={[
          { id: 'overview', label: t.details_tab_overview(), content: overview },
          { id: 'features', label: t.details_tab_features(), content: featureList },
          { id: 'axes', label: t.details_tab_axes(), content: axesView },
          { id: 'languages', label: t.details_tab_languages(), content: languagesView },
          { id: 'color', label: t.details_tab_color(), content: colorView },
          { id: 'css', label: t.details_tab_css(), content: cssView },
        ]}
      />
    </div>
  );
}
