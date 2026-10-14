import type { ComponentChildren } from 'preact';
import { useEffect, useId, useState } from 'preact/hooks';
import { loadLayout, parseIds, saveLayout } from './persist';
import { ScrollShadow } from './ScrollShadow';
import { transition } from './transition';

export interface DockProps {
  items: readonly { id: string; label: string; content: ComponentChildren }[];
  storageKey: string;
}

export const DOCK_OPEN_EVENT = 'ff-dock-open';

export function Dock({ items, storageKey }: DockProps) {
  const base = useId();
  const ids = items.map((item) => item.id);
  const [active, setActive] = useState<string>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = loadLayout<string[]>(storageKey, (value) => {
      if (typeof value !== 'object' || value === null) return undefined;
      return parseIds((value as Record<string, unknown>).opened, ids);
    });
    setActive(saved?.[0]);
    setReady(true);
  }, []);
  useEffect(() => {
    const open = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (ids.includes(id)) setActive(id);
    };
    window.addEventListener(DOCK_OPEN_EVENT, open);
    return () => window.removeEventListener(DOCK_OPEN_EVENT, open);
  }, []);
  useEffect(() => {
    if (ready) saveLayout(storageKey, { opened: active ? [active] : [] });
  }, [ready, active, storageKey]);

  const activeIndex = ids.indexOf(active ?? '');
  return (
    <div
      class="ff-dock"
      data-active={active}
      data-edge={activeIndex === 0 ? 'start' : activeIndex === ids.length - 1 ? 'end' : undefined}
    >
      {items.map((item) => {
        const open = item.id === active;
        return (
          <section class="ff-dock__column" data-open={open} data-id={item.id} key={item.id}>
            <h2 class="ff-dock__heading">
              <button
                type="button"
                id={`${base}-${item.id}-button`}
                aria-expanded={open}
                aria-controls={`${base}-${item.id}-panel`}
                onClick={() => transition(() => setActive(open ? undefined : item.id))}
              >
                {item.label}
              </button>
            </h2>
            <div
              id={`${base}-${item.id}-panel`}
              class="ff-dock__panel"
              data-id={item.id}
              hidden={!open}
            >
              <ScrollShadow class="ff-dock__scroll">{item.content}</ScrollShadow>
            </div>
          </section>
        );
      })}
    </div>
  );
}
