import type { ComponentChildren } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { popoverPosition } from './popover-position';

export interface PopoverProps {
  label: string;
  badge?: string | number | undefined;
  align?: 'start' | 'end';
  compact?: boolean;
  info?: boolean;
  disabled?: boolean;
  children: ComponentChildren;
}

export function Popover({
  label,
  badge,
  align = 'start',
  compact = false,
  info = false,
  disabled = false,
  children,
}: PopoverProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLFieldSetElement>(null);
  useLayoutEffect(() => {
    const el = panel.current;
    const anchor = button.current;
    if (!open || disabled || !el || !anchor) return;
    if (CSS.supports('(position-area: block-end) and (anchor-scope: --ff-popover)')) return;
    const place = (event?: Event) => {
      if (event?.type === 'scroll' && el.contains(event.target as Node)) return;
      el.style.left = '0px';
      el.style.top = '0px';
      const origin = el.getBoundingClientRect();
      const rtl = getComputedStyle(el).direction === 'rtl';
      const { left, top, room } = popoverPosition(
        anchor.getBoundingClientRect(),
        { width: origin.width, height: el.offsetHeight - el.clientHeight + el.scrollHeight },
        { width: document.documentElement.clientWidth, height: innerHeight },
        rtl !== (align === 'end'),
      );
      el.style.left = `${left - origin.left}px`;
      el.style.top = `${top - origin.top}px`;
      el.style.setProperty('--ff-popover-room', `${room}px`);
    };
    place();
    const observer = new ResizeObserver(() => place());
    observer.observe(el);
    addEventListener('resize', place);
    addEventListener('scroll', place, true);
    return () => {
      observer.disconnect();
      removeEventListener('resize', place);
      removeEventListener('scroll', place, true);
    };
  }, [open, disabled, align]);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div class={info ? 'ff-popover ff-popover--info' : 'ff-popover'} data-align={align} ref={root}>
      <button
        ref={button}
        type="button"
        class={
          compact
            ? 'ff-control ff-button ff-button--secondary ff-popover__button ff-popover__button--compact'
            : 'ff-control ff-button ff-button--secondary ff-popover__button'
        }
        aria-expanded={open}
        aria-label={badge ? `${label} (${badge})` : label}
        title={compact || info ? label : undefined}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen(!open)}
      >
        {info ? <span aria-hidden="true">i</span> : !compact && label}
        {badge !== undefined && badge !== 0 && <span class="ff-popover__badge">{badge}</span>}
      </button>
      <fieldset ref={panel} id={id} class="ff-popover__panel" hidden={!open || disabled}>
        <legend class="ff-sr-only">{label}</legend>
        {children}
      </fieldset>
    </div>
  );
}
