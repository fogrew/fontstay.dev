import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from './Button';
import type { CodeLanguage, Token } from './highlight';
import { Icon } from './Icon';
import { LiveRegion } from './LiveRegion';
import { ScrollShadow } from './ScrollShadow';

export function CodeBlock({
  locale,
  code,
  label,
  fileName,
  language,
}: {
  locale: Locale;
  code: string;
  label: string;
  fileName?: string | undefined;
  language?: CodeLanguage | undefined;
}) {
  const t = messagesFor(locale);
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [pending, setPending] = useState(false);
  const [tokens, setTokens] = useState<{ code: string; lines: Token[][] }>();
  useEffect(() => {
    if (!language) return;
    let cancelled = false;
    void import('./highlight')
      .then(({ tokenize }) => tokenize(code, language))
      .then((lines) => {
        if (!cancelled && lines) setTokens({ code, lines });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [code, language]);
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
      <ScrollShadow class="ff-code__body" tabIndex={0} label={label}>
        <pre>
          <code>
            {tokens?.code === code
              ? tokens.lines.map((line, row) => (
                  <Fragment key={row}>
                    {line.map((token, column) => (
                      <span
                        key={column}
                        class={
                          token.kind || token.italic || token.bold
                            ? `${token.kind ? `ff-tok-${token.kind}` : ''}${token.italic ? ' ff-tok-italic' : ''}${token.bold ? ' ff-tok-bold' : ''}`.trim()
                            : undefined
                        }
                      >
                        {token.text}
                      </span>
                    ))}
                    {row < tokens.lines.length - 1 ? '\n' : ''}
                  </Fragment>
                ))
              : code}
          </code>
        </pre>
      </ScrollShadow>
      {status === 'failed' && (
        <p class="ff-error" role="alert">
          {t.ui_copy_failed()}
        </p>
      )}
      <LiveRegion>{status === 'copied' ? t.ui_copied() : ''}</LiveRegion>
    </div>
  );
}
