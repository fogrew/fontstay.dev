import { useRef } from 'preact/hooks';

export interface ToggleGroupItem {
  key: string;
  label: string;
  ariaLabel?: string;
}

export interface ToggleGroupProps {
  items: readonly ToggleGroupItem[];
  selected: ReadonlySet<string>;
  label?: string;
  onChange: (next: Set<string>) => void;
}

export function ToggleGroup({ items, selected, label, onChange }: ToggleGroupProps) {
  const anchor = useRef<string>();

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

  return (
    <fieldset
      class="ff-button-group ff-button-group--compact ff-button-group--scroll"
      aria-label={label}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          class="ff-button ff-button--secondary"
          aria-pressed={selected.has(item.key)}
          aria-label={item.ariaLabel}
          onClick={(event) => click(item.key, event.shiftKey)}
        >
          {item.label}
        </button>
      ))}
    </fieldset>
  );
}
