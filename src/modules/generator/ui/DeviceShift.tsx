import { type Locale, messagesFor } from '@/common/i18n';
import { Popover } from '@/common/ui';
import { ratingOf } from '@/modules/layout-shift';
import type { WidthShift } from '../lib/article-shift';

const SYMBOLS = { good: '🟢', 'needs-improvement': '🟡', poor: '🔴' } as const;

export function DeviceShift({
  locale,
  results,
  baseline,
  fitting = false,
}: {
  locale: Locale;
  results: readonly WidthShift[] | undefined;
  baseline?: readonly WidthShift[] | undefined;
  fitting?: boolean;
}) {
  const t = messagesFor(locale);
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  const delta = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    signDisplay: 'always',
  });
  const label = (rating: ReturnType<typeof ratingOf>) => {
    if (rating === 'good') return t.cls_rating_good();
    return rating === 'needs-improvement' ? t.cls_rating_needs() : t.cls_rating_poor();
  };
  const worstOf = (list: readonly WidthShift[] | undefined) =>
    list && list.length > 0 ? Math.max(...list.map((item) => item.score)) : undefined;
  const worst = worstOf(results);
  const before = worstOf(baseline);
  const rating = worst === undefined ? undefined : ratingOf(worst);
  return (
    <div class="ff-shift" role="status">
      {fitting ? (
        <span class="ff-muted">{t.fit_running()}</span>
      ) : worst === undefined || rating === undefined ? (
        <span class="ff-muted">{t.article_shift_measuring()}</span>
      ) : (
        <>
          <strong class="ff-shift__score" data-rating={rating} title={t.article_shift_label()}>
            <span aria-hidden="true">{SYMBOLS[rating]}</span> CLS {format.format(worst)}
            <span class="ff-sr-only"> {label(rating)}</span>
          </strong>
          {before !== undefined && (
            <span class="ff-shift__baseline">
              {t.article_shift_plain({
                score: format.format(before),
                delta: delta.format(worst - before),
              })}
            </span>
          )}
          <Popover label={t.article_shift_details()} align="end">
            <ul class="ff-shift__widths">
              {(results ?? []).map((item) => {
                const level = ratingOf(item.score);
                return (
                  <li key={item.width} data-rating={level}>
                    <span aria-hidden="true">{SYMBOLS[level]}</span>
                    <span class="ff-shift__width">{item.width}px</span>
                    {format.format(item.score)}
                    <span class="ff-sr-only"> {label(level)}</span>
                  </li>
                );
              })}
            </ul>
          </Popover>
        </>
      )}
    </div>
  );
}
