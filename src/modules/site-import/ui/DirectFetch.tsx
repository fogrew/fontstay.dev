import { useEffect, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';
import type { SiteImport } from '@/modules/import-receiver';
import type { DirectFailure } from '../lib/direct-fetch';
import './site-import.css';

export function DirectFetch({
  locale,
  onImport,
}: {
  locale: Locale;
  onImport: (value: SiteImport) => void;
}) {
  const t = messagesFor(locale);
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<DirectFailure | ''>('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const errors: Record<DirectFailure, string> = {
    invalid: t.import_direct_invalid(),
    blocked: t.import_direct_blocked(),
    unreachable: t.import_direct_unreachable(),
    status: t.import_direct_status(),
    stylesheets: t.import_direct_stylesheets(),
    'no-fonts': t.import_direct_none(),
  };

  const submit = async (event: Event) => {
    event.preventDefault();
    if (busy) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setFailure('');
    const { directImport } = await import('../lib/direct-fetch');
    const result = await directImport(address, { signal: controller.signal });
    if (controller.signal.aborted) return;
    setBusy(false);
    if (result.ok) onImport(result.value);
    else setFailure(result.reason);
  };

  return (
    <form class="ff-site-import__direct" onSubmit={submit}>
      <div class="ff-field">
        <label for="ff-direct-address">{t.import_direct_field()}</label>
        <input
          id="ff-direct-address"
          class="ff-input"
          type="text"
          inputMode="url"
          spellcheck={false}
          autocomplete="off"
          placeholder="https://example.com"
          value={address}
          onInput={(event) => setAddress(event.currentTarget.value)}
        />
      </div>
      <p class="ff-site-import__actions">
        <Button type="submit" variant="secondary" disabled={busy || address.trim() === ''}>
          {busy ? t.import_direct_busy() : t.import_direct_button()}
        </Button>
      </p>
      <div role="status">{failure && <p class="ff-error">{errors[failure]}</p>}</div>
    </form>
  );
}
