import { type Locale, messagesFor } from '@/common/i18n';
import { ratingOf } from '@/modules/layout-shift';
import type { WidthShift } from '../lib/article-shift';

export function DeviceShift({
  locale,
  results,
}: {
  locale: Locale;
  results: readonly WidthShift[] | undefined;
}) {
  const t = messagesFor(locale);
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  const worst = results ? Math.max(...results.map((item) => item.score)) : undefined;
  const rating = worst === undefined ? undefined : ratingOf(worst);
  const label = (() => {
    if (rating === 'good') return t.cls_rating_good();
    return rating === 'needs-improvement' ? t.cls_rating_needs() : t.cls_rating_poor();
  })();
  return (
    <p class="ff-article-view__shift" role="status">
      <span>{t.article_shift_label()}</span>
      {worst === undefined ? (
        <span class="ff-muted">{t.article_shift_measuring()}</span>
      ) : (
        <>
          <strong data-rating={rating}>
            {format.format(worst)} · {label}
          </strong>
          <span class="ff-muted">
            {(results ?? [])
              .map((item) => `${item.width}px: ${format.format(item.score)}`)
              .join(', ')}
          </span>
        </>
      )}
    </p>
  );
}
