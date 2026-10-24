import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Select } from '@/common/ui';
import { FontSourceError } from '../lib/download';
import * as fontsource from '../lib/fontsource';
import * as google from '../lib/google';
import { CJK_SUBSETS, type FontFamily, parseStyle, searchFamilies } from '../lib/types';

type SourceId = 'google' | 'fontsource';
type Catalog =
  | { state: 'loading' }
  | { state: 'ready'; families: FontFamily[] }
  | { state: 'failed' };

interface Hit {
  source: SourceId;
  family: FontFamily;
}

const SOURCES: Record<
  SourceId,
  {
    loadCatalog: () => Promise<FontFamily[]>;
    download: (family: FontFamily, style: string, subset: string) => Promise<File>;
  }
> = {
  google: {
    loadCatalog: google.loadCatalog,
    download: (family, style, subset) => google.downloadFont(family.name, style, subset),
  },
  fontsource: { loadCatalog: fontsource.loadCatalog, download: fontsource.downloadFont },
};
const HITS_PER_SOURCE = 8;

export function FamilySearch({
  locale,
  busy,
  query,
  onFile,
}: {
  locale: Locale;
  busy: boolean;
  query: string;
  onFile: (file: File) => void;
}) {
  const t = messagesFor(locale);
  const [catalogs, setCatalogs] = useState<Partial<Record<SourceId, Catalog>>>({});
  const [chosen, setChosen] = useState<Hit>();
  const [style, setStyle] = useState('400');
  const [subset, setSubset] = useState('latin');
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
      onFile(await SOURCES[chosen.source].download(chosen.family, style, subset));
      setMessage(t.source_downloaded({ name: chosen.family.name }));
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
    <div class="ff-source">
      <div role="status">
        {loading && <p class="ff-muted">{t.source_loading()}</p>}
        {failed && <p class="ff-error">{t.source_error_catalog()}</p>}
        {!loading && hits.length === 0 && !failed && <p class="ff-muted">{t.source_none()}</p>}
      </div>
      {hits.length > 0 && (
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
      )}
      {chosen && (
        <div class="ff-source__chosen">
          <p>
            <strong>{chosen.family.name}</strong>{' '}
            <span class="ff-muted">{sourceName(chosen.source)}</span>
          </p>
          <Select
            label={t.source_style_label()}
            value={style}
            options={chosen.family.styles.map((key) => ({ value: key, label: styleLabel(key) }))}
            onChange={setStyle}
          />
          <Select
            label={t.source_subset_label()}
            value={subset}
            options={chosen.family.subsets
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
      <p class="ff-muted">{t.source_note()}</p>
    </div>
  );
}
