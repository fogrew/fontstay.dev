import { useEffect, useId, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import {
  computeManualShares,
  computeOsShares,
  DEFAULT_DESKTOP_SPLIT,
  MAX_MANUAL_WEIGHT,
  OS_IDS,
  type Os,
  type OsShares,
  type WeightedEntry,
} from '../lib/os';
import { OsIcon } from './BrandIcon';

export type Mode = 'browsers' | 'manual';

const MANUAL_IDS = OS_IDS.filter((id) => id !== 'other');

function parseNumber(text: string): number {
  return text.trim() === '' ? 0 : Number(text);
}

export function OsPanel({
  locale,
  entries,
  onChange,
}: {
  locale: Locale;
  entries: readonly WeightedEntry[] | undefined;
  onChange?: ((shares: OsShares, mode: Mode) => void) | undefined;
}) {
  const t = messagesFor(locale);
  const groupId = useId();
  const [mode, setMode] = useState<Mode>('browsers');
  const [manualText, setManualText] = useState<Record<string, string>>({});

  const shares =
    mode === 'browsers'
      ? computeOsShares(entries ?? [], DEFAULT_DESKTOP_SPLIT)
      : computeManualShares(
          Object.fromEntries(MANUAL_IDS.map((id) => [id, parseNumber(manualText[id] ?? '')])),
        );
  const manualEmpty = mode === 'manual' && OS_IDS.every((id) => shares[id] === 0);

  const key = JSON.stringify(shares);
  useEffect(() => {
    onChange?.(JSON.parse(key) as OsShares, mode);
  }, [key, mode, onChange]);

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const label = (id: Os) => t[`audience_os_${id}`]();

  return (
    <div class="ff-audience__os">
      <h3>{t.audience_os_heading()}</h3>
      <fieldset class="ff-audience__modes">
        <legend>{t.audience_os_mode_label()}</legend>
        {(['browsers', 'manual'] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name={groupId}
              checked={mode === value}
              onChange={() => setMode(value)}
            />{' '}
            {value === 'browsers' ? t.audience_os_mode_browsers() : t.audience_os_mode_manual()}
          </label>
        ))}
      </fieldset>

      {mode === 'manual' && (
        <fieldset class="ff-audience__split">
          <legend>{t.audience_os_manual_hint()}</legend>
          {MANUAL_IDS.map((id) => (
            <label key={id}>
              <span>
                <OsIcon os={id} />
                {label(id)}
              </span>
              <input
                class="ff-input"
                type="number"
                inputMode="decimal"
                min={0}
                max={MAX_MANUAL_WEIGHT}
                step="any"
                value={manualText[id] ?? ''}
                onInput={(event) => {
                  const text = event.currentTarget.value;
                  setManualText((current) => ({ ...current, [id]: text }));
                }}
              />
            </label>
          ))}
          <p class="ff-error" role="status">
            {manualEmpty && t.audience_os_manual_empty()}
          </p>
        </fieldset>
      )}

      <ul class="ff-audience__list" aria-label={t.audience_os_shares_label()}>
        {OS_IDS.filter((id) => shares[id] > 0).map((id) => (
          <li key={id}>
            <span>
              <OsIcon os={id} />
              {label(id)}
            </span>
            <span class="ff-muted">
              {number.format(shares[id])}
              {t.fit_percent_unit()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
