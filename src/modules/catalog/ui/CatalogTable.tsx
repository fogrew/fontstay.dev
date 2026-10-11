import { Fragment } from 'preact';
import { useCallback, useMemo, useState } from 'preact/hooks';
import { type Locale, localizeHref, messagesFor } from '@/common/i18n';
import { AudienceEditor } from '@/modules/audience';
import { osFontsDataset } from '@/modules/os-fonts';
import {
  audienceCoverage,
  CATALOG_SYSTEMS,
  type CatalogCell,
  catalogRows,
  type SortKey,
  type SystemShares,
  sortRows,
} from '../lib/catalog';
import './catalog.css';

const SYMBOLS: Record<CatalogCell['level'], string> = {
  preinstalled: '✓',
  partial: '~',
  'on-demand': '↓',
  unknown: '?',
};

export function CatalogTable({ locale }: { locale: Locale }) {
  const t = messagesFor(locale);
  const rows = useMemo(() => catalogRows(osFontsDataset), []);
  const [shares, setShares] = useState<SystemShares>({});
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({
    key: 'family',
    descending: false,
  });
  const handleShares = useCallback((next: SystemShares) => setShares(next), []);
  const sorted = useMemo(
    () => sortRows(rows, sort.key, sort.descending, shares),
    [rows, sort, shares],
  );
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const levelLabel = (level: CatalogCell['level']) => {
    if (level === 'preinstalled') return t.catalog_level_preinstalled();
    if (level === 'partial') return t.catalog_level_partial();
    return level === 'on-demand' ? t.catalog_level_on_demand() : t.catalog_level_unknown();
  };
  const categoryLabel = (category: string) => {
    if (category === 'serif') return t.type_serif();
    return category === 'monospace' ? t.type_mono() : t.type_sans();
  };

  const header = (key: SortKey, label: string) => {
    const active = sort.key === key;
    const ariaSort = active ? (sort.descending ? 'descending' : 'ascending') : 'none';
    return (
      <th scope="col" aria-sort={ariaSort}>
        <button
          type="button"
          class="ff-catalog__sort"
          onClick={() =>
            setSort(
              active
                ? { key, descending: !sort.descending }
                : { key, descending: key !== 'family' },
            )
          }
        >
          {label}
        </button>
      </th>
    );
  };

  return (
    <div class="ff-catalog">
      <AudienceEditor locale={locale} onShares={handleShares} active />
      <p class="ff-muted">{t.catalog_note()}</p>
      <ul class="ff-catalog__legend">
        {(['preinstalled', 'partial', 'on-demand', 'unknown'] as const).map((level) => (
          <li key={level} data-level={level}>
            <span aria-hidden="true">{SYMBOLS[level]}</span> {levelLabel(level)}
          </li>
        ))}
      </ul>
      <div class="ff-catalog__scroll">
        <table class="ff-catalog__table">
          <caption class="ff-sr-only">{t.catalog_caption()}</caption>
          <thead>
            <tr>
              {header('family', t.catalog_col_font())}
              {header('category', t.catalog_col_type())}
              {CATALOG_SYSTEMS.map((os) => (
                <Fragment key={os}>{header(os, t[`audience_os_${os}`]())}</Fragment>
              ))}
              {header('coverage', t.catalog_col_coverage())}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.id}>
                <th scope="row">
                  <a href={localizeHref(`/fonts/${row.id}/`, { locale })}>{row.family}</a>
                </th>
                <td>{categoryLabel(row.category)}</td>
                {CATALOG_SYSTEMS.map((os) => {
                  const cell = row.cells[os];
                  return (
                    <td key={os} data-level={cell.level}>
                      <span aria-hidden="true">{SYMBOLS[cell.level]}</span>
                      <span class="ff-sr-only">{levelLabel(cell.level)}</span>
                    </td>
                  );
                })}
                <td>{`${number.format(audienceCoverage(row, shares))}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
