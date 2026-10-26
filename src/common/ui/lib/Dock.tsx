import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { loadLayout, parseIds, saveLayout } from './persist';
import { ScrollShadow } from './ScrollShadow';
import { transition } from './transition';

export interface DockProps {
  items: readonly { id: string; label: string; content: ComponentChildren }[];
  storageKey: string;
  nextLabel: (label: string) => string;
}

export const DOCK_OPEN_EVENT = 'ff-dock-open';

export interface DockOpenDetail {
  id: string;
  focus?: boolean;
}

const FLOATING_PANELS = '(min-width: 64rem)';
const KEEP_OPEN_SELECTOR = '.ff-dock, [role="listbox"], [role="dialog"], .ff-popover';

export function Dock({ items, storageKey, nextLabel }: DockProps) {
  const base = useId();
  const ids = items.map((item) => item.id);
  const [active, setActive] = useState<string>();
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);

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
      const { detail } = event as CustomEvent<string | DockOpenDetail>;
      const { id, focus } = typeof detail === 'string' ? { id: detail, focus: false } : detail;
      if (!ids.includes(id)) return;
      transition(() => setActive(id));
      if (focus)
        root.current?.querySelector<HTMLElement>(`#${CSS.escape(`${base}-${id}-button`)}`)?.focus();
    };
    window.addEventListener(DOCK_OPEN_EVENT, open);
    return () => window.removeEventListener(DOCK_OPEN_EVENT, open);
  }, []);
  useEffect(() => {
    if (ready) saveLayout(storageKey, { opened: active ? [active] : [] });
  }, [ready, active, storageKey]);

  useEffect(() => {
    const element = root.current;
    if (!element || !active) return;
    const measureRoom = () => {
      const panel = element.querySelector<HTMLElement>('.ff-dock__panel:not([hidden])');
      if (!panel) return;
      const room = window.innerHeight - panel.getBoundingClientRect().top;
      element.style.setProperty('--ff-dock-room', `${Math.max(0, Math.floor(room))}px`);
    };
    const close = (event: PointerEvent) => {
      if (!window.matchMedia(FLOATING_PANELS).matches) return;
      if (event.target instanceof Element && event.target.closest(KEEP_OPEN_SELECTOR)) return;
      transition(() => setActive(undefined));
    };
    measureRoom();
    window.addEventListener('scroll', measureRoom, { passive: true });
    window.addEventListener('resize', measureRoom);
    document.addEventListener('pointerdown', close);
    return () => {
      window.removeEventListener('scroll', measureRoom);
      window.removeEventListener('resize', measureRoom);
      document.removeEventListener('pointerdown', close);
    };
  }, [active]);

  const activeIndex = ids.indexOf(active ?? '');
  return (
    <div
      ref={root}
      class="ff-dock"
      data-active={active}
      data-edge={activeIndex === 0 ? 'start' : activeIndex === ids.length - 1 ? 'end' : undefined}
    >
      {items.map((item, index) => {
        const open = item.id === active;
        const next = items[index + 1];
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
