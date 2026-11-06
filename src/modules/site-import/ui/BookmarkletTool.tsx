import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';
import './site-import.css';

export function BookmarkletTool({ locale }: { locale: Locale }) {
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
    <>
      <p class="ff-site-import__actions">
        {href && (
          <a
            class="ff-link ff-button ff-button--secondary"
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
      <p role="status" class="ff-muted">
        {message}
      </p>
    </>
  );
}
