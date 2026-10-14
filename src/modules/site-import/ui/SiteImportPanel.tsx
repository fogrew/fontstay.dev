import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Disclosure } from '@/common/ui';
import type { SiteImport } from '@/modules/import-receiver';

const EXTENSION_URL = 'https://github.com/fogrew/fontstay.dev/tree/develop/extension';

export function SiteImportPanel({
  locale,
  onImport,
}: {
  locale: Locale;
  onImport: (value: SiteImport) => void;
}) {
  const t = messagesFor(locale);
  const [href, setHref] = useState('');
  const [message, setMessage] = useState('');
  const [pasted, setPasted] = useState('');
  const [opened, setOpened] = useState(false);
  useEffect(() => {
    if (!opened) return;
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
  }, [opened, locale]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(href);
      setMessage(t.import_bookmarklet_copied());
    } catch {
      setMessage(t.import_bookmarklet_copy_failed());
    }
  };
  const read = async () => {
    const { parseClipboardImport } = await import('../lib/pending');
    const value = parseClipboardImport(pasted);
    if (value) {
      setMessage('');
      onImport(value);
    } else {
      setMessage(t.import_paste_error());
    }
  };

  return (
    <Disclosure summary={t.import_heading()} onToggle={(open) => open && setOpened(true)}>
      <div class="ff-site-import">
        <p class="ff-muted">{t.import_note()}</p>
        <h4 class="ff-site-import__title">{t.import_bookmarklet_label()}</h4>
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
        <h4 class="ff-site-import__title">{t.import_extension_label()}</h4>
        <p class="ff-muted">
          {t.import_extension_note()}{' '}
          <a href={EXTENSION_URL} rel="noopener noreferrer" target="_blank">
            {t.import_extension_link()}
          </a>
        </p>
        <p class="ff-muted">{t.import_csp_note()}</p>
        <div class="ff-field">
          <label for="ff-site-import-paste">{t.import_paste_label()}</label>
          <textarea
            id="ff-site-import-paste"
            class="ff-input ff-site-import__paste"
            rows={3}
            spellcheck={false}
            value={pasted}
            onInput={(event) => setPasted(event.currentTarget.value)}
          />
        </div>
        <Button variant="secondary" disabled={pasted.trim() === ''} onClick={() => void read()}>
          {t.import_paste_button()}
        </Button>
        <p role="status" class="ff-muted">
          {message}
        </p>
      </div>
    </Disclosure>
  );
}
