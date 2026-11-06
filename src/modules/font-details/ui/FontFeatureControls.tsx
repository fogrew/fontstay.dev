import { useId } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, CodeBlock } from '@/common/ui';
import type { FontMetrics } from '@/modules/font-metrics';
import { buildDetailsCss } from '../lib/css';
import { isDefaultOn } from '../lib/default-on';
import { type DetailsSelection, NO_SELECTION, selectionStyle } from '../lib/selection';
import { featureTitle } from './feature-title';
import './font-details.css';

export interface FontTuning {
  selection: DetailsSelection;
  style: ReturnType<typeof selectionStyle> | undefined;
}

export interface FontFeatureControlsProps {
  locale: Locale;
  metrics: FontMetrics;
  selection?: DetailsSelection | undefined;
  onChange: (next: FontTuning) => void;
}

export function FontFeatureControls({
  locale,
  metrics,
  selection = NO_SELECTION,
  onChange,
}: FontFeatureControlsProps) {
  const t = messagesFor(locale);
  const scope = useId();
  const { details } = metrics;
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  const change = (next: DetailsSelection) =>
    onChange({ selection: next, style: selectionStyle(details.axes, next) });
  const css = buildDetailsCss(details.axes, selection);
  if (details.features.length === 0 && details.axes.length === 0) return null;

  return (
    <fieldset class="ff-details ff-details--features">
      <legend class="ff-details__subheading">{t.details_controls_heading()}</legend>
      {details.features.length > 0 && (
        <ul class="ff-details__features">
          {details.features.map((feature, index) => {
            const id = `${scope}-feature-${index}`;
            return (
              <li key={feature.tag} class="ff-details__feature">
                <input
                  id={id}
                  class="ff-details__check"
                  type="checkbox"
                  checked={selection.features[feature.tag] ?? isDefaultOn(feature.tag)}
                  onChange={(event) =>
                    change({
                      ...selection,
                      features: {
                        ...selection.features,
                        [feature.tag]: event.currentTarget.checked,
                      },
                    })
                  }
                />
                <label class="ff-details__feature-text" for={id}>
                  <span>
                    <code class="ff-details__tag">{feature.tag}</code>{' '}
                    <span>{featureTitle(t, feature)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {details.axes.length > 0 && (
        <ul class="ff-details__axes">
          {details.axes.map((axis) => {
            const value = selection.axes[axis.tag] ?? axis.default;
            const label = `${scope}-axis-${axis.tag}`;
            return (
              <li key={axis.tag} class="ff-details__axis">
                <div class="ff-field">
                  <span id={label}>{t.details_axis_label({ name: axis.name, tag: axis.tag })}</span>
                  <span class="ff-details__axis-controls">
                    <input
                      type="range"
                      class="ff-details__range"
                      min={axis.min}
                      max={axis.max}
                      step="any"
                      value={value}
                      aria-labelledby={label}
                      onInput={(event) =>
                        change({
                          ...selection,
                          axes: {
                            ...selection.axes,
                            [axis.tag]: event.currentTarget.valueAsNumber,
                          },
                        })
                      }
                    />
                    <output class="ff-details__axis-value">{number.format(value)}</output>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {details.instances.length > 0 && (
        <fieldset class="ff-button-group ff-button-group--compact">
          <legend class="ff-sr-only">{t.details_instances_label()}</legend>
          {details.instances.map((instance, index) => (
            <button
              key={`${instance.name}-${index}`}
              type="button"
              class="ff-button"
              aria-pressed={details.axes.every(
                (axis) =>
                  (selection.axes[axis.tag] ?? axis.default) ===
                  (instance.coordinates[axis.tag] ?? axis.default),
              )}
              onClick={() => change({ ...selection, axes: { ...instance.coordinates } })}
            >
              {instance.name || index + 1}
            </button>
          ))}
        </fieldset>
      )}
      {css !== '' && (
        <>
          <CodeBlock locale={locale} code={css} label={t.details_css_label()} language="css" />
          <Button onClick={() => change(NO_SELECTION)}>{t.details_controls_reset()}</Button>
        </>
      )}
    </fieldset>
  );
}
