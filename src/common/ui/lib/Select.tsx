import type { ComponentChildren } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: ComponentChildren;
}

export interface SelectProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  disabled?: boolean;
  hideLabel?: boolean;
  compact?: boolean;
  onChange: (value: string) => void;
}

const TYPEAHEAD_MS = 600;

export function Select({
  label,
  value,
  options,
  disabled,
  hideLabel,
  compact,
  onChange,
}: SelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [box, setBox] = useState<{ left: number; top: number; width: number }>();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const typed = useRef({ text: '', at: 0 });
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex];

  const step = (from: number, direction: 1 | -1) => {
    for (let index = from + direction; index >= 0 && index < options.length; index += direction) {
      if (!options[index]?.disabled) return index;
    }
    return from;
  };
  const edge = (direction: 1 | -1) => (direction === 1 ? step(-1, 1) : step(options.length, -1));

  const show = (index = selectedIndex) => {
    const rect = button.current?.getBoundingClientRect();
    if (rect) setBox({ left: rect.left, top: rect.bottom, width: rect.width });
    setActive(index);
    setOpen(true);
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && !option.disabled) onChange(option.value);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const hide = () => setOpen(false);
    const dismiss = (event: Event) => {
      const target = event.target as Node;
      if (target === document || target.contains?.(button.current)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    window.addEventListener('resize', hide);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', hide);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-o${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  const onKeyDown = (event: KeyboardEvent) => {
    const { key } = event;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(key)) {
        event.preventDefault();
        show();
      } else if (key === 'Home' || key === 'End') {
        event.preventDefault();
        show(edge(key === 'Home' ? 1 : -1));
      }
      return;
    }
    if (key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault();
      setActive(step(active, key === 'ArrowDown' ? 1 : -1));
    } else if (key === 'Home' || key === 'End') {
      event.preventDefault();
      setActive(edge(key === 'Home' ? 1 : -1));
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    } else if (key === 'Tab') {
      choose(active);
    } else if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      typed.current.text =
        now - typed.current.at > TYPEAHEAD_MS
          ? key.toLowerCase()
          : typed.current.text + key.toLowerCase();
      typed.current.at = now;
      const from = typed.current.text.length === 1 ? active + 1 : active;
      const order = [...options.keys()];
      const rotated = [
        ...order.slice(from % options.length),
        ...order.slice(0, from % options.length),
      ];
      const found = rotated.find(
        (index) =>
          !options[index]?.disabled &&
          options[index]?.label.toLowerCase().startsWith(typed.current.text),
      );
      if (found !== undefined) setActive(found);
    }
  };

  return (
    <div class="ff-field ff-select" data-compact={compact ? 'true' : undefined} ref={root}>
      <span id={`${id}-label`} class={hideLabel ? 'ff-sr-only' : undefined}>
        {label}
      </span>
      <button
        ref={button}
        type="button"
        id={id}
        class="ff-input ff-select__button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-labelledby={`${id}-label`}
        data-value={value}
        aria-activedescendant={open ? `${id}-o${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        {selected?.icon}
        <span class="ff-select__value">{selected?.label}</span>
      </button>
      {open && box && (
        <div
          id={`${id}-list`}
          class="ff-select__list"
          role="listbox"
          aria-labelledby={`${id}-label`}
          style={{ left: `${box.left}px`, top: `${box.top}px`, minWidth: `${box.width}px` }}
        >
          {options.map((option, index) => (
            // biome-ignore lint/a11y/useFocusableInteractive lint/a11y/useKeyWithClickEvents: focus stays on the combobox (aria-activedescendant)
            <div
              key={option.value}
              id={`${id}-o${index}`}
              data-value={option.value}
              role="option"
              aria-selected={index === selectedIndex}
              aria-disabled={option.disabled ? true : undefined}
              data-active={index === active ? 'true' : undefined}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                choose(index);
                button.current?.focus();
              }}
            >
              {option.icon}
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
