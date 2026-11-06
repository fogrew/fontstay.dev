import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, ScrollShadow, ToggleGroup } from '@/common/ui';
import { FontSourceError } from '../lib/download';
import { downloadOrigin, type FontOrigin, SOURCES, type SourceId } from '../lib/origin';
import {
  bestMatchIndex,
  CJK_SUBSETS,
  type FontFamily,
  parseStyle,
  searchFamilies,
} from '../lib/types';

type Catalog =
  | { state: 'loading' }
  | { state: 'ready'; families: FontFamily[] }
  | { state: 'failed' };

interface Hit {
  source: SourceId;
  family: FontFamily;
}

const HITS_PER_SOURCE = 8;
const scriptsOf = (family: FontFamily) => family.subsets.filter((name) => !CJK_SUBSETS.has(name));

export function FamilySearch({
  locale,
  busy,
  query,
  inputRef,
  onAccepted,
  slots,
  onFiles,
}: {
  locale: Locale;
  busy: boolean;
  query: string;
  inputRef: { current: HTMLTextAreaElement | null };
  onAccepted: (name: string) => void;
  slots: number;
  onFiles: (files: File[], origins: ReadonlyMap<File, FontOrigin>) => void;
}) {
  const t = messagesFor(locale);
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
    const result: Hit[] = [];
    for (const id of Object.keys(SOURCES) as SourceId[]) {
      const catalog = catalogs[id];
      if (catalog?.state !== 'ready') continue;
      for (const family of searchFamilies(catalog.families, query, '', HITS_PER_SOURCE)) {
        result.push({ source: id, family });
      }
    }
    return result.sort((a, b) => a.family.name.localeCompare(b.family.name));
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

  const choose = (hit: Hit) => {
    setChosen(hit);
    const { family } = hit;
    setStyles(new Set([family.styles.includes('400') ? '400' : (family.styles[0] ?? '400')]));
    const names = scriptsOf(family);
    setSubsets(new Set([names.includes('latin') ? 'latin' : (names[0] ?? 'latin')]));
    setMessage('');
  };
  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    if (hits.length > 0) field.setAttribute('aria-controls', 'ff-source-list');
    else field.removeAttribute('aria-controls');
    if (activeIndex >= 0) {
      field.setAttribute('aria-activedescendant', `ff-source-option-${activeIndex}`);
    } else {
      field.removeAttribute('aria-activedescendant');
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (hits.length === 0) return;
        event.preventDefault();
        const index =
          event.key === 'ArrowDown'
            ? Math.min(activeIndex + 1, hits.length - 1)
            : Math.max(activeIndex < 0 ? 0 : activeIndex - 1, 0);
        setNavigation({ query, index });
        document.getElementById(`ff-source-option-${index}`)?.scrollIntoView({ block: 'nearest' });
      } else if ((event.key === 'Tab' || event.key === 'Enter') && activeIndex >= 0) {
        const hit = hits[activeIndex];
        if (!hit) return;
        if (event.key === 'Enter') event.preventDefault();
        choose(hit);
        onAccepted(hit.family.name);
      }
    };
    field.addEventListener('keydown', handleKeyDown);
    return () => {
      field.removeEventListener('keydown', handleKeyDown);
      field.removeAttribute('aria-controls');
      field.removeAttribute('aria-activedescendant');
    };
  }, [hits, activeIndex, query, inputRef, onAccepted]);
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

  return (
    <div class="ff-source">
      <div role="status">
        <p class="ff-source__text ff-muted">
          {loading ? t.source_loading() : t.source_list_label()}
        </p>
        {failed && <p class="ff-source__text ff-error">{t.source_error_catalog()}</p>}
        {hits.length > 0 && (
          <p class="ff-sr-only">
            {query.trim() && activeIndex >= 0
              ? t.source_suggestion({
                  name: hits[activeIndex]?.family.name ?? '',
                  count: hits.length,
                })
              : t.source_available({ count: hits.length })}
          </p>
        )}
        {!loading && hits.length === 0 && !failed && (
          <p class="ff-source__text ff-muted">{t.source_none()}</p>
        )}
      </div>
      {hits.length > 0 ? (
        <ScrollShadow class="ff-source__scroll">
          <div
            id="ff-source-list"
            role="listbox"
            class="ff-generator__list ff-source__list"
            aria-label={t.source_list_label()}
          >
            {hits.map((hit, index) => (
              <div
                id={`ff-source-option-${index}`}
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                class="ff-control ff-generator__item ff-source__item"
                key={`${hit.source}-${hit.family.id}`}
                onClick={() => {
                  setNavigation({ query, index });
                  choose(hit);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setNavigation({ query, index });
                    choose(hit);
                  }
                }}
              >
                <span>{hit.family.name}</span>
                <span class="ff-muted">{sourceName(hit.source)}</span>
              </div>
            ))}
          </div>
        </ScrollShadow>
      ) : (
        loading && <div class="ff-source__placeholder" aria-hidden="true" />
      )}
      {chosen && (
        <div class="ff-source__chosen">
          <p class="ff-source__text">
            <strong>{chosen.family.name}</strong>{' '}
            <span class="ff-muted">{sourceName(chosen.source)}</span>
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
              <ToggleGroup
                key={chosen.family.id}
                label={t.source_subset_label()}
                items={scriptsOf(chosen.family).map((name) => ({ key: name, label: name }))}
                selected={subsets}
                onChange={setSubsets}
              />
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
            {count > slots && <span class="ff-error">{t.source_too_many({ max: slots })}</span>}
          </div>
        </div>
      )}
      <p role="status" class="ff-source__text ff-muted">
        {message}
      </p>
      <p class="ff-source__text ff-muted">
        {t.source_browse()}{' '}
        <a
          class="ff-link"
          href="https://fonts.google.com/"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.source_name_google()}
        </a>
        {', '}
        <a
          class="ff-link"
          href="https://fontsource.org/fonts"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t.source_name_fontsource()}
        </a>
      </p>
      <p class="ff-source__text ff-muted">{t.source_note()}</p>
    </div>
  );
}
