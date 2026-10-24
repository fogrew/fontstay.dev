import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';
import { FamilySearch, type FontOrigin } from '@/modules/font-sources';
import type { SiteImport } from '@/modules/import-receiver';
import { readClipboardImport, SiteImportPanel } from '@/modules/site-import';
import { classifyInput } from '../lib/classify-input';
import { displayName } from '../lib/compute';
import {
  type ImportedFace,
  MAX_CSS_CHARS,
  type Pick,
  parseFontFaces,
  parseGoogleFontsLinks,
  pickSource,
} from '../lib/css-import';

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
  dragging,
  dropped,
  onFiles,
  onImport,
}: {
  locale: Locale;
  busy: boolean;
  compact: boolean;
  dragging: boolean;
  dropped?: { id: number; files: File[] } | undefined;
  onFiles: (files: File[], origin?: FontOrigin) => void;
  onImport: (value: SiteImport) => void;
}) {
  const t = messagesFor(locale);
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [site, setSite] = useState(false);
  const [importError, setImportError] = useState(false);
  const [oversized, setOversized] = useState(false);
  const kind = classifyInput(text);

  const css = useMemo(() => {
    if (kind !== 'css') return undefined;
    if (oversized || text.length > MAX_CSS_CHARS)
      return { entries: [], google: [], tooLarge: true };
    const entries = parseFontFaces(text).map((face) => ({ face, pick: pickSource(face) }));
    return { entries, google: parseGoogleFontsLinks(text), tooLarge: false };
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
      <h2 id="ff-input-heading">{t.input_heading()}</h2>
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
        />
        <p id="ff-input-hint" class="ff-muted ff-drop__hint">
          {t.input_hint()} {t.input_formats()}
        </p>
      </div>
      <p class="ff-drop__links">
        <button
          type="button"
          class="ff-link-button"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {t.input_choose()}
        </button>
        <button
          type="button"
          class="ff-link-button"
          aria-expanded={site}
          onClick={() => setSite(!site)}
        >
          {t.input_site()}
        </button>
      </p>
      <input
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
      {!compact && <p class="ff-muted">{t.upload_local()}</p>}
      {kind === 'name' && (
        <FamilySearch
          locale={locale}
          busy={busy}
          query={text}
          onFile={(file, origin) => onFiles([file], origin)}
        />
      )}
      <div role="status">
        {importError && <p class="ff-error">{t.import_paste_error()}</p>}
        {css?.tooLarge && <p class="ff-error">{t.cssimport_too_large()}</p>}
        {empty && <p class="ff-error">{t.cssimport_none()}</p>}
      </div>
      {css && css.entries.length > 0 && (
        <ul class="ff-cssimport__list" aria-label={t.cssimport_faces()}>
          {css.entries.map((entry, index) => {
            const { face, pick } = entry;
            return (
              <li key={`${face.family}-${index}`}>
                <span>{`${displayName(face.family)} · ${face.weight} · ${face.style}`}</span>
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
                    <a href={pick.url.toString()} target="_blank" rel="noopener noreferrer">
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
        <ul class="ff-cssimport__list" aria-label={t.cssimport_google()}>
          {css.google.map((family) => (
            <li key={`${family.name}-${family.styles}`}>
              <span>{displayName(family.name)}</span>
              <a
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
