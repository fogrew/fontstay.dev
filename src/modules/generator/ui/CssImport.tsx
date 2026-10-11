import { useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Disclosure } from '@/common/ui';
import {
  decodeDataUrl,
  type GoogleFamily,
  type ImportedFace,
  MAX_CSS_BYTES,
  parseFontFaces,
  parseGoogleFontsLinks,
  safeHttpsUrl,
} from '../lib/css-import';

interface Result {
  faces: ImportedFace[];
  google: GoogleFamily[];
}

function fileNameOf(face: ImportedFace): string {
  const base = face.family.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'font';
  return `${base}-${face.weight.replace(/\W+/g, '')}-${face.style.replace(/\W+/g, '')}.woff2`;
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
    setResult({ faces: parseFontFaces(text), google: parseGoogleFontsLinks(text) });
  };
  const empty = result && result.faces.length === 0 && result.google.length === 0;

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
            maxLength={MAX_CSS_BYTES}
            value={text}
            onInput={(event) => setText(event.currentTarget.value)}
          />
        </div>
        <Button disabled={text.trim() === ''} onClick={read}>
          {t.cssimport_read()}
        </Button>
        <div role="status">
          {empty && <p class="ff-error">{t.cssimport_none()}</p>}
          {result && result.faces.length > 0 && (
            <ul class="ff-cssimport__list" aria-label={t.cssimport_faces()}>
              {result.faces.map((face, index) => {
                const source = face.sources[0];
                const data = source ? decodeDataUrl(source.url) : null;
                const link = source ? safeHttpsUrl(source.url) : null;
                return (
                  <li key={`${face.family}-${index}`}>
                    <span>{`${face.family} · ${face.weight} · ${face.style}`}</span>
                    {data ? (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          onFiles([new File([data], fileNameOf(face), { type: 'font/woff2' })])
                        }
                      >
                        {t.cssimport_add()}
                      </Button>
                    ) : link ? (
                      <a href={link} target="_blank" rel="noopener noreferrer">
                        {t.cssimport_download()}
                      </a>
                    ) : (
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
                  <span>{family.name}</span>
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
