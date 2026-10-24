import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';

const EXTENSION_URL = 'https://github.com/fogrew/fontstay.dev/tree/develop/extension';

export function SiteImportPanel({ locale }: { locale: Locale }) {
  const t = messagesFor(locale);
  const [href, setHref] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    void import('../lib/bookmarklet').then(({ bookmarkletHref }) =>
      setHref(
        bookmarkletHref({
          origin: location.origin,
          locale,
          copied: t.import_bookmarklet_alert_copied(),
          failed: t.import_bookmarklet_alert_failed(),
        }),
      ),
    );
  }, [locale]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setMessage(t.import_bookmarklet_copied());
    } catch {
      setMessage(t.import_bookmarklet_copy_failed());
    }
  };
  return (
    <div class="ff-site-import">
      <p class="ff-muted">{t.import_note()}</p>
      <h3 class="ff-site-import__title">{t.import_bookmarklet_label()}</h3>
      <p class="ff-muted">{t.import_bookmarklet_hint()}</p>
      <p class="ff-site-import__actions">
        {href && (
          <a
            class="ff-button ff-button--secondary"
            href={href}
            draggable
            onClick={(event) => {
              event.preventDefault();
              setMessage(t.import_bookmarklet_drag());
            }}
          >
            {t.import_bookmarklet_link()}
          </a>
        )}
        <Button variant="secondary" onClick={() => void copy()}>
          {t.import_bookmarklet_copy()}
        </Button>
      </p>
      <h3 class="ff-site-import__title">{t.import_extension_label()}</h3>
      <p class="ff-muted">
        {t.import_extension_note()}{' '}
        <a href={EXTENSION_URL} rel="noopener noreferrer" target="_blank">
          {t.import_extension_link()}
        </a>
      </p>
      <p class="ff-muted">{t.import_csp_note()}</p>
      <p role="status" class="ff-muted">
        {message}
      </p>
    </div>
  );
}
