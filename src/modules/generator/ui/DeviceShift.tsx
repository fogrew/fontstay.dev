import { type Locale, messagesFor } from '@/common/i18n';
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
  const label = (rating: ReturnType<typeof ratingOf>) => {
    if (rating === 'good') return t.cls_rating_good();
    return rating === 'needs-improvement' ? t.cls_rating_needs() : t.cls_rating_poor();
  };
  const worst = results ? Math.max(...results.map((item) => item.score)) : undefined;
  const rating = worst === undefined ? undefined : ratingOf(worst);
  const before = baseline ? Math.max(...baseline.map((item) => item.score)) : undefined;
  const delta = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    signDisplay: 'always',
  });
  return (
    <fieldset class="ff-article-view__group ff-shift">
      <legend>{t.article_shift_label()}</legend>
      <div class="ff-shift__body" role="status">
        {fitting ? (
          <span class="ff-muted">{t.fit_running()}</span>
        ) : worst === undefined || rating === undefined ? (
          <span class="ff-muted">{t.article_shift_measuring()}</span>
        ) : (
          <>
            <strong class="ff-shift__score" data-rating={rating}>
              <span aria-hidden="true">{SYMBOLS[rating]}</span> CLS {format.format(worst)}
              <span class="ff-shift__rating"> · {label(rating)}</span>
            </strong>
            {before !== undefined && (
              <p class="ff-shift__baseline" data-rating={ratingOf(before)}>
                <span aria-hidden="true">{SYMBOLS[ratingOf(before)]}</span>{' '}
                {t.article_shift_plain({
                  score: format.format(before),
                  delta: delta.format(worst - before),
                })}
              </p>
            )}
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
          </>
        )}
      </div>
    </fieldset>
  );
}
