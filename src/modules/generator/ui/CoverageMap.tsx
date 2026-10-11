import { useEffect, useMemo, useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { Button, Select } from '@/common/ui';
import { blockCoverage } from '@/modules/font-metrics';

const COLUMNS = 16;
const PAGE_SIZE = 256;
const NON_PRINTABLE = /[\p{C}\p{Z}\p{M}]/u;

const hex = (value: number) => value.toString(16).toUpperCase().padStart(4, '0');

function glyphOf(codePoint: number): string {
  const char = String.fromCodePoint(codePoint);
  return NON_PRINTABLE.test(char) ? '' : char;
}

export function CoverageMap({ locale, codePoints }: { locale: Locale; codePoints: Uint32Array }) {
  const t = messagesFor(locale);
  const blocks = useMemo(() => blockCoverage(codePoints), [codePoints]);
  const covered = useMemo(() => new Set(codePoints), [codePoints]);
  const [blockIndex, setBlockIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [cursor, setCursor] = useState<number>();
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const block = blocks[Math.min(blockIndex, blocks.length - 1)];

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

  const move = (delta: number) => {
    const from = cursor ?? first;
    setCursor(Math.min(first + count - 1, Math.max(first, from + delta)));
  };

  return (
    <div class="ff-map">
      <p>{t.coverage_summary({ count: codePoints.length, blocks: blocks.length })}</p>
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
      <p class="ff-map__readout" role="status">
        {readout}
      </p>
      <table class="ff-map__table">
        <caption>{t.coverage_table_caption()}</caption>
        <thead>
          <tr>
            <th scope="col">{t.coverage_col_block()}</th>
            <th scope="col">{t.coverage_col_range()}</th>
            <th scope="col">{t.coverage_col_covered()}</th>
            <th scope="col">{t.coverage_col_percent()}</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((item) => (
            <tr key={item.start}>
              <th scope="row">{item.name}</th>
              <td>{`U+${hex(item.start)}–${hex(item.end)}`}</td>
              <td>{`${item.covered} / ${item.total}`}</td>
              <td>{`${number.format((item.covered / item.total) * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
