import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from './Button';
import { displayedFitValue, type FitValue, pinFitValue } from './fit-value';

export interface FitFieldProps {
  locale: Locale;
  label: string;
  unit: string;
  value: FitValue;
  autoValue: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  compact?: boolean;
  onChange: (value: FitValue) => void;
}

export function FitField({
  locale,
  label,
  unit,
  value,
  autoValue,
  min,
  max,
  step = 1,
  disabled = false,
  compact = false,
  onChange,
}: FitFieldProps) {
  const id = useId();
  const t = messagesFor(locale);
  const current = displayedFitValue(value, autoValue, { min, max });
  const [draft, setDraft] = useState(String(current));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(String(current));
  }, [current, value.mode]);
  const pin = (next: number) => onChange(pinFitValue(Math.min(max, Math.max(min, next))));
  const commit = (input: HTMLInputElement) => {
    editing.current = false;
    const next = input.valueAsNumber;
    if (Number.isFinite(next)) {
      const bounded = Math.min(max, Math.max(min, next));
      if (bounded !== current) pin(bounded);
      setDraft(String(bounded));
    } else setDraft(String(current));
  };
  return (
    <fieldset class={compact ? 'ff-fit ff-fit--compact' : 'ff-fit'} disabled={disabled}>
      <legend class="ff-fit__legend">
        {label} <span class="ff-muted">({unit})</span>
      </legend>
      <div class="ff-fit__inputs">
        <label class="ff-sr-only" for={`${id}-slider`}>
          {label} ({unit}), {t.ui_slider_suffix()}
        </label>
        <input
          class="ff-fit__range ff-control"
          id={`${id}-slider`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={current}
          aria-valuetext={`${current} ${unit}`}
          onInput={(event) => pin(event.currentTarget.valueAsNumber)}
        />
        <label class="ff-sr-only" for={`${id}-number`}>
          {label} ({unit}), {t.ui_number_suffix()}
        </label>
        <input
          id={`${id}-number`}
          class="ff-control ff-input ff-fit__number"
          type="number"
          min={min}
          max={max}
          step="any"
          value={draft}
          onFocus={() => {
            editing.current = true;
          }}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onBlur={(event) => commit(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </div>
      <div class="ff-fit__actions">
        <label class="ff-check">
          <input
            class="ff-check__input ff-control"
            type="checkbox"
            checked={value.mode === 'auto'}
            onChange={(event) =>
              onChange(event.currentTarget.checked ? { mode: 'auto' } : pinFitValue(current))
            }
          />
          {t.ui_auto()}
        </label>
        {!compact && (
          <Button
            onClick={() => onChange({ mode: 'auto' })}
            disabled={disabled || value.mode === 'auto'}
          >
            {t.ui_reset_auto()}
          </Button>
        )}
      </div>
    </fieldset>
  );
}
