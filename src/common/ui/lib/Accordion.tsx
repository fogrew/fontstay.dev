import { type ComponentChildren, Fragment } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { loadLayout, parseIds, parseSizes, saveLayout } from './persist';
import { transition } from './transition';

export interface AccordionProps {
  items: readonly {
    id: string;
    label: string;
    content: ComponentChildren;
    open?: boolean;
    keep?: boolean;
  }[];
  resizeLabel: (above: string, below: string) => string;
  storageKey?: string;
}

type Sizes = Record<string, number>;

interface Drag {
  startY: number;
  start: Sizes;
  above: string;
  below: string;
  total: number;
}

const MIN_PANEL_PX = 72;
const KEY_STEP = 0.03;

function Splitter({
  label,
  value,
  onStart,
  onMove,
  onEnd,
  onNudge,
}: {
  label: string;
  value: number;
  onStart: (clientY: number) => void;
  onMove: (clientY: number) => void;
  onEnd: () => void;
  onNudge: (direction: number) => void;
}) {
  // biome-ignore-start lint/a11y/useSemanticElements: a focusable splitter has no native element
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      tabIndex={0}
      class="ff-accordion__separator"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onStart(event.clientY);
      }}
      onPointerMove={(event) => onMove(event.clientY)}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        onNudge(event.key === 'ArrowUp' ? -1 : 1);
      }}
    />
  );
  // biome-ignore-end lint/a11y/useSemanticElements: a focusable splitter has no native element
}

export function Accordion({ items, resizeLabel, storageKey }: AccordionProps) {
  const base = useId();
  const [closed, setClosed] = useState<ReadonlySet<string>>(
    () => new Set(items.filter((item) => item.open === false).map((item) => item.id)),
  );
  const [sizes, setSizes] = useState<Sizes>({});
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!storageKey) return;
    const ids = items.map((item) => item.id);
    const saved = loadLayout(storageKey, (value) => {
      if (typeof value !== 'object' || value === null) return undefined;
      const record = value as Record<string, unknown>;
      return { sizes: parseSizes(record.sizes, ids), closed: parseIds(record.closed, ids) };
    });
    if (saved) {
      if (saved.sizes) setSizes(saved.sizes);
      setClosed(new Set(saved.closed));
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (storageKey && ready) saveLayout(storageKey, { sizes, closed: [...closed] });
  }, [storageKey, ready, sizes, closed]);
  const elements = useRef(new Map<string, HTMLElement>());
  const drag = useRef<Drag>();

  const toggle = (id: string) =>
    transition(() => {
      setSizes({});
      setClosed((current) => {
        const next = new Set(current);
        if (!next.delete(id)) next.add(id);
        return next;
      });
    });

  const openIds = items.filter((item) => !closed.has(item.id)).map((item) => item.id);

  const measure = () => {
    const heights = openIds.map(
      (id) => elements.current.get(id)?.getBoundingClientRect().height ?? 0,
    );
    const total = heights.reduce((sum, height) => sum + height, 0) || 1;
    const fractions: Sizes = Object.fromEntries(
      openIds.map((id, index) => [id, (heights[index] ?? 0) / total]),
    );
    return { fractions, total };
  };

  const apply = (start: Sizes, total: number, above: string, below: string, delta: number) => {
    const min = MIN_PANEL_PX / total;
    const first = start[above] ?? 0;
    const second = start[below] ?? 0;
    const bounded = Math.min(Math.max(delta, min - first), second - min);
    setSizes({ ...start, [above]: first + bounded, [below]: second - bounded });
  };

  const labelOf = (id: string) => items.find((item) => item.id === id)?.label ?? id;

  return (
    <div class="ff-accordion">
      {items.map((item) => {
        const open = !closed.has(item.id);
        const position = openIds.indexOf(item.id);
        const below = open ? openIds[position + 1] : undefined;
        const fraction = sizes[item.id];
        return (
          <Fragment key={item.id}>
            <section
              class="ff-accordion__item"
              data-open={open}
              data-id={item.id}
              data-keep={item.keep ? 'true' : undefined}
              ref={(element) => {
                if (element) elements.current.set(item.id, element);
                else elements.current.delete(item.id);
              }}
              style={open && fraction !== undefined ? { flex: `${fraction} 1 0` } : undefined}
            >
              <h2 class="ff-accordion__heading">
                <button
                  type="button"
                  id={`${base}-${item.id}-button`}
                  aria-expanded={open}
                  aria-controls={`${base}-${item.id}-panel`}
                  onClick={() => toggle(item.id)}
                >
                  {item.label}
                </button>
              </h2>
              {/* biome-ignore-start lint/a11y/noNoninteractiveTabindex: keyboard users scroll the panel */}
              <div
                id={`${base}-${item.id}-panel`}
                class="ff-accordion__panel"
                tabIndex={0}
                hidden={!open}
              >
                {item.content}
              </div>
              {/* biome-ignore-end lint/a11y/noNoninteractiveTabindex: keyboard users scroll the panel */}
            </section>
            {below !== undefined && (
              <Splitter
                label={resizeLabel(item.label, labelOf(below))}
                value={sizes[item.id] ?? measure().fractions[item.id] ?? 0}
                onStart={(clientY) => {
                  const { fractions, total } = measure();
                  drag.current = {
                    startY: clientY,
                    start: fractions,
                    above: item.id,
                    below,
                    total,
                  };
                  setSizes(fractions);
                }}
                onMove={(clientY) => {
                  const state = drag.current;
                  if (!state) return;
                  apply(
                    state.start,
                    state.total,
                    state.above,
                    state.below,
                    (clientY - state.startY) / state.total,
                  );
                }}
                onEnd={() => {
                  drag.current = undefined;
                }}
                onNudge={(direction) => {
                  const { fractions, total } = measure();
                  const start = Object.keys(sizes).length > 0 ? sizes : fractions;
                  apply(start, total, item.id, below, direction * KEY_STEP);
                }}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
