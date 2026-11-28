import type { ComponentChildren } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './Icon';
import { loadLayout, parseIds, saveLayout } from './persist';
import { ScrollShadow } from './ScrollShadow';
import { transition } from './transition';
import { useDockTop } from './use-dock-top';

export interface DockProps {
  items: readonly {
    id: string;
    label: string;
    content: ComponentChildren;
    clientOnly?: boolean;
    icon?: ComponentChildren;
    footer?: ComponentChildren;
  }[];
  storageKey: string;
  id?: string;
  defaultOpen?: string;
  nextLabel: (label: string) => string;
  backLabel: string;
  onChange?: (id: string | undefined) => void;
}

export const DOCK_OPEN_EVENT = 'ff-dock-open';

export interface DockOpenDetail {
  id: string | null;
  focus?: boolean;
  persist?: boolean;
}

const DESKTOP_LAYOUT = '(min-width: 64rem)';

export function Dock({
  items,
  storageKey,
  id,
  defaultOpen,
  nextLabel,
  backLabel,
  onChange,
}: DockProps) {
  const base = useId();
  const ids = items.map((item) => item.id);
  const [active, setActive] = useState<string | undefined>(defaultOpen);
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const skippedRestore = useRef(false);
  const transient = useRef<{ id: string | undefined } | undefined>(undefined);
  const [focusRequest, setFocusRequest] = useState<{ id: string }>();

  useEffect(() => {
    const saved = loadLayout<string[]>(storageKey, (value) => {
      if (typeof value !== 'object' || value === null) return undefined;
      const { opened } = value as Record<string, unknown>;
      return Array.isArray(opened) ? parseIds(opened, ids) : undefined;
    });
    const first = saved ? saved[0] : defaultOpen;
    const skip = items.find((item) => item.id === first)?.clientOnly;
    skippedRestore.current = !!skip && !window.matchMedia(DESKTOP_LAYOUT).matches;
    setActive(skippedRestore.current ? undefined : first);
    setReady(true);
  }, []);
  useEffect(() => {
    const open = (event: Event) => {
      const { detail } = event as CustomEvent<string | DockOpenDetail>;
      const { id, focus, persist } =
        typeof detail === 'string' ? { id: detail, focus: false, persist: true } : detail;
      if (id !== null && !ids.includes(id)) return;
      transient.current = persist === false ? { id: id ?? undefined } : undefined;
      transition(() => {
        setActive(id ?? undefined);
        if (focus && id !== null) setFocusRequest({ id });
      });
    };
    window.addEventListener(DOCK_OPEN_EVENT, open);
    return () => window.removeEventListener(DOCK_OPEN_EVENT, open);
  }, []);
  useLayoutEffect(() => {
    if (ready) onChange?.(active);
  }, [ready, active]);
  useEffect(() => {
    if (focusRequest) document.getElementById(`${base}-${focusRequest.id}-button`)?.focus();
  }, [focusRequest]);
  useEffect(() => {
    if (transient.current) {
      if (transient.current.id === active) return;
      transient.current = undefined;
    }
    if (active) skippedRestore.current = false;
    if (ready && !skippedRestore.current)
      saveLayout(storageKey, { opened: active ? [active] : [] });
  }, [ready, active, storageKey]);

  useDockTop(root);

  const go = (step: string) =>
    transition(() => {
      setActive(step);
      setFocusRequest({ id: step });
    });

  const activeIndex = ids.indexOf(active ?? '');
  return (
    <div
      ref={root}
      id={id}
      class="ff-dock"
      data-active={active}
      data-ready={ready || undefined}
      data-edge={activeIndex === 0 ? 'start' : activeIndex === ids.length - 1 ? 'end' : undefined}
    >
      {items.map((item, index) => {
        const open = item.id === active;
        const previous = items[index - 1];
        const next = items[index + 1];
        return (
          <section
            class="ff-dock__column"
            data-open={open}
            data-id={item.id}
            data-client-only={item.clientOnly || undefined}
            key={item.id}
          >
            <h2 class="ff-heading ff-dock__heading">
              <button
                class="ff-dock__toggle ff-control"
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
              {(previous || next || item.footer) && (
                <div class="ff-dock__footer">
                  {previous && (
                    <button
                      type="button"
                      class="ff-control ff-button ff-button--secondary ff-dock__back"
                      aria-label={backLabel}
                      title={backLabel}
                      onClick={() => go(previous.id)}
                    >
                      <Icon name="arrow-left" />
                    </button>
                  )}
                  {item.footer ||
                    (next && (
                      <button
                        type="button"
                        class="ff-control ff-button ff-button--primary"
                        onClick={() => go(next.id)}
                      >
                        {nextLabel(next.label)}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
