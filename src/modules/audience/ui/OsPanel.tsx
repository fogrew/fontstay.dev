import { useEffect } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import {
  computeOsShares,
  DEFAULT_DESKTOP_SPLIT,
  OS_IDS,
  type Os,
  type OsShares,
  type WeightedEntry,
} from '../lib/os';
import { OsIcon } from './BrandIcon';

export function OsPanel({
  locale,
  entries,
  onChange,
}: {
  locale: Locale;
  entries: readonly WeightedEntry[] | undefined;
  onChange?: ((shares: OsShares) => void) | undefined;
}) {
  const t = messagesFor(locale);
  const shares = computeOsShares(entries ?? [], DEFAULT_DESKTOP_SPLIT);

  const key = JSON.stringify(shares);
  useEffect(() => {
    onChange?.(JSON.parse(key) as OsShares);
  }, [key, onChange]);

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const label = (id: Os) => t[`audience_os_${id}`]();

  return (
    <div class="ff-audience__os">
      <h3>{t.audience_os_heading()}</h3>
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
