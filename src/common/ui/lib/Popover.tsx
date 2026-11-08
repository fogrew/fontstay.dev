import type { ComponentChildren } from 'preact';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';

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
    if (!open || !panel.current || CSS.supports('position-area', 'block-end')) return;
    const place = () => {
      const el = panel.current;
      if (!el) return;
      root.current?.removeAttribute('data-flip');
      const rect = el.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      root.current?.toggleAttribute('data-flip', rect.left < 0 || rect.right > width);
    };
    place();
    addEventListener('resize', place);
    return () => removeEventListener('resize', place);
  }, [open]);
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
        class="ff-control ff-button ff-button--secondary ff-popover__button"
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
