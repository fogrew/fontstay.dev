import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Disclosure, Select } from '@/common/ui';
import type { OsShares, WeightedEntry } from '../lib/os';
import { DEFAULT_QUERY, MY_STATS_PRESET, PRESETS, presetFor } from '../lib/presets';
import { MAX_QUERY_LENGTH, type Resolution, resolveQuery } from '../lib/resolve';
import {
  importStats,
  MAX_STATS_BYTES,
  type StatsErrorCode,
  type StatsResult,
  type UsageStats,
} from '../lib/stats';
import { OsPanel } from './OsPanel';
import './audience.css';

const CUSTOM = 'custom';
const DEBOUNCE_MS = 250;
const GENERATORS = [
  ['browserslist-ga', 'https://github.com/browserslist/browserslist-ga'],
  ['browserslist-ga-export', 'https://github.com/browserslist/browserslist-ga-export'],
  ['browserslist-plausible', 'https://github.com/browserslist/browserslist-plausible'],
] as const;
const STATS_FORMAT = 'https://github.com/browserslist/browserslist#custom-usage-data';

type State = Resolution | { loading: true } | { failed: true };
type StatsInfo = Extract<StatsResult, { ok: true }>;

export interface AudienceData {
  entries: WeightedEntry[];
  released: Record<string, string[]>;
}

