import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';
import { type FontOrigin, ServiceLink, useFamilySearch } from '@/modules/font-sources';
import type { SiteImport } from '@/modules/import-receiver';
import { readClipboardImport, SiteImportPanel, SplitWarnings } from '@/modules/site-import';
import { classifyInput } from '../lib/classify-input';
import { displayName } from '../lib/compute';
import {
  type ImportedFace,
  MAX_CSS_CHARS,
  type Pick,
  parseFaceRules,
  parseFontFaces,
  parseGoogleFontsLinks,
  pickSource,
} from '../lib/css-import';

const LINK_TOKENS = /(\{google\}|\{fontsource\})/;

interface Entry {
  face: ImportedFace;
  pick: Pick;
}

const EXTENSIONS: Record<string, string> = {
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/sfnt': 'ttf',
  'application/font-woff': 'woff',
  'application/x-font-ttf': 'ttf',
  'application/x-font-opentype': 'otf',
};
const isStyleFile = (file: File) => /\.css$/i.test(file.name) || file.type === 'text/css';

function fileOf(entry: Entry, index: number): File | null {
  if (entry.pick.kind !== 'data') return null;
  const { face, pick } = entry;
  const base = face.family.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'font';
  const extension = EXTENSIONS[pick.font.mime] ?? 'woff2';
  const name = `${base}-${face.weight.replace(/\W+/g, '')}-${face.style.replace(/\W+/g, '')}-${index + 1}.${extension}`;
  return new File([pick.font.bytes], name, { type: pick.font.mime });
}

