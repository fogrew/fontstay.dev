import { Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from './Button';
import type { CodeLanguage, Token } from './highlight';
import { Icon } from './Icon';
import { LiveRegion } from './LiveRegion';
import { ScrollShadow } from './ScrollShadow';

export function CodeActions({
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
    <>
      <Button disabled={pending} onClick={copy} aria-label={`${t.ui_copy_code()}: ${label}`}>
        <Icon name="copy" />
        {t.ui_copy_code()}
      </Button>
      {fileName && (
        <Button
          variant="primary"
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
      {status === 'failed' && (
        <p class="ff-error ff-code__error" role="alert">
          {t.ui_copy_failed()}
        </p>
      )}
      <LiveRegion>{status === 'copied' ? t.ui_copied() : ''}</LiveRegion>
    </>
  );
}

export function CodeBlock({
  locale,
  code,
  label,
  fileName,
  language,
  controls = true,
}: {
  locale: Locale;
  code: string;
  label: string;
  fileName?: string | undefined;
  language?: CodeLanguage | undefined;
  controls?: boolean;
}) {
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
  return (
    <div class="ff-code">
      <div class="ff-code__header">
        <span>{label}</span>
        {controls && (
          <div class="ff-code__actions">
            <CodeActions locale={locale} code={code} label={label} fileName={fileName} />
          </div>
        )}
      </div>
      <ScrollShadow class="ff-code__body" tabIndex={0} label={label}>
        <pre class="ff-code__pre" dir="ltr">
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
    </div>
  );
}
