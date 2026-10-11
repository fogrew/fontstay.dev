import { useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Disclosure } from '@/common/ui';
import { displayName } from '../lib/compute';
import {
  type GoogleFamily,
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

interface Result {
  entries: Entry[];
  google: GoogleFamily[];
  tooLarge: boolean;
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

function fileOf(entry: Entry, index: number): File | null {
  if (entry.pick.kind !== 'data') return null;
  const { face, pick } = entry;
  const base = face.family.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'font';
  const extension = EXTENSIONS[pick.font.mime] ?? 'woff2';
  const name = `${base}-${face.weight.replace(/\W+/g, '')}-${face.style.replace(/\W+/g, '')}-${index + 1}.${extension}`;
  return new File([pick.font.bytes], name, { type: pick.font.mime });
}

export function CssImport({
  locale,
  busy,
  onFiles,
}: {
  locale: Locale;
  busy: boolean;
  onFiles: (files: File[]) => void;
}) {
  const t = messagesFor(locale);
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result>();

  const read = () => {
    if (text.length > MAX_CSS_CHARS) {
      setResult({ entries: [], google: [], tooLarge: true });
      return;
    }
    const entries = parseFontFaces(text).map((face) => ({ face, pick: pickSource(face) }));
    setResult({ entries, google: parseGoogleFontsLinks(text), tooLarge: false });
  };
  const empty =
    result && !result.tooLarge && result.entries.length === 0 && result.google.length === 0;

  return (
    <Disclosure summary={t.cssimport_heading()}>
      <div class="ff-cssimport">
        <p class="ff-muted">{t.cssimport_note()}</p>
        <div class="ff-field">
          <label for="ff-cssimport-text">{t.cssimport_label()}</label>
          <textarea
            id="ff-cssimport-text"
            class="ff-input"
            rows={5}
            spellcheck={false}
            value={text}
            onInput={(event) => setText(event.currentTarget.value)}
          />
        </div>
        <Button disabled={text.trim() === ''} onClick={read}>
          {t.cssimport_read()}
        </Button>
        <div role="status">
          {result?.tooLarge && <p class="ff-error">{t.cssimport_too_large()}</p>}
          {empty && <p class="ff-error">{t.cssimport_none()}</p>}
          {result && result.entries.length > 0 && (
            <ul class="ff-cssimport__list" aria-label={t.cssimport_faces()}>
              {result.entries.map((entry, index) => {
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
                    {pick.kind === 'none' && (
                      <span class="ff-muted">{t.cssimport_unsupported()}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {result && result.google.length > 0 && (
            <ul class="ff-cssimport__list" aria-label={t.cssimport_google()}>
              {result.google.map((family) => (
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
        </div>
      </div>
    </Disclosure>
  );
}