export function FontInput({
  locale,
  busy,
  compact,
  slots,
  limit,
  loaded,
  averageBytes,
  onLimitChange,
  dragging,
  dropped,
  onFiles,
  onImport,
}: {
  locale: Locale;
  busy: boolean;
  compact: boolean;
  slots: number;
  limit: { value: number; min: number; max: number };
  loaded: number;
  averageBytes: number;
  onLimitChange: (value: number) => void;
  dragging: boolean;
  dropped?: { id: number; files: File[] } | undefined;
  onFiles: (files: File[], origins?: ReadonlyMap<File, FontOrigin>) => void;
  onImport: (value: SiteImport) => void;
}) {
  const t = messagesFor(locale);
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [site, setSite] = useState(false);
  const [importError, setImportError] = useState(false);
  const [oversized, setOversized] = useState(false);
  const kind = classifyInput(text);
  const searching = kind === 'empty' || kind === 'name';
  const familySearch = useFamilySearch({
    locale,
    busy,
    query: text,
    enabled: searching,
    onAccepted: setText,
    slots,
    limit,
    loaded,
    averageBytes,
    onLimitChange,
    onFiles,
  });

  const css = useMemo(() => {
    if (kind !== 'css') return undefined;
    if (oversized || text.length > MAX_CSS_CHARS)
      return { entries: [], google: [], rules: [], tooLarge: true };
    const entries = parseFontFaces(text).map((face) => ({ face, pick: pickSource(face) }));
    return {
      entries,
      google: parseGoogleFontsLinks(text),
      rules: parseFaceRules(text),
      tooLarge: false,
    };
  }, [kind, text, oversized]);

  useEffect(() => {
    if (kind !== 'import') {
      setImportError(false);
      return;
    }
    let current = true;
    void readClipboardImport(text).then((value) => {
      if (!current) return;
      if (value) {
        setText('');
        onImport(value);
      } else {
        setImportError(true);
      }
    });
    return () => {
      current = false;
    };
  }, [kind, text]);

  const readStyles = async (files: File[]) => {
    const tooLarge = files.reduce((sum, file) => sum + file.size, 0) > MAX_CSS_CHARS * 4;
    setOversized(tooLarge);
    if (tooLarge) {
      setText('@font-face');
      return;
    }
    setText((await Promise.all(files.map((file) => file.text()))).join('\n'));
  };
  const take = (files: File[]) => {
    const styles = files.filter(isStyleFile);
    const fonts = files.filter((file) => !isStyleFile(file));
    if (fonts.length > 0) onFiles(fonts);
    if (styles.length > 0) void readStyles(styles);
  };
  useEffect(() => {
    if (dropped) void readStyles(dropped.files);
  }, [dropped?.id]);

  const empty = css && !css.tooLarge && css.entries.length === 0 && css.google.length === 0;

  return (
    <section class="ff-drop" data-over={dragging} aria-labelledby="ff-input-heading">
      <h2 class="ff-generator__heading ff-heading" id="ff-input-heading">
        {t.input_heading()}
      </h2>
      <div class="ff-field">
        <label for="ff-input-text">{t.input_label()}</label>
        <textarea
          id="ff-input-text"
          class="ff-input ff-drop__text"
          rows={2}
          spellcheck={false}
          autocomplete="off"
          aria-describedby="ff-input-hint"
          placeholder={t.input_placeholder()}
          value={text}
          onInput={(event) => {
            setOversized(false);
            setText(event.currentTarget.value);
          }}
          onKeyDown={searching ? familySearch.onKeyDown : undefined}
        />
        <div id="ff-input-hint" class="ff-drop__paragraph ff-muted ff-drop__hint">
          <p class="ff-drop__hint-line">{t.input_hint()}</p>
          <ul class="ff-drop__hint-list">
            <li>{t.input_hint_name()}</li>
            <li>
              {t
                .input_hint_link({ google: '{google}', fontsource: '{fontsource}' })
                .split(LINK_TOKENS)
                .map((part) =>
                  part === '{google}' ? (
                    <ServiceLink source="google" key={part}>
                      {t.source_name_google()}
                    </ServiceLink>
                  ) : part === '{fontsource}' ? (
                    <ServiceLink source="fontsource" key={part}>
                      {t.source_name_fontsource()}
                    </ServiceLink>
                  ) : (
                    part
                  ),
                )}
            </li>
            <li>{t.input_hint_drop()}</li>
            <li>{t.input_hint_css()}</li>
          </ul>
          {searching && <p class="ff-drop__hint-line">{t.source_keyboard_hint()}</p>}
        </div>
      </div>
      {familySearch.content}
      <p class="ff-drop__paragraph ff-drop__links">
        <button
          type="button"
          class="ff-control ff-link-button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {t.input_choose()}
        </button>
        <button
          type="button"
          class="ff-control ff-link-button"
          aria-expanded={site}
          onClick={() => setSite(!site)}
        >
          {t.input_site()}
        </button>
      </p>
      <input
        class="ff-control"
        ref={input}
        hidden
        type="file"
        multiple
        accept=".woff2,.woff,.ttf,.otf,.ttc,.otc,.css,font/woff2,font/woff,font/ttf,font/otf,font/collection,text/css"
        onChange={(event) => {
          take([...(event.currentTarget.files ?? [])]);
          event.currentTarget.value = '';
        }}
      />
      {site && <SiteImportPanel locale={locale} />}
      {!compact && <p class="ff-drop__paragraph ff-muted">{t.upload_local()}</p>}
      <div role="status">
        {importError && <p class="ff-drop__paragraph ff-error">{t.import_paste_error()}</p>}
        {css?.tooLarge && <p class="ff-drop__paragraph ff-error">{t.cssimport_too_large()}</p>}
        {empty && <p class="ff-drop__paragraph ff-error">{t.cssimport_none()}</p>}
      </div>
      {css && css.rules.length > 1 && <SplitWarnings locale={locale} rules={css.rules} />}
      {css && css.entries.length > 0 && (
        <ul class="ff-generator__list ff-cssimport__list" aria-label={t.cssimport_faces()}>
          {css.entries.map((entry, index) => {
            const { face, pick } = entry;
            return (
              <li class="ff-generator__item" key={`${face.family}-${index}`}>
                <span>
                  {`${displayName(face.family)} · ${face.weight} · ${face.style}`}
                  {face.skipped > 0 && (
                    <span class="ff-muted">{` · ${t.cssimport_skipped({ count: face.skipped })}`}</span>
                  )}
                </span>
                {pick.kind === 'data' && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      const file = fileOf(entry, index);
                      if (file) onFiles([file]);
                    }}
                  >
                    {t.cssimport_add()}
                  </Button>
                )}
                {pick.kind === 'link' && (
                  <span>
                    <a
                      class="ff-link"
                      href={pick.url.toString()}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t.cssimport_download()}
                    </a>{' '}
                    <span class="ff-muted">({pick.url.hostname})</span>
                  </span>
                )}
                {pick.kind === 'none' && <span class="ff-muted">{t.cssimport_unsupported()}</span>}
              </li>
            );
          })}
        </ul>
      )}
      {css && css.google.length > 0 && (
        <ul class="ff-generator__list ff-cssimport__list" aria-label={t.cssimport_google()}>
          {css.google.map((family) => (
            <li class="ff-generator__item" key={`${family.name}-${family.styles}`}>
              <span>{displayName(family.name)}</span>
              <a
                class="ff-link"
                href={`https://fonts.google.com/specimen/${encodeURIComponent(family.name.replace(/ /g, '+'))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.cssimport_open_google()}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
