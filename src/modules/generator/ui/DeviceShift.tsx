import { type Locale, messagesFor } from '@/common/i18n';
import { ratingOf } from '@/modules/layout-shift';
import type { WidthShift } from '../lib/article-shift';

const SYMBOLS = { good: '🟢', 'needs-improvement': '🟡', poor: '🔴' } as const;

type Messages = ReturnType<typeof messagesFor>;

const ratingText = (t: Messages, rating: ReturnType<typeof ratingOf>) => {
  if (rating === 'good') return t.cls_rating_good();
  return rating === 'needs-improvement' ? t.cls_rating_needs() : t.cls_rating_poor();
};

export function ShiftBadge({ locale, score }: { locale: Locale; score: number }) {
  const rating = ratingOf(score);
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return (
    <strong class="ff-shift__score" data-rating={rating}>
      <span aria-hidden="true">{SYMBOLS[rating]}</span> {format.format(score)}
      <span class="ff-sr-only"> {ratingText(messagesFor(locale), rating)}</span>
    </strong>
  );
}

export function DeviceShift({
  locale,
  results,
  baseline,
  focusWidth,
  fitting = false,
}: {
  locale: Locale;
  results: readonly WidthShift[] | undefined;
  baseline?: readonly WidthShift[] | undefined;
  focusWidth?: number | undefined;
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
  const label = (rating: ReturnType<typeof ratingOf>) => ratingText(t, rating);
  const worstOf = (list: readonly WidthShift[] | undefined) => {
    const scoped =
      focusWidth === undefined ? list : list?.filter((item) => item.width === focusWidth);
    return scoped && scoped.length > 0 ? Math.max(...scoped.map((item) => item.score)) : undefined;
  };
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
          {before !== undefined && Math.round((worst - before) * 1000) !== 0 && (
            <span
              class="ff-shift__baseline"
              title={`${t.article_shift_before()}: ${format.format(before)}`}
            >
              <span class="ff-sr-only">
                {t.article_shift_before()}: {format.format(before)}{' '}
              </span>
              ({delta.format(worst - before)})
            </span>
          )}
        </span>
      )}
    </div>
  );
}
