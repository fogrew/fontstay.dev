import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { loadLayout, parseIds, saveLayout } from './persist';
import { ScrollShadow } from './ScrollShadow';
import { transition } from './transition';

export interface DockProps {
  items: readonly {
    id: string;
    label: string;
    content: ComponentChildren;
    clientOnly?: boolean;
    icon?: ComponentChildren;
  }[];
  storageKey: string;
  nextLabel: (label: string) => string;
}

export const DOCK_OPEN_EVENT = 'ff-dock-open';

export interface DockOpenDetail {
  id: string;
  focus?: boolean;
}

export function Dock({ items, storageKey, nextLabel }: DockProps) {
  const base = useId();
  const ids = items.map((item) => item.id);
  const [active, setActive] = useState<string>();
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const skippedRestore = useRef(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string }>();

  useEffect(() => {
    const saved = loadLayout<string[]>(storageKey, (value) => {
      if (typeof value !== 'object' || value === null) return undefined;
      return parseIds((value as Record<string, unknown>).opened, ids);
    });
    const first = saved?.[0];
    const skip = items.find((item) => item.id === first)?.clientOnly;
    skippedRestore.current = !!skip && !window.matchMedia(FLOATING_PANELS).matches;
    setActive(skippedRestore.current ? undefined : first);
    setReady(true);
  }, []);
  useEffect(() => {
    const open = (event: Event) => {
      const { detail } = event as CustomEvent<string | DockOpenDetail>;
      const { id, focus } = typeof detail === 'string' ? { id: detail, focus: false } : detail;
      if (!ids.includes(id)) return;
      transition(() => {
        setActive(id);
        if (focus) setFocusRequest({ id });
      });
    };
    window.addEventListener(DOCK_OPEN_EVENT, open);
    return () => window.removeEventListener(DOCK_OPEN_EVENT, open);
  }, []);
  useEffect(() => {
    if (focusRequest) document.getElementById(`${base}-${focusRequest.id}-button`)?.focus();
  }, [focusRequest]);
  useEffect(() => {
    if (active) skippedRestore.current = false;
    if (ready && !skippedRestore.current)
      saveLayout(storageKey, { opened: active ? [active] : [] });
  }, [ready, active, storageKey]);

  const activeIndex = ids.indexOf(active ?? '');
  return (
    <div
      ref={root}
      class="ff-dock"
      data-active={active}
      data-ready={ready || undefined}
      data-edge={activeIndex === 0 ? 'start' : activeIndex === ids.length - 1 ? 'end' : undefined}
    >
      {items.map((item, index) => {
        const open = item.id === active;
        const next = items[index + 1];
        return (
          <section
            class="ff-dock__column"
            data-open={open}
            data-id={item.id}
            data-client-only={item.clientOnly || undefined}
            key={item.id}
          >
            <h2 class="ff-dock__heading">
              <button
                type="button"
                id={`${base}-${item.id}-button`}
                aria-expanded={open}
                aria-controls={`${base}-${item.id}-panel`}
                onClick={() => transition(() => setActive(open ? undefined : item.id))}
              >
                {item.icon}
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
              {next && (
                <div class="ff-dock__footer">
                  <button
                    type="button"
                    class="ff-button ff-button--primary"
                    onClick={() => transition(() => setActive(next.id))}
                  >
                    {nextLabel(next.label)}
                  </button>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
