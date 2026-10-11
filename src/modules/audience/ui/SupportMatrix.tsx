import { type Locale, messagesFor } from '@/common/i18n';
import type { CellState, MatrixGroup } from '../lib/matrix';
import './audience.css';

const SYMBOLS: Record<CellState, string> = { full: '✓', partial: '~', none: '✗', unknown: '?' };

export function SupportMatrix({
  locale,
  groups,
  rating,
}: {
  locale: Locale;
  groups: readonly MatrixGroup[];
  rating: (shift: number) => { level: 'good' | 'needs' | 'poor'; label: string };
}) {
  const t = messagesFor(locale);
  const number = (value: number, digits: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const stateLabel = (state: CellState) => {
    if (state === 'full') return t.matrix_full();
    if (state === 'partial') return t.matrix_partial();
    return state === 'none' ? t.matrix_none() : t.matrix_unknown();
  };
  const stateHint = (state: CellState) => {
    if (state === 'full') return t.matrix_full_hint();
    if (state === 'partial') return t.matrix_partial_hint();
    return state === 'none' ? t.matrix_none_hint() : t.matrix_unknown_hint();
  };
  if (groups.length === 0) return <p class="ff-muted">{t.matrix_empty()}</p>;
  return (
    <section class="ff-matrix" aria-label={t.matrix_heading()}>
      <ul class="ff-matrix__legend">
        {(['full', 'partial', 'none', 'unknown'] as const).map((state) => (
          <li key={state}>
            <span class="ff-matrix__chip" data-state={state}>
              <span aria-hidden="true">{SYMBOLS[state]}</span> {stateLabel(state)}
            </span>
            <span class="ff-muted">{stateHint(state)}</span>
          </li>
        ))}
      </ul>
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard users scroll the wide matrix */}
      <section class="ff-matrix__scroll" tabIndex={0} aria-label={t.matrix_scroll()}>
        <div class="ff-matrix__groups">
          {groups.map((group) => (
            <section class="ff-matrix__group" key={group.os}>
              <h3>
                {t[`audience_os_${group.os}`]()} <span>{number(group.share, 1)}%</span>
              </h3>
              <p class="ff-muted">
                {group.enabled
                  ? group.fonts
                  : group.available
                    ? t.matrix_generic()
                    : t.matrix_nodata()}
              </p>
              <div class="ff-matrix__columns">
                {group.columns.map((column) => (
                  <div class="ff-matrix__column" key={column.browser}>
                    <h4>
                      {column.name} <span>{number(column.share, 1)}%</span>
                    </h4>
                    <ul>
                      {column.cells.map((cell) => (
                        <li key={cell.label} data-state={cell.state}>
                          <span aria-hidden="true">{SYMBOLS[cell.state]}</span>
                          <span class="ff-sr-only">{stateLabel(cell.state)}: </span>
                          {cell.label}
                          {cell.shift !== null && (
                            <span class="ff-matrix__shift" data-rating={rating(cell.shift).level}>
                              <span class="ff-sr-only">
                                {t.matrix_shift({
                                  score: number(cell.shift, 3),
                                  rating: rating(cell.shift).label,
                                })}
                              </span>
                              <span aria-hidden="true">{number(cell.shift, 3)}</span>
                            </span>
                          )}
                          {cell.baseline !== null && (
                            <span class="ff-matrix__baseline">
                              {t.matrix_baseline({ score: number(cell.baseline, 3) })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              {group.hiddenShare > 0 && (
                <p class="ff-muted">{t.matrix_hidden({ percent: number(group.hiddenShare, 1) })}</p>
              )}
            </section>
          ))}
        </div>
      </section>
      <p class="ff-muted">{t.matrix_note()}</p>
    </section>
  );
}
