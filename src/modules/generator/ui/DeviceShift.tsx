import { useEffect, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import {
  DEFAULT_VIEWPORTS,
  type PanelInput,
  ratingOf,
  simulateLayoutShift,
} from '@/modules/layout-shift';

type State = { state: 'measuring' } | { state: 'failed' } | { state: 'done'; value: number };

const DELAY_MS = 600;

export function DeviceShift({
  locale,
  input,
  signature,
}: {
  locale: Locale;
  input: PanelInput;
  signature: string;
}) {
  const t = messagesFor(locale);
  const [result, setResult] = useState<State>({ state: 'measuring' });
  useEffect(() => {
    const controller = new AbortController();
    setResult({ state: 'measuring' });
    const timer = setTimeout(() => {
      simulateLayoutShift({ ...input, viewports: DEFAULT_VIEWPORTS, signal: controller.signal })
        .then((results) => {
          if (!controller.signal.aborted) {
            setResult({ state: 'done', value: Math.max(...results.map((item) => item.score)) });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ state: 'failed' });
        });
    }, DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [signature]);

  const rating = result.state === 'done' ? ratingOf(result.value) : undefined;
  const label = (() => {
    if (rating === 'good') return t.cls_rating_good();
    return rating === 'needs-improvement' ? t.cls_rating_needs() : t.cls_rating_poor();
  })();
  return (
    <p class="ff-article-view__shift" role="status">
      <span>{t.article_shift_label()}</span>
      {result.state === 'measuring' && <span class="ff-muted">{t.article_shift_measuring()}</span>}
      {result.state === 'failed' && <span class="ff-muted">{t.article_shift_failed()}</span>}
      {result.state === 'done' && (
        <strong data-rating={rating}>
          {new Intl.NumberFormat(locale, {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
          }).format(result.value)}{' '}
          · {label}
        </strong>
      )}
    </p>
  );
}
