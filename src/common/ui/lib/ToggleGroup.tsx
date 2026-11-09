import { useEffect, useRef } from 'preact/hooks';

export interface ToggleGroupItem {
  key: string;
  label: string;
  ariaLabel?: string;
}

export interface ToggleGroupProps {
  items: readonly ToggleGroupItem[];
  selected: ReadonlySet<string>;
  label?: string;
  fill?: boolean;
  onChange: (next: Set<string>) => void;
}

export function ToggleGroup({ items, selected, label, fill = false, onChange }: ToggleGroupProps) {
  const anchor = useRef<string>();
  const drag = useRef<{ on: boolean; working: Set<string> }>();
  const swallowClick = useRef(false);
  const stop = useRef<() => void>();

  useEffect(() => () => stop.current?.(), []);

  const click = (key: string, shift: boolean) => {
    const next = new Set(selected);
    const from = items.findIndex((item) => item.key === anchor.current);
    const to = items.findIndex((item) => item.key === key);
    if (shift && from !== -1) {
      const on = selected.has(anchor.current ?? '');
      for (const item of items.slice(Math.min(from, to), Math.max(from, to) + 1)) {
        if (on) next.add(item.key);
        else next.delete(item.key);
      }
    } else if (!next.delete(key)) next.add(key);
    anchor.current = key;
    onChange(next);
  };

  const apply = (key: string) => {
    const state = drag.current;
    if (!state || state.working.has(key) === state.on) return;
    if (state.on) state.working.add(key);
    else state.working.delete(key);
    onChange(new Set(state.working));
  };

  const start = (event: MouseEvent, key: string) => {
    if (event.button !== 0 || event.shiftKey) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).focus();
    const working = new Set(selected);
    drag.current = { on: !working.has(key), working };
    swallowClick.current = true;
    anchor.current = key;
    apply(key);
    const end = () => {
      removeEventListener('mouseup', end);
      stop.current = undefined;
      drag.current = undefined;
      setTimeout(() => {
        swallowClick.current = false;
      });
    };
    stop.current = end;
    addEventListener('mouseup', end);
  };

  return (
    <fieldset
      class={
        fill
          ? 'ff-button-group ff-button-group--compact ff-button-group--fill'
          : 'ff-button-group ff-button-group--compact ff-button-group--wrap'
      }
      aria-label={label}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          class="ff-control ff-button ff-button--secondary ff-button-group__toggle"
          aria-pressed={selected.has(item.key)}
          aria-label={item.ariaLabel}
          onMouseDown={(event) => start(event, item.key)}
          onMouseEnter={(event) => {
            if (drag.current && event.buttons & 1) apply(item.key);
          }}
          onClick={(event) => {
            if (swallowClick.current) return;
            click(item.key, event.shiftKey);
          }}
        >
          {item.label}
        </button>
      ))}
    </fieldset>
  );
}
