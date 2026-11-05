import type { ComponentChildren } from 'preact';
import { useId, useRef, useState } from 'preact/hooks';

export interface TabsProps {
  label: string;
  items: readonly { id: string; label: string; content: ComponentChildren }[];
}

export function Tabs({ label, items }: TabsProps) {
  const id = useId();
  const [selected, setSelected] = useState(items[0]?.id);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const active = items.some((item) => item.id === selected) ? selected : items[0]?.id;
  return (
    <div class="ff-tabs">
      <div role="tablist" aria-label={label} class="ff-tabs__list">
        {items.map((item, index) => (
          <button
            class="ff-tabs__tab ff-control"
            key={item.id}
            ref={(element) => {
              if (element) buttons.current.set(item.id, element);
              else buttons.current.delete(item.id);
            }}
            id={`${id}-tab-${index}`}
            type="button"
            role="tab"
            aria-selected={item.id === active}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={item.id === active ? 0 : -1}
            onClick={() => setSelected(item.id)}
            onKeyDown={(event) => {
              let next: number;
              if (event.key === 'ArrowRight') next = (index + 1) % items.length;
              else if (event.key === 'ArrowLeft') next = (index + items.length - 1) % items.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = items.length - 1;
              else return;
              event.preventDefault();
              const nextItem = items[next];
              if (nextItem) {
                setSelected(nextItem.id);
                buttons.current.get(nextItem.id)?.focus();
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {/* biome-ignore-start lint/a11y/noNoninteractiveTabindex: APG requires focusable tab panels. */}
      {items.map((item, index) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          tabIndex={0}
          hidden={item.id !== active}
          class="ff-tabs__panel"
        >
          {item.content}
        </div>
      ))}
      {/* biome-ignore-end lint/a11y/noNoninteractiveTabindex: Keep the exception limited to tab panels. */}
    </div>
  );
}
