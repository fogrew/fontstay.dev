import { type ComponentChildren, Fragment } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { loadLayout, parseIds, parseSizes, saveLayout } from './persist';

export interface ColumnsProps {
  items: readonly { id: string; label: string; weight: number; content: ComponentChildren }[];
  storageKey: string;
  resizeLabel: (left: string, right: string) => string;
}

type Sizes = Record<string, number>;

interface Drag {
  startX: number;
  start: Sizes;
  left: string;
  right: string;
  total: number;
}

interface Saved {
  sizes: Sizes | undefined;
  collapsed: string[];
}

const MIN_COLUMN_PX = 200;
const COLLAPSE_PX = 96;
const KEY_STEP = 0.03;

export function Columns({ items, storageKey, resizeLabel }: ColumnsProps) {
  const base = useId();
  const ids = items.map((item) => item.id);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [sizes, setSizes] = useState<Sizes>({});
  const [ready, setReady] = useState(false);
  const elements = useRef(new Map<string, HTMLElement>());
  const drag = useRef<Drag>();

  useEffect(() => {
    const saved = loadLayout<Saved>(storageKey, (value) => {
      if (typeof value !== 'object' || value === null) return undefined;
      const record = value as Record<string, unknown>;
      return {
        sizes: parseSizes(record.sizes, ids),
        collapsed: parseIds(record.collapsed, ids),
      };
    });
    if (saved) {
      if (saved.sizes) setSizes(saved.sizes);
      setCollapsed(new Set(saved.collapsed));
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) saveLayout(storageKey, { sizes, collapsed: [...collapsed] });
  }, [ready, sizes, collapsed, storageKey]);

  const openIds = ids.filter((id) => !collapsed.has(id));
  const rtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl';
  const totalWeight =
    openIds.reduce(
      (sum, id) => sum + (sizes[id] ?? items.find((i) => i.id === id)?.weight ?? 1),
      0,
    ) || 1;
  const labelOf = (id: string) => items.find((item) => item.id === id)?.label ?? id;

  const measure = () => {
    const widths = openIds.map(
      (id) => elements.current.get(id)?.getBoundingClientRect().width ?? 0,
    );
    const total = widths.reduce((sum, width) => sum + width, 0) || 1;
    const fractions: Sizes = Object.fromEntries(
      openIds.map((id, index) => [id, (widths[index] ?? 0) / total]),
    );
    return { fractions, total };
  };

  const apply = (start: Sizes, total: number, left: string, right: string, delta: number) => {
    const first = (start[left] ?? 0) * total;
    const second = (start[right] ?? 0) * total;
    if (first + delta < COLLAPSE_PX) {
      drag.current = undefined;
      setCollapsed((current) => new Set(current).add(left));
      return;
    }
    if (second - delta < COLLAPSE_PX) {
      drag.current = undefined;
      setCollapsed((current) => new Set(current).add(right));
      return;
    }
    const bounded = Math.min(Math.max(delta, MIN_COLUMN_PX - first), second - MIN_COLUMN_PX);
    setSizes({
      ...start,
      [left]: (first + bounded) / total,
      [right]: (second - bounded) / total,
    });
  };

  return (
    <div class="ff-columns">
      {items.map((item) => {
        const open = !collapsed.has(item.id);
        const next = open ? openIds[openIds.indexOf(item.id) + 1] : undefined;
        const weight = sizes[item.id] ?? item.weight;
        return (
          <Fragment key={item.id}>
            <section
              class="ff-columns__column"
              data-open={open}
              ref={(element) => {
                if (element) elements.current.set(item.id, element);
                else elements.current.delete(item.id);
              }}
              data-weight={item.weight}
              style={ready && open ? { flex: `${weight} 1 0` } : undefined}
            >
              <h2 class="ff-columns__heading">
                <button
                  type="button"
                  id={`${base}-${item.id}-button`}
                  aria-expanded={open}
                  aria-controls={`${base}-${item.id}-panel`}
                  onClick={() => {
                    setCollapsed((current) => {
                      const updated = new Set(current);
                      if (!updated.delete(item.id)) updated.add(item.id);
                      return updated;
                    });
                  }}
                >
                  {item.label}
                </button>
              </h2>
              <div id={`${base}-${item.id}-panel`} class="ff-columns__panel" hidden={!open}>
                {item.content}
              </div>
            </section>
            {next !== undefined && (
              // biome-ignore lint/a11y/useSemanticElements: a focusable splitter has no native element
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={resizeLabel(item.label, labelOf(next))}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((weight / totalWeight) * 100)}
                tabIndex={0}
                class="ff-columns__separator"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  const { fractions, total } = measure();
                  drag.current = {
                    startX: event.clientX,
                    start: fractions,
                    left: item.id,
                    right: next,
                    total,
                  };
                  setSizes(fractions);
                }}
                onPointerMove={(event) => {
                  const state = drag.current;
                  if (!state) return;
                  apply(
                    state.start,
                    state.total,
                    state.left,
                    state.right,
                    (event.clientX - state.startX) * (rtl ? -1 : 1),
                  );
                }}
                onPointerUp={() => {
                  drag.current = undefined;
                }}
                onPointerCancel={() => {
                  drag.current = undefined;
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                  event.preventDefault();
                  const { fractions, total } = measure();
                  const direction = (event.key === 'ArrowLeft' ? -1 : 1) * (rtl ? -1 : 1);
                  apply(fractions, total, item.id, next, direction * KEY_STEP * total);
                }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
