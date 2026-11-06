import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Tabs } from '@/common/ui';
import type { FontMetrics } from '@/modules/font-metrics';
import { isDefaultOn } from '../lib/default-on';
import { loadLanguageRequirements, supportedLanguages } from '../lib/languages';
import { featureTitle } from './feature-title';
import './font-details.css';

export interface FontDetailsPanelProps {
  locale: Locale;
  metrics: FontMetrics;
}

const URL_PROTOCOLS = new Set(['http:', 'https:']);

function safeUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return URL_PROTOCOLS.has(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function FontDetailsPanel({ locale, metrics }: FontDetailsPanelProps) {
  const t = messagesFor(locale);
  const { details } = metrics;
  const [languages, setLanguages] = useState<string[]>();

  useEffect(() => {
    let cancelled = false;
    setLanguages(undefined);
    loadLanguageRequirements()
      .then((requirements) => supportedLanguages(metrics.codePoints, requirements))
      .catch(() => [])
      .then((supported) => {
        if (!cancelled) setLanguages(supported);
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

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });

  const field = (label: string, value: string | null, href?: string | null) => (
    <>
      <dt class="ff-details__term">{label}</dt>
      <dd class="ff-details__value">
        {value === null ? (
          <span class="ff-muted">{t.details_none()}</span>
        ) : href ? (
          <>
            <a href={href} target="_blank" rel="noopener noreferrer">
              {value}
            </a>{' '}
            <span class="ff-details__meta">({new URL(href).host})</span>
          </>
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
          {details.features.map((feature) => (
            <li key={feature.tag} class="ff-details__feature">
              <div class="ff-details__feature-text">
                <span>
                  <code class="ff-details__tag">{feature.tag}</code>{' '}
                  <span>{featureTitle(t, feature)}</span>
                </span>
                <span class="ff-details__meta">
                  {feature.tables
                    .map((table) =>
                      table === 'GSUB' ? t.details_feature_gsub() : t.details_feature_gpos(),
                    )
                    .join(' · ')}
                  {isDefaultOn(feature.tag) && ` · ${t.details_feature_default_on()}`}
                </span>
              </div>
            </li>
          ))}
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
          {details.axes.map((axis) => (
            <li key={axis.tag} class="ff-details__axis">
              <span>{t.details_axis_label({ name: axis.name, tag: axis.tag })}</span>
              <span class="ff-details__meta">
                {t.details_axis_range({
                  min: number.format(axis.min),
                  max: number.format(axis.max),
                  initial: number.format(axis.default),
                })}
              </span>
            </li>
          ))}
        </ul>
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
                <li key={index} class="ff-details__palette">
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

  return (
    <div class="ff-details">
      <Tabs
        label={t.details_tabs_label()}
        items={[
          { id: 'overview', label: t.details_tab_overview(), content: overview },
          { id: 'features', label: t.details_tab_features(), content: featureList },
          { id: 'axes', label: t.details_tab_axes(), content: axesView },
          { id: 'languages', label: t.details_tab_languages(), content: languagesView },
          { id: 'color', label: t.details_tab_color(), content: colorView },
        ]}
      />
    </div>
  );
}
