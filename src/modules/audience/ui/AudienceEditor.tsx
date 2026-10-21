import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Disclosure, Icon } from '@/common/ui';
import { MAX_BROWSERSLIST_CHARS, parseBrowserslist } from '../lib/browserslist-file';
import type { Os, OsShares, WeightedEntry } from '../lib/os';
import { DEFAULT_QUERY, MY_STATS_PRESET } from '../lib/presets';
import { type Resolution, resolveQuery } from '../lib/resolve';
import {
  importStats,
  isStatsFile,
  MAX_STATS_BYTES,
  type StatsErrorCode,
  type StatsResult,
  type UsageStats,
} from '../lib/stats';
import { splitOsQuery } from '../lib/tags';
import { BrowserIcon } from './BrandIcon';
import { OsPanel } from './OsPanel';
import { TagEditor } from './TagEditor';
import './audience.css';

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

export const AUDIENCE_SET_EVENT = 'ff-audience-set';
export const AUDIENCE_FILE_EVENT = 'ff-audience-file';

export function AudienceEditor({
  locale,
  onShares,
  onEntries,
  onQueryChange,
  initialQuery,
  active = false,
  defaultOpen = false,
}: {
  locale: Locale;
  initialQuery?: string | undefined;
  onQueryChange?: ((query: string) => void) | undefined;
  active?: boolean;
  defaultOpen?: boolean;
  onEntries?: ((data: AudienceData | undefined) => void) | undefined;
  onShares?: ((shares: OsShares) => void) | undefined;
}) {
  const t = messagesFor(locale);
  const browsersId = useId();
  const messageId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const listInput = useRef<HTMLInputElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(defaultOpen);
  const [query, setQuery] = useState<string>(initialQuery ?? DEFAULT_QUERY);
  const [state, setState] = useState<State>({ loading: true });
  useEffect(() => {
    onQueryChange?.(query);
  }, [query, onQueryChange]);
  useEffect(() => {
    const apply = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail === 'string' && detail.trim()) setQuery(detail.trim().slice(0, 500));
    };
    window.addEventListener(AUDIENCE_SET_EVENT, apply);
    return () => window.removeEventListener(AUDIENCE_SET_EVENT, apply);
  }, []);
  const osQuery = splitOsQuery(query);
  const browserQuery = osQuery.browsers || DEFAULT_QUERY;
  const allowed = (os: Os) =>
    !osQuery.exclude.includes(os) && (osQuery.include.length === 0 || osQuery.include.includes(os));
  const [stats, setStats] = useState<StatsInfo>();
  const [statsError, setStatsError] = useState('');
  const [fileNote, setFileNote] = useState('');
  const userStats: UsageStats | undefined = stats?.stats;

  useEffect(() => {
    if (!opened && !active) return;
    let current = true;
    const timer = setTimeout(() => {
      resolveQuery(browserQuery, userStats).then(
        (resolution) => current && setState(resolution),
        () => current && setState({ failed: true }),
      );
    }, DEBOUNCE_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [opened, active, browserQuery, userStats]);

  const statsErrors: Record<StatsErrorCode, string> = {
    'too-large': t.audience_stats_error_too_large(),
    'not-json': t.audience_stats_error_not_json(),
    'wrong-shape': t.audience_stats_error_wrong_shape(),
    'bad-value': t.audience_stats_error_bad_value(),
    'too-many': t.audience_stats_error_too_many(),
    empty: t.audience_stats_error_empty(),
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

  const loadList = async (file: File | undefined) => {
    if (!file) return;
    const queries = parseBrowserslist(
      file.size > MAX_BROWSERSLIST_CHARS ? '' : await file.text().catch(() => ''),
    );
    if (queries.length === 0) {
      setFileNote(t.audience_file_empty({ name: file.name }));
      return;
    }
    setQuery(queries.join(', '));
    setFileNote(t.audience_file_loaded({ count: queries.length, name: file.name }));
  };
  const loadFile = (file: File | undefined) =>
    file && isStatsFile(file.name) ? loadStats(file) : loadList(file);
  const loadFileRef = useRef(loadFile);
  loadFileRef.current = loadFile;
  useEffect(() => {
    const receive = (event: Event) => {
      const file = (event as CustomEvent<unknown>).detail;
      if (file instanceof File) void loadFileRef.current(file);
    };
    window.addEventListener(AUDIENCE_FILE_EVENT, receive);
    return () => window.removeEventListener(AUDIENCE_FILE_EVENT, receive);
  }, []);

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

  return (
    <Disclosure
      icon={<Icon name="browserslist" />}
      summary={t.audience_heading()}
      open={defaultOpen}
      onToggle={(open) => open && setOpened(true)}
    >
      <div class="ff-audience">
        <div class="ff-audience__filters">
          <TagEditor
            locale={locale}
            query={query}
            onChange={setQuery}
            stats={Boolean(stats)}
            invalid={invalid}
            describedBy={messageId}
          />
          <div id={messageId} role="status" class="ff-audience__result">
            {'loading' in state && opened && t.audience_loading()}
            {'failed' in state && t.audience_load_failed()}
            {'ok' in state && !state.ok && (
              <span class="ff-error">
                {errors[state.code]} {state.detail}
              </span>
            )}
          </div>
          <div class="ff-audience__stats">
            <div class="ff-audience__actions" ref={actions}>
              <Button onClick={() => fileInput.current?.click()}>
                {t.audience_stats_import()}
              </Button>
              <Button onClick={() => listInput.current?.click()}>{t.audience_file_import()}</Button>
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
            <input
              ref={listInput}
              hidden
              type="file"
              onChange={(event) => {
                void loadList(event.currentTarget.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
            <div role="status">{fileNote && <p class="ff-muted">{fileNote}</p>}</div>
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
        <div class="ff-audience__results">
          {'ok' in state && state.ok && (
            <div class="ff-audience__columns">
              <section class="ff-audience__browsers" aria-labelledby={browsersId}>
                <h3 id={browsersId}>{t.audience_browsers_heading({ count: state.count })}</h3>
                {state.coverage !== undefined && (
                  <p>
                    {t.audience_coverage({
                      percent: new Intl.NumberFormat(locale, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      }).format(state.coverage),
                    })}
                  </p>
                )}
                <ul class="ff-audience__list" aria-label={t.audience_list_label()}>
                  {state.groups.map((group) => (
                    <li key={group.id}>
                      <span>
                        <BrowserIcon id={group.id} />
                        {group.name}
                      </span>
                      <span class="ff-muted">{group.ranges.join(', ')}</span>
                    </li>
                  ))}
                </ul>
                <p class="ff-muted">
                  {t.audience_data_date({
                    date: new Intl.DateTimeFormat(locale, {
                      dateStyle: 'medium',
                      timeZone: 'UTC',
                    }).format(new Date(`${state.dataDate}T00:00:00Z`)),
                  })}
                </p>
              </section>
              <OsPanel
                locale={locale}
                entries={state.entries}
                allowed={allowed}
                onChange={onShares}
              />
            </div>
          )}
        </div>
      </div>
    </Disclosure>
  );
}
