import { useEffect, useRef, useState } from 'preact/hooks';
import { loadLayout, saveLayout } from './persist';
import {
  clampWidth,
  dragState,
  parseSidebar,
  type SidebarLimits,
  type SidebarState,
} from './sidebar';
import { transition } from './transition';

export type SidebarSide = 'start' | 'end';

export interface SidebarOptions {
  name: string;
  limits: Omit<SidebarLimits, 'max'> & { max: number };
  defaultOpen: boolean;
  desktopOnly?: boolean;
}

export interface Sidebar {
  open: boolean;
  width: number;
  max: number;
  min: number;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  drag: (raw: number) => void;
  nudge: (delta: number) => void;
  commit: () => void;
  reset: () => void;
}

const DESKTOP_LAYOUT = '(min-width: 64rem)';
const VIEWPORT_SHARE = 0.45;

export function useSidebar({
  name,
  limits,
  defaultOpen,
  desktopOnly = false,
}: SidebarOptions): Sidebar {
  const key = `sidebar-${name}`;
  const [state, setState] = useState<SidebarState>({ open: defaultOpen, width: limits.initial });
  const [max, setMax] = useState(limits.max);
  const latest = useRef(state);
  const anchor = useRef<number>();
  const [loaded, setLoaded] = useState(false);
  const bounds = { min: limits.min, max, initial: limits.initial };

  useEffect(() => {
    const measure = () =>
      setMax(Math.max(limits.min, Math.min(limits.max, innerWidth * VIEWPORT_SHARE)));
    measure();
    addEventListener('resize', measure);
    return () => removeEventListener('resize', measure);
  }, []);
  useEffect(() => {
    const saved = loadLayout(key, (value) => parseSidebar(value, limits, defaultOpen));
    if (saved) {
      const next = {
        open: saved.open && (!desktopOnly || matchMedia(DESKTOP_LAYOUT).matches),
        width: saved.width,
      };
      latest.current = next;
      setState(next);
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    root.style.setProperty(
      `--ff-${name}-width`,
      `${state.open ? clampWidth(state.width, bounds) : 0}px`,
    );
    root.dataset[`sidebar${name[0]?.toUpperCase()}${name.slice(1)}`] = state.open
      ? 'open'
      : 'closed';
  }, [loaded, state, max]);

  const apply = (next: SidebarState) => {
    anchor.current = undefined;
    latest.current = next;
    setState(next);
    saveLayout(key, next);
  };
  return {
    open: state.open,
    width: state.open ? clampWidth(state.width, bounds) : 0,
    max,
    min: limits.min,
    toggle: () => {
      const next = { ...latest.current, open: !latest.current.open };
      anchor.current = undefined;
      latest.current = next;
      saveLayout(key, next);
      transition(() => setState(next));
    },
    nudge: (delta) => {
      if (latest.current.open) {
        anchor.current ??= latest.current.width;
        const next = dragState(latest.current.width + delta, bounds, anchor.current);
        latest.current = next;
        setState(next);
      } else apply({ ...latest.current, open: true });
    },
    setOpen: (open) => apply({ ...latest.current, open }),
    drag: (raw) => {
      anchor.current ??= latest.current.width;
      const next = dragState(raw, bounds, anchor.current);
      latest.current = next;
      setState(next);
    },
    commit: () => {
      anchor.current = undefined;
      saveLayout(key, latest.current);
    },
    reset: () => apply({ open: true, width: limits.initial }),
  };
}

const STEP = 16;
const BIG_STEP = 64;
const CLICK_SLOP = 4;

interface Gesture {
  x: number;
  width: number;
  moved: boolean;
}

export function Splitter({
  sidebar,
  side,
  label,
  controls,
  onClick,
}: {
  sidebar: Sidebar;
  side: SidebarSide;
  label: string;
  controls: string;
  onClick?: () => void;
}) {
  const gesture = useRef<Gesture>();
  const suppressClick = useRef(false);
  const [dragging, setDragging] = useState(false);
  const direction = (element: Element) => {
    const rtl = getComputedStyle(element).direction === 'rtl';
    return (side === 'start') !== rtl ? 1 : -1;
  };
  // biome-ignore-start lint/a11y/useSemanticElements: a focusable splitter has no native element
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-controls={sidebar.open ? controls : undefined}
      aria-valuemin={0}
      aria-valuemax={sidebar.max}
      aria-valuenow={sidebar.width}
      aria-valuetext={`${sidebar.width}px`}
      tabIndex={0}
      class="ff-splitter"
      data-dragging={dragging || undefined}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        gesture.current = { x: event.clientX, width: sidebar.width, moved: false };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const start = gesture.current;
        if (!start) return;
        const delta = event.clientX - start.x;
        if (!start.moved && Math.abs(delta) < CLICK_SLOP) return;
        start.moved = true;
        sidebar.drag(start.width + delta * direction(event.currentTarget));
      }}
      onPointerUp={() => {
        const start = gesture.current;
        gesture.current = undefined;
        setDragging(false);
        if (!start) return;
        if (start.moved) {
          suppressClick.current = true;
          sidebar.commit();
        }
      }}
      onClick={(event) => {
        if (suppressClick.current) suppressClick.current = false;
        else if (event.detail === 1) onClick?.();
      }}
      onPointerCancel={() => {
        gesture.current = undefined;
        setDragging(false);
        sidebar.commit();
      }}
      onDblClick={() => sidebar.reset()}
      onKeyDown={(event) => {
        const step = event.shiftKey ? BIG_STEP : STEP;
        const sign = direction(event.currentTarget);
        const grow = sign === 1 ? 'ArrowRight' : 'ArrowLeft';
        const shrink = sign === 1 ? 'ArrowLeft' : 'ArrowRight';
        if (event.key === grow) sidebar.nudge(step);
        else if (event.key === shrink) sidebar.nudge(-step);
        else if (event.key === 'Home') sidebar.setOpen(false);
        else if (event.key === 'End') sidebar.drag(sidebar.max);
        else if (event.key === 'Enter') sidebar.toggle();
        else return;
        event.preventDefault();
        sidebar.commit();
      }}
    />
  );
  // biome-ignore-end lint/a11y/useSemanticElements: a focusable splitter has no native element
}
