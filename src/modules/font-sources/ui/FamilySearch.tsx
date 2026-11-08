import { useEffect, useId, useMemo, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Icon, Popover, ScrollShadow, ToggleGroup } from '@/common/ui';
import { FontSourceError } from '../lib/download';
import {
  downloadOrigin,
  type FontOrigin,
  familyPageUrl,
  SOURCES,
  type SourceId,
} from '../lib/origin';
import {
  bestMatchIndex,
  CJK_SUBSETS,
  type FontFamily,
  parseStyle,
  searchFamilies,
} from '../lib/types';
import { ServiceIcon } from './ServiceLink';

type Catalog =
  | { state: 'loading' }
  | { state: 'ready'; families: FontFamily[] }
  | { state: 'failed' };

interface Hit {
  source: SourceId;
  family: FontFamily;
}

const HITS_PER_SOURCE = 20;
const DEFAULT_GOOGLE_HITS = 30;
const DEFAULT_FONTSOURCE_HITS = 20;
const FONTSOURCE_EXAMPLES = [
  'Geist Sans',
  'Open Sauce Sans',
  'DejaVu Sans',
  'DejaVu Serif',
  'Adwaita Sans',
  'Commit Mono',
  'Aileron',
  'Clear Sans',
];
const defaultFontsource = (families: readonly FontFamily[]) => {
  const examples = FONTSOURCE_EXAMPLES.flatMap((name) =>
    families.filter((family) => family.name === name),
  );
  const rest = families.filter((family) => !examples.includes(family));
  return [...examples, ...rest].slice(0, DEFAULT_FONTSOURCE_HITS);
};
const SOFT_LIMIT = 12;
const GUESS_BYTES = 20_000;
const scriptsOf = (family: FontFamily) => family.subsets.filter((name) => !CJK_SUBSETS.has(name));

