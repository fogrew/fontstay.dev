import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Disclosure, Select } from '@/common/ui';
import { FontSourceError } from '../lib/download';
import { CJK_SUBSETS, type FontFamily, parseStyle, searchFamilies } from '../lib/types';

type State =
  | { state: 'idle' }
  | { state: 'loading-catalog' }
  | { state: 'ready'; families: FontFamily[] }
  | { state: 'failed' };

export interface FontSource {
  id: string;
  icon: ComponentChildren;
  heading: string;
  note: string;
  listLabel: string;
  categories: readonly string[];
  loadCatalog: () => Promise<FontFamily[]>;
  download: (family: FontFamily, style: string, subset: string) => Promise<File>;
}

export function SourcePicker({
  locale,
  busy,
  source,
  onFile,
}: {
  locale: Locale;
  busy: boolean;
  source: FontSource;
  onFile: (file: File) => void;
}) {
  const t = messagesFor(locale);
  const [opened, setOpened] = useState(false);
  const [catalog, setCatalog] = useState<State>({ state: 'idle' });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [chosen, setChosen] = useState<FontFamily>();
  const [style, setStyle] = useState('400');
  const [subset, setSubset] = useState('latin');
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!opened || catalog.state !== 'idle') return;
    setCatalog({ state: 'loading-catalog' });
    source.loadCatalog().then(
      (families) => setCatalog({ state: 'ready', families }),
      () => setCatalog({ state: 'failed' }),
    );
  }, [opened, catalog.state]);

  const results = useMemo(
    () => (catalog.state === 'ready' ? searchFamilies(catalog.families, query, category) : []),
    [catalog, query, category],
  );

  const categoryLabel = (name: string) => {
    if (name === 'Serif') return t.type_serif();
    if (name === 'Monospace') return t.type_mono();
    if (name === 'Sans Serif') return t.type_sans();
    if (name === 'Display') return t.source_category_display();
    return name === 'Other' ? t.source_category_other() : t.source_category_handwriting();
  };
  const styleLabel = (key: string) => {
    const { weight, italic } = parseStyle(key);
    return italic ? `${weight} ${t.style_italic()}` : String(weight);
  };

  const choose = (family: FontFamily) => {
    setChosen(family);
    setStyle(family.styles.includes('400') ? '400' : (family.styles[0] ?? '400'));
    const subsets = family.subsets.filter((name) => !CJK_SUBSETS.has(name));
    setSubset(subsets.includes('latin') ? 'latin' : (subsets[0] ?? 'latin'));
    setMessage('');
  };

  const add = async () => {
    if (!chosen) return;
    setDownloading(true);
    setMessage(t.source_downloading());
    try {
      onFile(await source.download(chosen, style, subset));
      setMessage(t.source_downloaded({ name: chosen.name }));
    } catch (failure) {
      const code = failure instanceof FontSourceError ? failure.code : 'network';
      setMessage(
        code === 'no-subset'
          ? t.source_error_subset()
          : code === 'too-large' || code === 'bad-file'
            ? t.source_error_file()
            : t.source_error_network(),
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Disclosure icon={source.icon} summary={source.heading} open onVisible={() => setOpened(true)}>
      <div class="ff-source">
        <p class="ff-muted">{source.note}</p>
        <div class="ff-field">
          <label for={`ff-${source.id}-search`}>{t.source_search_label()}</label>
          <input
            id={`ff-${source.id}-search`}
            class="ff-input"
            type="search"
            autocomplete="off"
            spellcheck={false}
            value={query}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
        <Select
          label={t.source_category_label()}
          value={category}
          options={[
            { value: '', label: t.source_category_all() },
            ...source.categories.map((name) => ({ value: name, label: categoryLabel(name) })),
          ]}
          onChange={setCategory}
        />
        <div role="status">
          {catalog.state === 'loading-catalog' && <p class="ff-muted">{t.source_loading()}</p>}
          {catalog.state === 'failed' && <p class="ff-error">{t.source_error_catalog()}</p>}
          {catalog.state === 'ready' && (
            <p class="ff-muted">{t.source_results({ count: results.length })}</p>
          )}
        </div>
        {results.length > 0 && (
          <ul class="ff-source__list" aria-label={source.listLabel}>
            {results.map((family) => (
              <li key={family.id}>
                <button
                  type="button"
                  class="ff-source__item"
                  aria-pressed={chosen?.id === family.id}
                  onClick={() => choose(family)}
                >
                  <span>{family.name}</span>
                  <span class="ff-muted">{categoryLabel(family.category)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {chosen && (
          <div class="ff-source__chosen">
            <p>
              <strong>{chosen.name}</strong>
            </p>
            <Select
              label={t.source_style_label()}
              value={style}
              options={chosen.styles.map((key) => ({ value: key, label: styleLabel(key) }))}
              onChange={setStyle}
            />
            <Select
              label={t.source_subset_label()}
              value={subset}
              options={chosen.subsets
                .filter((name) => !CJK_SUBSETS.has(name))
                .map((name) => ({ value: name, label: name }))}
              onChange={setSubset}
            />
            <Button variant="primary" disabled={busy || downloading} onClick={() => void add()}>
              {t.source_add()}
            </Button>
          </div>
        )}
        <p role="status" class="ff-muted">
          {message}
        </p>
      </div>
    </Disclosure>
  );
}
