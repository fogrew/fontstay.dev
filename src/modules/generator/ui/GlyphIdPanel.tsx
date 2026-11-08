import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button } from '@/common/ui';
import {
  type FontMetrics,
  GLYPH_EMPTY,
  type GlyphTable,
  glyphOutline,
  inspectGlyphs,
} from '@/modules/font-metrics';
import { glyphVertical } from '../lib/glyph-detail';
import { formatBounds, type GlyphIdMode, glyphBounds, glyphIds } from '../lib/glyph-ids';
import { BASELINE, drawGuides, HEIGHT, SIZE, WIDTH, X } from './GlyphDetail';

const COLUMNS = 8;
const PAGE_SIZE = 256;
const OUTLINE_DELAY_MS = 120;

export interface GlyphIdPanelProps {
  locale: Locale;
  metrics: FontMetrics;
  bytes: ArrayBuffer;
  mode: GlyphIdMode;
}

function GlyphOutline({
  locale,
  metrics,
  bytes,
  table,
  glyph,
  mode,
}: {
  locale: Locale;
  metrics: FontMetrics;
  bytes: ArrayBuffer;
  table: GlyphTable;
  glyph: number;
  mode: GlyphIdMode;
}) {
  const t = messagesFor(locale);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [path, setPath] = useState<string | null>();
  const { em, ascent, descent } = glyphVertical(metrics);
  const bounds = glyphBounds(table, glyph);
  const advance = table.advances[glyph] ?? 0;
  const alternate =
    mode === 'alternates' ? table.alternates.find((item) => item.glyph === glyph) : undefined;

  useEffect(() => {
    setPath(undefined);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void glyphOutline(bytes, glyph, controller.signal).then((result) => {
        if (!controller.signal.aborted) setPath(result);
      });
    }, OUTLINE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [bytes, glyph]);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    drawGuides(context, element, { em, ascent, descent });
    const scale = SIZE / em;
    if (path) {
      context.save();
      context.translate(X, BASELINE);
      context.scale(scale, -scale);
      context.fillStyle = '#171717';
      context.fill(new Path2D(path));
      context.restore();
    }
    if (bounds) {
      context.strokeStyle = '#145c82';
      context.strokeRect(
        X + bounds.minX * scale,
        BASELINE - bounds.maxY * scale,
        (bounds.maxX - bounds.minX) * scale,
        (bounds.maxY - bounds.minY) * scale,
      );
    }
    const advanceX = X + advance * scale;
    context.strokeStyle = '#7b4d19';
    context.beginPath();
    context.moveTo(advanceX, 24);
    context.lineTo(advanceX, 166);
    context.stroke();
  }, [path, bounds, advance, em, ascent, descent]);

  return (
    <div class="ff-map__glyph">
      <canvas
        ref={canvas}
        class="ff-map__canvas"
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={t.coverage_glyph_diagram({ glyph: `#${glyph}` })}
      />
      <dl class="ff-map__metrics">
        <dt>{t.glyph_id()}</dt>
        <dd class="ff-map__metric-value">{glyph}</dd>
        <dt>{t.coverage_glyph_advance()}</dt>
        <dd class="ff-map__metric-value">
          {Math.round(advance)} / {em}
        </dd>
        <dt>{t.glyph_bounds()}</dt>
        <dd class="ff-map__metric-value">{formatBounds(bounds)}</dd>
        {alternate && (
          <>
            <dt>{t.glyph_feature()}</dt>
            <dd class="ff-map__metric-value">{alternate.tag}</dd>
            <dt>{t.glyph_replaces()}</dt>
            <dd class="ff-map__metric-value">{alternate.base}</dd>
          </>
        )}
      </dl>
      {((table.flags[glyph] ?? 0) & GLYPH_EMPTY) !== 0 && (
        <p class="ff-muted">{t.glyph_no_outline()}</p>
      )}
      <p class="ff-map__legend">{t.coverage_glyph_legend()}</p>
    </div>
  );
}