export function useFamilySearch({
  locale,
  busy,
  query,
  enabled,
  onAccepted,
  slots,
  limit,
  loaded,
  averageBytes,
  onLimitChange,
  onFiles,
}: {
  locale: Locale;
  busy: boolean;
  query: string;
  enabled: boolean;
  onAccepted: (name: string) => void;
  slots: number;
  limit: { value: number; min: number; max: number };
  loaded: number;
  averageBytes: number;
  onLimitChange: (value: number) => void;
  onFiles: (files: File[], origins: ReadonlyMap<File, FontOrigin>) => void;
}) {
  const t = messagesFor(locale);
  const listId = useId();
  const [catalogs, setCatalogs] = useState<Record<SourceId, Catalog>>({
    google: { state: 'loading' },
    fontsource: { state: 'loading' },
  });
  const [chosen, setChosen] = useState<Hit>();
  const [styles, setStyles] = useState<ReadonlySet<string>>(new Set(['400']));
  const [subsets, setSubsets] = useState<ReadonlySet<string>>(new Set(['latin']));
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [navigation, setNavigation] = useState<{ query: string; index: number }>();
  const [tip, setTip] = useState<{ text: string; left: number; top: number }>();

  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(undefined);
    window.addEventListener('scroll', hide, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', hide, { capture: true });
  }, [tip]);

  useEffect(() => {
    for (const id of Object.keys(SOURCES) as SourceId[]) {
      SOURCES[id].loadCatalog().then(
        (families) =>
          setCatalogs((current) => ({ ...current, [id]: { state: 'ready', families } })),
        () => setCatalogs((current) => ({ ...current, [id]: { state: 'failed' } })),
      );
    }
  }, []);

  const hits = useMemo(() => {
    if (Object.values(catalogs).some((catalog) => catalog.state === 'loading')) return [];
    const result: Hit[] = [];
    for (const id of Object.keys(SOURCES) as SourceId[]) {
      const catalog = catalogs[id];
      if (catalog?.state !== 'ready') continue;
      const families = query.trim()
        ? searchFamilies(catalog.families, query, '', HITS_PER_SOURCE)
        : id === 'google'
          ? searchFamilies(catalog.families, '', '', DEFAULT_GOOGLE_HITS)
          : defaultFontsource(catalog.families);
      for (const family of families) {
        result.push({ source: id, family });
      }
    }
    return result;
  }, [catalogs, query]);
  const bestIndex = bestMatchIndex(
    hits.map((hit) => hit.family.name),
    query,
  );
  const activeIndex =
    navigation?.query === query && hits[navigation.index] ? navigation.index : bestIndex;

  const states = Object.values(catalogs).map((catalog) => catalog?.state);
  const loading = states.includes('loading');
  const failed = states.includes('failed');
  const sourceName = (id: SourceId) =>
    id === 'google' ? t.source_name_google() : t.source_name_fontsource();
  const styleLabel = (key: string) => {
    const { weight, italic } = parseStyle(key);
    return italic ? `${weight} ${t.style_italic()}` : String(weight);
  };

  const isChosen = (hit: Hit) =>
    chosen?.source === hit.source && chosen.family.id === hit.family.id;
  const choose = (hit: Hit) => {
    if (isChosen(hit)) return;
    setChosen(hit);
    const { family } = hit;
    setStyles(new Set([family.styles.includes('400') ? '400' : (family.styles[0] ?? '400')]));
    const names = scriptsOf(family);
    setSubsets(new Set([names.includes('latin') ? 'latin' : (names[0] ?? 'latin')]));
    setMessage('');
  };
  const toggle = (hit: Hit) => {
    if (isChosen(hit)) {
      setChosen(undefined);
      setMessage('');
    } else choose(hit);
  };
  const optionElement = (index: number) => document.getElementById(`${listId}-option-${index}`);
  const showTip = (hit: Hit, index: number) => {
    const badges = optionElement(index)?.querySelector('.ff-source__badges');
    if (!badges) return;
    const box = badges.getBoundingClientRect();
    setTip({
      text: t.source_tip({ service: sourceName(hit.source), license: hit.family.license }),
      left: box.right,
      top: box.top,
    });
  };
  const handleListKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    const current = activeIndex < 0 ? 0 : activeIndex;
    let index: number | undefined;
    if (event.key === 'ArrowDown') index = Math.min(current + 1, hits.length - 1);
    else if (event.key === 'ArrowUp') index = Math.max(current - 1, 0);
    else if (event.key === 'Home') index = 0;
    else if (event.key === 'End') index = hits.length - 1;
    if (index !== undefined) {
      event.preventDefault();
      setNavigation({ query, index });
      optionElement(index)?.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      const hit = hits[current];
      if (!hit) return;
      event.preventDefault();
      toggle(hit);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setTip(undefined);
      document.getElementById('ff-input-text')?.focus();
    }
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey)
      return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (hits.length === 0) return;
      event.preventDefault();
      const index =
        event.key === 'ArrowDown'
          ? Math.min(activeIndex + 1, hits.length - 1)
          : Math.max(activeIndex < 0 ? 0 : activeIndex - 1, 0);
      setNavigation({ query, index });
      document.getElementById(`${listId}-option-${index}`)?.scrollIntoView({ block: 'nearest' });
    } else if ((event.key === 'Tab' || event.key === 'Enter') && activeIndex >= 0) {
      const hit = hits[activeIndex];
      if (!hit) return;
      if (event.key === 'Enter') {
        if (query.includes('\n')) return;
        if (chosen?.source === hit.source && chosen.family.id === hit.family.id) return;
      } else {
        if (!(event.currentTarget instanceof HTMLTextAreaElement)) return;
        if (!query.trim() || !hit.family.name.toLowerCase().startsWith(query.trim().toLowerCase()))
          return;
        if (hit.family.name.toLowerCase() === query.trim().toLowerCase()) return;
        if (chosen?.source === hit.source && chosen.family.id === hit.family.id) return;
      }
      if (event.key === 'Enter') event.preventDefault();
      choose(hit);
      onAccepted(hit.family.name);
    }
  };
  const count = styles.size * subsets.size;

  const add = async () => {
    if (!chosen || count === 0 || count > slots) return;
    setDownloading(true);
    setMessage(t.source_downloading());
    const wanted = [...styles].flatMap((style) =>
      [...subsets].map(
        (subset): FontOrigin => ({
          source: chosen.source,
          family: chosen.family.id,
          style,
          subset,
        }),
      ),
    );
    const results = await Promise.allSettled(wanted.map((origin) => downloadOrigin(origin)));
    let failure: unknown;
    const files: File[] = [];
    const origins = new Map<File, FontOrigin>();
    results.forEach((result, index) => {
      const origin = wanted[index];
      if (result.status === 'fulfilled' && origin) {
        files.push(result.value);
        origins.set(result.value, origin);
      } else if (result.status === 'rejected') failure ??= result.reason;
    });
    if (files.length > 0) onFiles(files, origins);
    if (results.every((result) => result.status === 'fulfilled')) {
      setMessage(t.source_downloaded({ name: chosen.family.name }));
    } else {
      const code = failure instanceof FontSourceError ? failure.code : 'network';
      setMessage(
        code === 'no-subset'
          ? t.source_error_subset()
          : code === 'too-large' || code === 'bad-file'
            ? t.source_error_file()
            : t.source_error_network(),
      );
    }
    setDownloading(false);
  };

  return {
    onKeyDown: handleKeyDown,
    content: enabled ? (
      <div class="ff-source">
        <div>
          <p class="ff-source__text ff-muted">
            {loading ? t.source_loading() : t.source_list_label()}
          </p>
          {failed && <p class="ff-source__text ff-error">{t.source_error_catalog()}</p>}
          {hits.length > 0 && (
            <p class="ff-sr-only" role="status">
              {query.trim() && activeIndex >= 0
                ? t.source_suggestion({
                    name: hits[activeIndex]?.family.name ?? '',
                    count: hits.length,
                  })
                : t.source_available({ count: hits.length })}
            </p>
          )}
          {!loading && hits.length === 0 && !failed && (
            <p class="ff-source__text ff-muted" role="status">
              {t.source_none()}
            </p>
          )}
        </div>
        {hits.length > 0 ? (
          <ScrollShadow class="ff-source__scroll" tabIndex={0} label={t.source_list_label()}>
            <div
              id={listId}
              role="listbox"
              class="ff-generator__list ff-source__list"
              aria-label={t.source_list_label()}
              onKeyDown={handleListKeyDown}
              onMouseLeave={() => setTip(undefined)}
            >
              {hits.map((hit, index) => (
                // biome-ignore lint/a11y/useKeyWithClickEvents: keys are handled on the listbox
                <div
                  id={`${listId}-option-${index}`}
                  role="option"
                  tabIndex={index === (activeIndex < 0 ? 0 : activeIndex) ? 0 : -1}
                  aria-selected={isChosen(hit)}
                  aria-label={t.source_option_label({
                    name: hit.family.name,
                    service: sourceName(hit.source),
                    license: hit.family.license,
                  })}
                  class={`ff-control ff-generator__item ff-source__item${index === activeIndex ? ' ff-source__item--active' : ''}${isChosen(hit) ? ' ff-source__item--chosen' : ''}`}
                  key={`${hit.source}-${hit.family.id}`}
                  onClick={() => {
                    setNavigation({ query, index });
                    toggle(hit);
                  }}
                  onFocus={() => {
                    setNavigation({ query, index });
                    showTip(hit, index);
                  }}
                  onBlur={() => setTip(undefined)}
                  onMouseEnter={() => showTip(hit, index)}
                >
                  <span>{hit.family.name}</span>
                  <span class="ff-source__badges" aria-hidden="true">
                    <Icon name="license" />
                    <ServiceIcon source={hit.source} />
                  </span>
                </div>
              ))}
            </div>
          </ScrollShadow>
        ) : (
          loading && <div class="ff-source__placeholder" aria-hidden="true" />
        )}
        {tip && (
          <div
            class="ff-source__tip"
            aria-hidden="true"
            style={{ left: `${tip.left}px`, top: `${tip.top}px` }}
          >
            {tip.text}
          </div>
        )}
        {chosen && (
          <div class="ff-source__chosen">
            <p class="ff-source__text">
              <strong>{chosen.family.name}</strong>{' '}
              <a
                class="ff-link"
                href={familyPageUrl(chosen.source, chosen.family)}
                target="_blank"
                rel="noopener noreferrer"
              >
                {sourceName(chosen.source)}
              </a>
            </p>
            <div class="ff-source__groups">
              <fieldset class="ff-toggle-set">
                <legend class="ff-toggle-set__legend">{t.source_style_label()}</legend>
                {[false, true].map((italic) => {
                  const keys = chosen.family.styles.filter(
                    (key) => parseStyle(key).italic === italic,
                  );
                  return keys.length === 0 ? null : (
                    <div class="ff-toggle-group" key={String(italic)}>
                      <span class="ff-muted ff-toggle-group__label">
                        {italic ? t.style_italic() : t.source_upright()}
                      </span>
                      <ToggleGroup
                        key={`${chosen.family.id}-${italic}`}
                        label={italic ? t.style_italic() : t.source_upright()}
                        items={keys.map((key) => ({
                          key,
                          label: String(parseStyle(key).weight),
                          ariaLabel: styleLabel(key),
                        }))}
                        selected={styles}
                        onChange={setStyles}
                      />
                    </div>
                  );
                })}
              </fieldset>
              <fieldset class="ff-toggle-set">
                <legend class="ff-toggle-set__legend">{t.source_subset_label()}</legend>
                {[false, true].map((ext) => {
                  const names = scriptsOf(chosen.family).filter(
                    (name) => name.endsWith('-ext') === ext,
                  );
                  const label = ext ? t.source_subset_ext() : t.source_subset_base();
                  return names.length === 0 ? null : (
                    <div class="ff-toggle-group" key={String(ext)}>
                      <span class="ff-muted ff-toggle-group__label">
                        {label}
                        {ext && (
                          <Popover label={t.source_subset_ext_info()} info>
                            {t.source_subset_ext_hint()}
                          </Popover>
                        )}
                      </span>
                      <ToggleGroup
                        key={`${chosen.family.id}-${ext}`}
                        label={label}
                        items={names.map((name) => ({ key: name, label: name }))}
                        selected={subsets}
                        onChange={setSubsets}
                      />
                    </div>
                  );
                })}
              </fieldset>
            </div>
            <div class="ff-source__add">
              <Button
                variant="primary"
                disabled={busy || downloading || count === 0 || count > slots}
                onClick={() => void add()}
              >
                {count > 1 ? `${t.source_add()} (${count})` : t.source_add()}
              </Button>
              {count > slots && (
                <span class="ff-error">{t.source_too_many({ limit: limit.value, loaded })}</span>
              )}
            </div>
            <div class="ff-source__limit">
              <label class="ff-muted" for={`${listId}-limit`}>
                {t.font_limit_label()}
              </label>
              <input
                id={`${listId}-limit`}
                class="ff-control ff-source__limit-input"
                type="number"
                inputMode="numeric"
                min={limit.min}
                max={limit.max}
                defaultValue={limit.value}
                aria-describedby={count > slots ? `${listId}-limit-hint` : undefined}
                onChange={(event) => {
                  const next = event.currentTarget.valueAsNumber;
                  if (Number.isNaN(next)) return;
                  event.currentTarget.value = String(
                    Math.min(limit.max, Math.max(limit.min, Math.round(next))),
                  );
                  onLimitChange(next);
                }}
              />
              {count > slots && (
                <span class="ff-muted" id={`${listId}-limit-hint`}>
                  {t.font_limit_hint()}
                </span>
              )}
            </div>
            {count > 0 && loaded + count > SOFT_LIMIT && count <= slots && (
              <p class="ff-source__text ff-muted" role="status">
                {t.source_many_warning({
                  total: loaded + count,
                  size: `${Math.round(((averageBytes || GUESS_BYTES) * count) / 1000)} kB`,
                })}
              </p>
            )}
          </div>
        )}
        <p role="status" class="ff-source__text ff-muted">
          {message}
        </p>
      </div>
    ) : null,
  };
}
