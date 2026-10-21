import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';

export interface PopoverProps {
  label: string;
  badge?: string | number | undefined;
  align?: 'start' | 'end';
  compact?: boolean;
  children: ComponentChildren;
}

export function Popover({
  label,
  badge,
  align = 'start',
  compact = false,
  children,
}: PopoverProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
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
    <div class="ff-popover" data-align={align} ref={root}>
      <button
        ref={button}
        type="button"
        class="ff-button ff-button--secondary ff-popover__button"
        aria-expanded={open}
        aria-label={badge ? `${label} (${badge})` : label}
        title={compact ? label : undefined}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {!compact && label}
        {badge !== undefined && badge !== 0 && <span class="ff-popover__badge">{badge}</span>}
      </button>
      <fieldset id={id} class="ff-popover__panel" hidden={!open}>
        <legend class="ff-sr-only">{label}</legend>
        {children}
      </fieldset>
    </div>
  );
}
