import { useEffect, useId } from 'preact/hooks';
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
  allowed,
  onChange,
}: {
  locale: Locale;
  entries: readonly WeightedEntry[] | undefined;
  allowed?: ((os: Os) => boolean) | undefined;
  onChange?: ((shares: OsShares) => void) | undefined;
}) {
  const t = messagesFor(locale);
  const shares = computeOsShares(entries ?? [], DEFAULT_DESKTOP_SPLIT, allowed);

  const key = JSON.stringify(shares);
  useEffect(() => {
    onChange?.(JSON.parse(key) as OsShares);
  }, [key, onChange]);

  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const headingId = useId();
  const listed = OS_IDS.filter((id) => shares[id] > 0);
  const label = (id: Os) => t[`audience_os_${id}`]();

  return (
    <section class="ff-audience__os" aria-labelledby={headingId}>
      <h3 id={headingId}>{t.audience_os_heading_count({ count: listed.length })}</h3>
      <ul class="ff-audience__list" aria-label={t.audience_os_shares_label()}>
        {listed.map((id) => (
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
    </section>
  );
}
