import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, ScrollShadow, ToggleGroup } from '@/common/ui';
import { FontSourceError } from '../lib/download';
import { downloadOrigin, type FontOrigin, SOURCES, type SourceId } from '../lib/origin';
import { CJK_SUBSETS, type FontFamily, parseStyle, searchFamilies } from '../lib/types';

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
  slots,
  onFiles,
}: {
  locale: Locale;
  busy: boolean;
  query: string;
  slots: number;
  onFiles: (files: File[], origins: ReadonlyMap<File, FontOrigin>) => void;
}) {
  const t = messagesFor(locale);
  const [catalogs, setCatalogs] = useState<Partial<Record<SourceId, Catalog>>>({});
  const [chosen, setChosen] = useState<Hit>();
  const [styles, setStyles] = useState<ReadonlySet<string>>(new Set(['400']));
  const [subsets, setSubsets] = useState<ReadonlySet<string>>(new Set(['latin']));
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    for (const id of Object.keys(SOURCES) as SourceId[]) {
      if (catalogs[id]) continue;
      setCatalogs((current) => ({ ...current, [id]: { state: 'loading' } }));
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
        {loading && <p class="ff-muted">{t.source_loading()}</p>}
        {failed && <p class="ff-error">{t.source_error_catalog()}</p>}
        {!loading && hits.length === 0 && !failed && <p class="ff-muted">{t.source_none()}</p>}
      </div>
      {hits.length > 0 && (
        <ScrollShadow class="ff-source__scroll">
          <ul class="ff-source__list" aria-label={t.source_list_label()}>
            {hits.map((hit) => (
              <li key={`${hit.source}-${hit.family.id}`}>
                <button
                  type="button"
                  class="ff-source__item"
                  aria-pressed={chosen?.source === hit.source && chosen.family.id === hit.family.id}
                  onClick={() => choose(hit)}
                >
                  <span>{hit.family.name}</span>
                  <span class="ff-muted">{sourceName(hit.source)}</span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollShadow>
      )}
      {chosen && (
        <div class="ff-source__chosen">
          <p>
            <strong>{chosen.family.name}</strong>{' '}
            <span class="ff-muted">{sourceName(chosen.source)}</span>
          </p>
          <div class="ff-source__groups">
            <fieldset class="ff-toggle-set">
              <legend>{t.source_style_label()}</legend>
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
              <legend>{t.source_subset_label()}</legend>
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
      <p role="status" class="ff-muted">
        {message}
      </p>
      <p class="ff-muted">
        {t.source_browse()}{' '}
        <a href="https://fonts.google.com/" target="_blank" rel="noopener noreferrer">
          {t.source_name_google()}
        </a>
        {', '}
        <a href="https://fontsource.org/fonts" target="_blank" rel="noopener noreferrer">
          {t.source_name_fontsource()}
        </a>
      </p>
      <p class="ff-muted">{t.source_note()}</p>
    </div>
  );
}
