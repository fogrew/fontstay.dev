import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from './Button';
import { Icon } from './Icon';
import { LiveRegion } from './LiveRegion';

export function CodeBlock({
  locale,
  code,
  label,
  fileName,
}: {
  locale: Locale;
  code: string;
  label: string;
  fileName?: string | undefined;
}) {
  const t = messagesFor(locale);
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    if (status !== 'copied') return;
    const timer = setTimeout(() => setStatus('idle'), 4000);
    return () => clearTimeout(timer);
  }, [status]);
  const copy = async () => {
    setPending(true);
    setStatus('idle');
    try {
      await navigator.clipboard.writeText(code);
      setStatus('copied');
    } catch {
      setStatus('failed');
    } finally {
      setPending(false);
    }
  };
  return (
    <div class="ff-code">
      <div class="ff-code__header">
        <span>{label}</span>
        <span class="ff-code__actions">
          {fileName && (
            <Button
              onClick={() => {
                const url = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                link.click();
                URL.revokeObjectURL(url);
              }}
              aria-label={`${t.ui_download()}: ${label}`}
            >
              <Icon name="download" />
              {t.ui_download()}
            </Button>
          )}
          <Button disabled={pending} onClick={copy} aria-label={`${t.ui_copy_code()}: ${label}`}>
            <Icon name="copy" />
            {t.ui_copy_code()}
          </Button>
        </span>
      </div>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable code needs a keyboard focus target. */}
      <section class="ff-code__body" tabIndex={0} aria-label={label}>
        <pre>
          <code>{code}</code>
        </pre>
      </section>
      {status === 'failed' && (
        <p class="ff-error" role="alert">
          {t.ui_copy_failed()}
        </p>
      )}
      <LiveRegion>{status === 'copied' ? t.ui_copied() : ''}</LiveRegion>
    </div>
  );
}
