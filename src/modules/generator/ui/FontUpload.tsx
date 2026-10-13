import { useRef } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';

export function FontUpload({
  locale,
  busy,
  compact,
  onFiles,
}: {
  locale: Locale;
  busy: boolean;
  compact: boolean;
  onFiles: (files: File[]) => void;
}) {
  const t = messagesFor(locale);
  const input = useRef<HTMLInputElement>(null);
  return (
    <section class="ff-drop" aria-labelledby="ff-upload-heading">
      <h2 id="ff-upload-heading">{t.upload_heading()}</h2>
      <p class="ff-drop__row">
        <span>{t.upload_drop()}</span>
        <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}>
          {t.upload_choose()}
        </Button>
      </p>
      <input
        ref={input}
        hidden
        type="file"
        multiple
        accept=".woff2,.woff,.ttf,.otf,.ttc,.otc,font/woff2,font/woff,font/ttf,font/otf,font/collection"
        onChange={(event) => {
          onFiles([...(event.currentTarget.files ?? [])]);
          event.currentTarget.value = '';
        }}
      />
      {!compact && <p class="ff-muted">{t.upload_local()}</p>}
    </section>
  );
}