export function AudienceEditor({
  locale,
  onShares,
  onEntries,
  onQueryChange,
  initialQuery,
  active = false,
}: {
  locale: Locale;
  initialQuery?: string | undefined;
  onQueryChange?: ((query: string) => void) | undefined;
  active?: boolean;
  onEntries?: ((data: AudienceData | undefined) => void) | undefined;
  onShares?: ((shares: OsShares, mode: 'browsers' | 'manual') => void) | undefined;
}) {
  const t = messagesFor(locale);
  const inputId = useId();
  const messageId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const [query, setQuery] = useState<string>(initialQuery ?? DEFAULT_QUERY);
  const [state, setState] = useState<State>({ loading: true });
  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);
  const [stats, setStats] = useState<StatsInfo>();
  const [statsError, setStatsError] = useState('');
  const userStats: UsageStats | undefined = stats?.stats;

  useEffect(() => {
    if (!opened && !active) return;
    let current = true;
    const timer = setTimeout(() => {
      resolveQuery(query, userStats).then(
        (resolution) => current && setState(resolution),
        () => current && setState({ failed: true }),
      );
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [opened, active, query, userStats]);

  const statsErrors: Record<StatsErrorCode, string> = {
    'too-large': t.audience_stats_error_too_large(),
    'not-json': t.audience_stats_error_not_json(),
    'wrong-shape': t.audience_stats_error_wrong_shape(),
    'bad-value': t.audience_stats_error_bad_value(),
    'too-many': t.audience_stats_error_too_many(),
  };

  const loadStats = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_STATS_BYTES) {
      setStatsError(statsErrors['too-large']);
      return;
    }
    let result: StatsResult;
    try {
      result = await importStats(await file.text());
    } catch {
      setStatsError(t.audience_load_failed());
      return;
    }
    if (!result.ok) {
      setStatsError(`${statsErrors[result.code]} ${result.detail}`.trim());
      return;
    }
    setStatsError('');
    setStats(result);
    setQuery(MY_STATS_PRESET.query);
  };

  const resolved = 'ok' in state && state.ok ? state : undefined;
  useEffect(() => {
    onEntries?.(resolved ? { entries: resolved.entries, released: resolved.released } : undefined);
  }, [resolved, onEntries]);
  const invalid = 'ok' in state && !state.ok;
  const errors = {
    empty: t.audience_error_empty(),
    'too-long': t.audience_error_too_long(),
    invalid: t.audience_error_invalid(),
    'no-match': t.audience_error_no_match(),
  };
  const presets = stats ? [...PRESETS, MY_STATS_PRESET] : PRESETS;

  return (
    <Disclosure summary={t.audience_heading()} onToggle={(open) => open && setOpened(true)}>
      <div class="ff-audience">
        <Select
          label={t.audience_preset_label()}
          value={presetFor(query, Boolean(stats))?.id ?? CUSTOM}
          options={[
            ...presets.map((preset) => ({ value: preset.id, label: t[preset.label]() })),
            { value: CUSTOM, label: t.audience_preset_custom(), disabled: true },
          ]}
          onChange={(id) => setQuery(presets.find((preset) => preset.id === id)?.query ?? query)}
        />
        <div class="ff-field">
          <label for={inputId}>{t.audience_query_label()}</label>
          <input
            id={inputId}
            class="ff-input"
            type="text"
            spellcheck={false}
            autocomplete="off"
            maxLength={MAX_QUERY_LENGTH * 2}
            value={query}
            aria-invalid={invalid}
            aria-describedby={messageId}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
          <p class="ff-muted">{t.audience_query_hint()}</p>
        </div>
        <div id={messageId} role="status" class="ff-audience__result">
          {'loading' in state && opened && t.audience_loading()}
          {'failed' in state && t.audience_load_failed()}
          {'ok' in state && !state.ok && (
            <span class="ff-error">
              {errors[state.code]} {state.detail}
            </span>
          )}
          {'ok' in state && state.ok && (
            <>
              <strong>{t.audience_resolved({ count: state.count })}</strong>
              {state.coverage !== undefined && (
                <span>
                  {t.audience_coverage({
                    percent: new Intl.NumberFormat(locale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }).format(state.coverage),
                  })}
                </span>
              )}
              <span class="ff-muted">
                {t.audience_data_date({
                  date: new Intl.DateTimeFormat(locale, {
                    dateStyle: 'medium',
                    timeZone: 'UTC',
                  }).format(new Date(`${state.dataDate}T00:00:00Z`)),
                })}
              </span>
            </>
          )}
        </div>
        {'ok' in state && state.ok && (
          <ul class="ff-audience__list" aria-label={t.audience_list_label()}>
            {state.groups.map((group) => (
              <li key={group.id}>
                <span>{group.name}</span>
                <span class="ff-muted">{group.ranges.join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
        <OsPanel
          locale={locale}
          entries={'ok' in state && state.ok ? state.entries : undefined}
          onChange={onShares}
        />
        <div class="ff-audience__stats">
          <div class="ff-audience__actions" ref={actions}>
            <Button onClick={() => fileInput.current?.click()}>{t.audience_stats_import()}</Button>
            {stats && (
              <Button
                onClick={() => {
                  setStats(undefined);
                  if (/my stats/i.test(query)) setQuery(DEFAULT_QUERY);
                  actions.current?.querySelector('button')?.focus();
                }}
              >
                {t.audience_stats_remove()}
              </Button>
            )}
          </div>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              void loadStats(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
          <p class="ff-muted">{t.audience_stats_local()}</p>
          <p class="ff-muted">
            {t.audience_stats_help()}{' '}
            {GENERATORS.map(([name, href], index) => (
              <span key={name}>
                {index > 0 && ', '}
                <a href={href} target="_blank" rel="noreferrer noopener">
                  {name}
                </a>
              </span>
            ))}{' '}
            (
            <a href={STATS_FORMAT} target="_blank" rel="noreferrer noopener">
              JSON
            </a>
            )
          </p>
          <div role="status">
            {statsError && (
              <p class="ff-error" role="alert">
                {statsError}
              </p>
            )}
            {stats && (
              <>
                <p>{t.audience_stats_loaded({ count: stats.entries })}</p>
                {stats.unknownBrowsers.length > 0 && (
                  <p class="ff-muted">
                    {t.audience_stats_unknown_browsers({
                      list: stats.unknownBrowsers.slice(0, 5).join(', '),
                    })}
                  </p>
                )}
                {stats.unknownVersions.length > 0 && (
                  <p class="ff-muted">
                    {t.audience_stats_unknown_versions({
                      count: stats.unknownVersions.length,
                      list: stats.unknownVersions.slice(0, 5).join(', '),
                    })}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </Disclosure>
  );
}
