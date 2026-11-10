import { type Locale, localizeHref, messagesFor } from '@/common/i18n';
import type { SiteImport } from '@/modules/import-receiver';
import { BookmarkletTool } from './BookmarkletTool';
import { DirectFetch } from './DirectFetch';
import './site-import.css';

const EXTENSION_URL = 'https://github.com/fogrew/fontstay.dev/tree/develop/extension';

export function SiteImportPanel({
  locale,
  onImport,
}: {
  locale: Locale;
  onImport: (value: SiteImport) => void;
}) {
  const t = messagesFor(locale);
  return (
    <div class="ff-site-import">
      <p class="ff-muted">{t.import_note()}</p>
      <h3 class="ff-heading ff-site-import__title">{t.import_direct_label()}</h3>
      <p class="ff-muted">{t.import_direct_hint()}</p>
      <DirectFetch locale={locale} onImport={onImport} />
      <h3 class="ff-heading ff-site-import__title">{t.import_bookmarklet_label()}</h3>
      <p class="ff-muted">{t.import_bookmarklet_hint()}</p>
      <BookmarkletTool locale={locale} />
      <h3 class="ff-heading ff-site-import__title">{t.import_extension_label()}</h3>
      <p class="ff-muted">
        {t.import_extension_note()}{' '}
        <a class="ff-link" href={EXTENSION_URL} rel="noopener noreferrer" target="_blank">
          {t.import_extension_link()}
        </a>
      </p>
      <p class="ff-muted">{t.import_csp_note()}</p>
      <p class="ff-muted">
        <a class="ff-link" href={localizeHref('/extensions/', { locale })}>
          {t.import_more_link()}
        </a>
      </p>
    </div>
  );
}
