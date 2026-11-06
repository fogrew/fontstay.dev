import { type Locale, messagesFor } from '@/common/i18n';
import { Popover } from '@/common/ui';
import { ratingOf } from '@/modules/layout-shift';
import type { WidthShift } from '../lib/article-shift';

const SYMBOLS = { good: '🟢', 'needs-improvement': '🟡', poor: '🔴' } as const;

export function DeviceShift({
  locale,
  results,
  baseline,
  focusWidth,
  currentWidth,
  fitting = false,
}: {
  locale: Locale;
  results: readonly WidthShift[] | undefined;
  baseline?: readonly WidthShift[] | undefined;
  focusWidth?: number | undefined;
  currentWidth?: number | undefined;
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
  const worstOf = (list: readonly WidthShift[] | undefined) => {
    const scoped =
      focusWidth === undefined ? list : list?.filter((item) => item.width === focusWidth);
    return scoped && scoped.length > 0 ? Math.max(...scoped.map((item) => item.score)) : undefined;
  };
  const worst = worstOf(results);
  const before = worstOf(baseline);
  const rating = worst === undefined ? undefined : ratingOf(worst);
  const beforeRating = before === undefined ? undefined : ratingOf(before);
  return (
    <div class="ff-shift" role="status">
      {fitting ? (
        <span class="ff-muted">{t.fit_running()}</span>
      ) : worst === undefined || rating === undefined ? (
        <span class="ff-muted">{t.article_shift_measuring()}</span>
      ) : (
        <>
          <span class="ff-shift__change">
            <span class="ff-shift__label">CLS</span>
            {focusWidth !== undefined && <span class="ff-shift__at ff-muted">{focusWidth}px</span>}
            <strong class="ff-shift__score" data-rating={rating} title={t.article_shift_after()}>
              <span aria-hidden="true">{SYMBOLS[rating]}</span> {format.format(worst)}
              <span class="ff-sr-only">
                {' '}
                {t.article_shift_after()}, {label(rating)}
              </span>
            </strong>
            {before !== undefined && delta.format(worst - before) !== delta.format(0) && (
              <span class="ff-shift__baseline">({delta.format(worst - before)})</span>
            )}
          </span>
          <Popover label={t.article_shift_details()} align="end">
            {before !== undefined && beforeRating !== undefined && (
              <p class="ff-shift__compare">
                <span>{t.article_shift_before()}</span>{' '}
                <strong class="ff-shift__score" data-rating={beforeRating}>
                  <span aria-hidden="true">{SYMBOLS[beforeRating]}</span> {format.format(before)}
                  <span class="ff-sr-only"> {label(beforeRating)}</span>
                </strong>
              </p>
            )}
            <ul class="ff-generator__list ff-shift__widths">
              {(results ?? []).map((item) => {
                const level = ratingOf(item.score);
                return (
                  <li
                    class="ff-generator__item"
                    key={item.width}
                    data-rating={level}
                    aria-current={item.width === currentWidth ? 'true' : undefined}
                  >
                    <span aria-hidden="true">{SYMBOLS[level]}</span>
                    <span class="ff-shift__width">{item.width}px</span>
                    {format.format(item.score)}
                    <span class="ff-sr-only">
                      {' '}
                      {label(level)}
                      {item.width === currentWidth && `, ${t.article_shift_current()}`}
                    </span>
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
