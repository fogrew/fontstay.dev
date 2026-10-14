import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';
import type { SiteImport } from '../lib/payload';

export function ImportConfirm({
  locale,
  value,
  onAccept,
  onDiscard,
}: {
  locale: Locale;
  value: SiteImport;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  const t = messagesFor(locale);
  const title = t.import_confirm_title({ origin: value.origin });
  const missing = value.faces.filter((face) => face.url).slice(0, 12);
  return (
    <section class="ff-site-import__confirm" aria-label={title}>
      <h3 class="ff-site-import__line">{title}</h3>
      <p class="ff-site-import__line">
        {t.import_confirm_summary({
          files: value.files.length,
          faces: value.faces.length,
          samples: value.samples.length,
        })}
      </p>
      <p class={`ff-site-import__line ${value.verified ? 'ff-muted' : 'ff-error'}`}>
        {value.verified ? t.import_verified() : t.import_unverified()}
      </p>
      {value.files.length === 0 && missing.length > 0 && (
        <>
          <p class="ff-muted ff-site-import__line">{t.import_faces_missing()}</p>
          <ul>
            {missing.map((face) => (
              <li key={`${face.family}-${face.weight}-${face.style}-${face.url}`}>
                {face.family} {face.weight} {face.style}{' '}
                <a href={face.url} rel="noopener noreferrer" target="_blank">
                  {t.cssimport_download()}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p class="ff-site-import__actions ff-site-import__line">
        <Button variant="primary" onClick={onAccept}>
          {t.import_accept()}
        </Button>
        <Button variant="secondary" onClick={onDiscard}>
          {t.import_discard()}
        </Button>
      </p>
    </section>
  );
}
