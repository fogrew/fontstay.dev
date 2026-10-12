import { type ComponentChildren, Fragment } from 'preact';
import { useCallback, useMemo, useState } from 'preact/hooks';
import { type Locale, localizeHref, messagesFor } from '@/common/i18n';
import { Button, Select } from '@/common/ui';
import { AudienceEditor, OsIcon } from '@/modules/audience';
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

type Level = CatalogCell['level'];

interface Filters {
  name: string;
  category: string;
  levels: Partial<Record<(typeof CATALOG_SYSTEMS)[number], Level | ''>>;
  minCoverage: string;
}

const NO_FILTERS: Filters = { name: '', category: '', levels: {}, minCoverage: '' };
const CATEGORIES = ['serif', 'sans-serif', 'monospace'] as const;
const LEVELS: readonly Level[] = ['preinstalled', 'partial', 'on-demand', 'unknown'];

function matches(
  row: ReturnType<typeof catalogRows>[number],
  filters: Filters,
  shares: SystemShares,
) {
  if (filters.name && !row.family.toLowerCase().includes(filters.name.trim().toLowerCase())) {
    return false;
  }
  if (filters.category && row.category !== filters.category) return false;
  for (const os of CATALOG_SYSTEMS) {
    const level = filters.levels[os];
    if (level && row.cells[os].level !== level) return false;
  }
  const minimum = Number.parseFloat(filters.minCoverage);
  return Number.isNaN(minimum) || audienceCoverage(row, shares) >= minimum;
}

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
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [grouped, setGrouped] = useState(false);
  const sorted = useMemo(
    () => sortRows(rows, sort.key, sort.descending, shares),
    [rows, sort, shares],
  );
  const visible = useMemo(
    () => sorted.filter((row) => matches(row, filters, shares)),
    [sorted, filters, shares],
  );
  const groups = useMemo(() => {
    if (!grouped) return [{ key: '', rows: visible }];
    return CATEGORIES.map((category) => ({
      key: category,
      rows: visible.filter((row) => row.category === category),
    })).filter((group) => group.rows.length > 0);
  }, [grouped, visible]);
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
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

  const header = (key: SortKey, label: string, icon?: ComponentChildren) => {
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
          {icon}
          {label}
        </button>
      </th>
    );
  };

  return (
    <div class="ff-catalog">
      <AudienceEditor locale={locale} onShares={handleShares} active />
      <p class="ff-muted">{t.catalog_note()}</p>
      <div class="ff-catalog__toolbar">
        <label>
          <input
            type="checkbox"
            checked={grouped}
            onChange={(event) => setGrouped(event.currentTarget.checked)}
          />
          {t.catalog_group_type()}
        </label>
        <Button disabled={!filtered} onClick={() => setFilters(NO_FILTERS)}>
          {t.catalog_filters_reset()}
        </Button>
        <span class="ff-muted" role="status">
          {t.catalog_results({ count: visible.length, total: rows.length })}
        </span>
      </div>
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
                <Fragment key={os}>
                  {header(os, t[`audience_os_${os}`](), <OsIcon os={os} />)}
                </Fragment>
              ))}
              {header('coverage', t.catalog_col_coverage())}
            </tr>
            <tr class="ff-catalog__filters">
              <td>
                <input
                  class="ff-input"
                  type="search"
                  aria-label={t.catalog_filter_font()}
                  value={filters.name}
                  onInput={(event) => setFilters({ ...filters, name: event.currentTarget.value })}
                />
              </td>
              <td>
                <Select
                  compact
                  hideLabel
                  label={t.catalog_filter_type()}
                  value={filters.category}
                  options={[
                    { value: '', label: t.catalog_filter_all() },
                    ...CATEGORIES.map((category) => ({
                      value: category,
                      label: categoryLabel(category),
                    })),
                  ]}
                  onChange={(category) => setFilters({ ...filters, category })}
                />
              </td>
              {CATALOG_SYSTEMS.map((os) => (
                <td key={os}>
                  <Select
                    compact
                    hideLabel
                    label={t.catalog_filter_system({ system: t[`audience_os_${os}`]() })}
                    value={filters.levels[os] ?? ''}
                    options={[
                      { value: '', label: t.catalog_filter_all() },
                      ...LEVELS.map((level) => ({ value: level, label: levelLabel(level) })),
                    ]}
                    onChange={(level) =>
                      setFilters({
                        ...filters,
                        levels: { ...filters.levels, [os]: level as Level | '' },
                      })
                    }
                  />
                </td>
              ))}
              <td>
                <input
                  class="ff-input"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="decimal"
                  aria-label={t.catalog_filter_coverage()}
                  value={filters.minCoverage}
                  onInput={(event) =>
                    setFilters({ ...filters, minCoverage: event.currentTarget.value })
                  }
                />
              </td>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.key}>
              {grouped && (
                <tr class="ff-catalog__group">
                  <th scope="colgroup" colSpan={3 + CATALOG_SYSTEMS.length}>
                    {`${categoryLabel(group.key)} (${group.rows.length})`}
                  </th>
                </tr>
              )}
              {group.rows.map((row) => (
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
          ))}
        </table>
      </div>
    </div>
  );
}