export function GlyphIdPanel({ locale, metrics, bytes, mode }: GlyphIdPanelProps) {
  const t = messagesFor(locale);
  const [table, setTable] = useState<GlyphTable | null>();
  const [page, setPage] = useState(0);
  const [cursor, setCursor] = useState<number>();

  useEffect(() => {
    setTable(undefined);
    const controller = new AbortController();
    void inspectGlyphs(bytes, controller.signal).then((result) => {
      if (!controller.signal.aborted) setTable(result);
    });
    return () => controller.abort();
  }, [bytes]);

  useEffect(() => {
    setPage(0);
    setCursor(undefined);
  }, [mode, table]);

  const ids = useMemo(() => (table ? glyphIds(table, mode) : []), [table, mode]);

  if (table === undefined)
    return (
      <p class="ff-muted" role="status">
        {t.glyph_loading()}
      </p>
    );
  if (table === null)
    return (
      <p class="ff-muted" role="alert">
        {t.glyph_failed()}
      </p>
    );

  const pages = Math.max(1, Math.ceil(ids.length / PAGE_SIZE));
  const cells = ids.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const shown = cursor ?? cells[0];
  const unencoded = glyphIds(table, 'unencoded').length;

  const move = (delta: number) => {
    const from = Math.max(0, cells.indexOf(cursor ?? cells[0] ?? -1));
    const next = cells[Math.min(cells.length - 1, Math.max(0, from + delta))];
    if (next !== undefined) setCursor(next);
  };

  return (
    <div class="ff-map">
      <p class="ff-map__text">
        {t.glyph_summary({ count: table.count, unencoded, alternates: table.alternates.length })}
      </p>
      {table.truncated && <p class="ff-map__text">{t.glyph_truncated({ count: table.count })}</p>}
      {ids.length === 0 ? (
        <p class="ff-muted">
          {mode === 'alternates' ? t.glyph_none_alternates() : t.glyph_none_unencoded()}
        </p>
      ) : (
        <>
          {pages > 1 && (
            <div class="ff-map__pages">
              <Button
                disabled={page === 0}
                onClick={() => {
                  setPage(page - 1);
                  setCursor(undefined);
                }}
              >
                {t.coverage_prev()}
              </Button>
              <span>{t.coverage_page({ page: page + 1, pages })}</span>
              <Button
                disabled={page >= pages - 1}
                onClick={() => {
                  setPage(page + 1);
                  setCursor(undefined);
                }}
              >
                {t.coverage_next()}
              </Button>
            </div>
          )}
          <div class="ff-map__layout">
            {/* biome-ignore-start lint/a11y/noNoninteractiveElementInteractions: the grid is a click and arrow-key readout */}
            {/* biome-ignore-start lint/a11y/noNoninteractiveTabindex: arrow keys move through the cells */}
            {/* biome-ignore-start lint/a11y/useSemanticElements: a grid of cells has no native element */}
            <div
              class="ff-map__grid ff-map__grid--ids"
              role="group"
              aria-label={t.glyph_list_label({ page: page + 1, pages })}
              tabIndex={0}
              onClick={(event) => {
                const value = (event.target as HTMLElement).dataset.gid;
                if (value) setCursor(Number(value));
              }}
              onKeyDown={(event) => {
                const steps: Record<string, number> = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -COLUMNS,
                  ArrowDown: COLUMNS,
                };
                const step = steps[event.key];
                if (step === undefined) return;
                event.preventDefault();
                move(step);
              }}
            >
              {cells.map((id) => (
                <span
                  key={id}
                  class="ff-map__cell ff-map__cell--id"
                  data-gid={id}
                  data-covered="true"
                  data-cursor={id === shown}
                >
                  {id}
                </span>
              ))}
            </div>
            {/* biome-ignore-end lint/a11y/useSemanticElements: a grid of cells has no native element */}
            {/* biome-ignore-end lint/a11y/noNoninteractiveTabindex: arrow keys move through the cells */}
            {/* biome-ignore-end lint/a11y/noNoninteractiveElementInteractions: the grid is a click and arrow-key readout */}
            <div class="ff-map__slot">
              {shown !== undefined && (
                <GlyphOutline
                  locale={locale}
                  metrics={metrics}
                  bytes={bytes}
                  table={table}
                  glyph={shown}
                  mode={mode}
                />
              )}
            </div>
          </div>
          <p class="ff-map__text ff-map__readout" role="status">
            {cursor === undefined ? t.glyph_hint() : `${t.glyph_id()} ${shown}`}
          </p>
        </>
      )}
    </div>
  );
}
