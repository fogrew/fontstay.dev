import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Disclosure, Select } from '@/common/ui';
import {
  CJK_SUBSETS,
  downloadFont,
  type GoogleFamily,
  GoogleFontsError,
  loadCatalog,
  parseStyle,
  searchFamilies,
} from '../lib/google-fonts';

type State =
  | { state: 'idle' }
  | { state: 'loading-catalog' }
  | { state: 'ready'; families: GoogleFamily[] }
  | { state: 'failed' };

const CATEGORIES = ['Sans Serif', 'Serif', 'Monospace', 'Display', 'Handwriting'] as const;

export function GoogleFontsPicker({
  locale,
  busy,
  onFile,
}: {
  locale: Locale;
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const t = messagesFor(locale);
  const [opened, setOpened] = useState(false);
  const [catalog, setCatalog] = useState<State>({ state: 'idle' });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [chosen, setChosen] = useState<GoogleFamily>();
  const [style, setStyle] = useState('400');
  const [subset, setSubset] = useState('latin');
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!opened || catalog.state !== 'idle') return;
    setCatalog({ state: 'loading-catalog' });
    loadCatalog().then(
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
    return name === 'Display' ? t.google_category_display() : t.google_category_handwriting();
  };
  const styleLabel = (key: string) => {
    const { weight, italic } = parseStyle(key);
    return italic ? `${weight} ${t.style_italic()}` : String(weight);
  };

  const choose = (family: GoogleFamily) => {
    setChosen(family);
    setStyle(family.styles.includes('400') ? '400' : (family.styles[0] ?? '400'));
    const subsets = family.subsets.filter((name) => !CJK_SUBSETS.has(name));
    setSubset(subsets.includes('latin') ? 'latin' : (subsets[0] ?? 'latin'));
    setMessage('');
  };

  const add = async () => {
    if (!chosen) return;
    setDownloading(true);
    setMessage(t.google_downloading());
    try {
      onFile(await downloadFont(chosen.name, style, subset));
      setMessage(t.google_downloaded({ name: chosen.name }));
    } catch (failure) {
      const code = failure instanceof GoogleFontsError ? failure.code : 'network';
      setMessage(
        code === 'no-subset'
          ? t.google_error_subset()
          : code === 'too-large' || code === 'bad-file'
            ? t.google_error_file()
            : t.google_error_network(),
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Disclosure summary={t.google_heading()} onToggle={(open) => open && setOpened(true)}>
      <div class="ff-google">
        <p class="ff-muted">{t.google_note()}</p>
        <div class="ff-field">
          <label for="ff-google-search">{t.google_search_label()}</label>
          <input
            id="ff-google-search"
            class="ff-input"
            type="search"
            autocomplete="off"
            spellcheck={false}
            value={query}
            onInput={(event) => setQuery(event.currentTarget.value)}
          />
        </div>
        <Select
          label={t.google_category_label()}
          value={category}
          options={[
            { value: '', label: t.google_category_all() },
            ...CATEGORIES.map((name) => ({ value: name, label: categoryLabel(name) })),
          ]}
          onChange={setCategory}
        />
        <div role="status">
          {catalog.state === 'loading-catalog' && <p class="ff-muted">{t.google_loading()}</p>}
          {catalog.state === 'failed' && <p class="ff-error">{t.google_error_catalog()}</p>}
          {catalog.state === 'ready' && (
            <p class="ff-muted">{t.google_results({ count: results.length })}</p>
          )}
        </div>
        {results.length > 0 && (
          <ul class="ff-google__list" aria-label={t.google_list_label()}>
            {results.map((family) => (
              <li key={family.name}>
                <button
                  type="button"
                  class="ff-google__item"
                  aria-pressed={chosen?.name === family.name}
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
          <div class="ff-google__chosen">
            <p>
              <strong>{chosen.name}</strong>
            </p>
            <Select
              label={t.google_style_label()}
              value={style}
              options={chosen.styles.map((key) => ({ value: key, label: styleLabel(key) }))}
              onChange={setStyle}
            />
            <Select
              label={t.google_subset_label()}
              value={subset}
              options={chosen.subsets
                .filter((name) => !CJK_SUBSETS.has(name))
                .map((name) => ({ value: name, label: name }))}
              onChange={setSubset}
            />
            <Button variant="primary" disabled={busy || downloading} onClick={() => void add()}>
              {t.google_add()}
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
