import type { ComponentType } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Select } from '@/common/ui';
import { blockCoverage, type FontMetrics } from '@/modules/font-metrics';
import { GLYPH_FAMILY } from '../lib/glyph-detail';
import type { GlyphDetailProps } from './GlyphDetail';

const COLUMNS = 16;
const PAGE_SIZE = 256;
const NON_PRINTABLE = /[\p{C}\p{Z}\p{M}]/u;

const hex = (value: number) => value.toString(16).toUpperCase().padStart(4, '0');

function glyphOf(codePoint: number): string {
  const char = String.fromCodePoint(codePoint);
  return NON_PRINTABLE.test(char) ? '' : char;
}

export function CoverageMap({
  locale,
  metrics,
  bytes,
}: {
  locale: Locale;
  metrics: FontMetrics;
  bytes: ArrayBuffer;
}) {
  const t = messagesFor(locale);
  const codePoints = metrics.codePoints;
  const blocks = useMemo(() => blockCoverage(codePoints), [codePoints]);
  const covered = useMemo(() => new Set(codePoints), [codePoints]);
  const [blockIndex, setBlockIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [cursor, setCursor] = useState<number>();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const block = blocks[Math.min(blockIndex, blocks.length - 1)];

  const [Detail, setDetail] = useState<ComponentType<GlyphDetailProps>>();
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import('./GlyphDetail').then((module) => {
      if (!cancelled) setDetail(() => module.GlyphDetail);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setFontReady(false);
    let cancelled = false;
    const face = new FontFace(GLYPH_FAMILY, bytes.slice(0));
    face
      .load()
      .then(() => {
        if (cancelled) return;
        document.fonts.add(face);
        setFontReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      document.fonts.delete(face);
    };
  }, [bytes]);

  useEffect(() => {
    setBlockIndex(0);
    setPage(0);
    setCursor(undefined);
  }, [codePoints]);

  if (!block) return <p class="ff-muted">{t.coverage_empty()}</p>;

  const pages = Math.ceil(block.total / PAGE_SIZE);
  const first = block.start + page * PAGE_SIZE;
  const count = Math.min(PAGE_SIZE, block.end - first + 1);
  const cells = Array.from({ length: count }, (_, index) => first + index);
  const readout =
    cursor === undefined
      ? t.coverage_hint()
      : t.coverage_cell({
          code: hex(cursor),
          char: glyphOf(cursor) || '·',
          block: block.name,
          state: covered.has(cursor) ? t.coverage_state_yes() : t.coverage_state_no(),
        });

  const shown = cursor ?? cells.find((codePoint) => covered.has(codePoint)) ?? first;

  const move = (delta: number) => {
    const from = cursor ?? first;
    setCursor(Math.min(first + count - 1, Math.max(first, from + delta)));
  };

  return (
    <div class="ff-map">
      <p class="ff-map__text">
        {t.coverage_summary({ count: codePoints.length, blocks: blocks.length })}
      </p>
      <div class="ff-map__controls">
        <Select
          label={t.coverage_block_label()}
          value={String(blockIndex)}
          options={blocks.map((item, index) => ({
            value: String(index),
            label: `${item.name} (${item.covered}/${item.total})`,
          }))}
          onChange={(value) => {
            setBlockIndex(Number(value));
            setPage(0);
            setCursor(undefined);
          }}
        />
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
      </div>
      <div class="ff-map__layout">
        {/* biome-ignore-start lint/a11y/noNoninteractiveElementInteractions: the grid is a pointer and arrow-key readout */}
        {/* biome-ignore-start lint/a11y/noNoninteractiveTabindex: arrow keys move through the cells */}
        {/* biome-ignore-start lint/a11y/useSemanticElements: a grid of cells has no native element */}
        <div
          class="ff-map__grid"
          role="group"
          aria-label={t.coverage_map_label({ block: block.name })}
          tabIndex={0}
          onPointerOver={(event) => {
            const value = (event.target as HTMLElement).dataset.cp;
            if (value) setCursor(Number(value));
          }}
          onClick={(event) => {
            const value = (event.target as HTMLElement).dataset.cp;
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
          {cells.map((codePoint) => (
            <span
              key={codePoint}
              class="ff-map__cell"
              data-cp={codePoint}
              data-covered={covered.has(codePoint)}
              data-cursor={codePoint === cursor}
            >
              {covered.has(codePoint) ? glyphOf(codePoint) : ''}
            </span>
          ))}
        </div>
        {/* biome-ignore-end lint/a11y/useSemanticElements: a grid of cells has no native element */}
        {/* biome-ignore-end lint/a11y/noNoninteractiveTabindex: arrow keys move through the cells */}
        {/* biome-ignore-end lint/a11y/noNoninteractiveElementInteractions: the grid is a pointer and arrow-key readout */}
        <div class="ff-map__slot">
          {Detail && (
            <Detail
              locale={locale}
              metrics={metrics}
              codePoint={shown}
              covered={covered.has(shown)}
              ready={fontReady}
            />
          )}
        </div>
      </div>
      <p class="ff-map__text ff-map__readout" role="status">
        {readout}
      </p>
      <table class="ff-map__table">
        <caption class="ff-map__caption">{t.coverage_table_caption()}</caption>
        <thead>
          <tr>
            <th class="ff-map__table-cell" scope="col">
              {t.coverage_col_block()}
            </th>
            <th class="ff-map__table-cell" scope="col">
              {t.coverage_col_range()}
            </th>
            <th class="ff-map__table-cell" scope="col">
              {t.coverage_col_covered()}
            </th>
            <th class="ff-map__table-cell" scope="col">
              {t.coverage_col_percent()}
            </th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((item) => (
            <tr key={item.start}>
              <th class="ff-map__table-cell" scope="row">
                {item.name}
              </th>
              <td class="ff-map__table-cell">{`U+${hex(item.start)}–${hex(item.end)}`}</td>
              <td class="ff-map__table-cell">{`${item.covered} / ${item.total}`}</td>
              <td class="ff-map__table-cell">{`${number.format((item.covered / item.total) * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
