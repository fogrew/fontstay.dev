import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';

export interface CollapsibleProps {
  title: string;
  icon?: ComponentChildren;
  open: boolean;
  onToggle: (open: boolean) => void;
  before?: ComponentChildren;
  after?: ComponentChildren;
  children?: ComponentChildren;
}

export function Collapsible({
  title,
  icon,
  open,
  onToggle,
  before,
  after,
  children,
}: CollapsibleProps) {
  const id = useId();
  return (
    <div class="ff-collapsible" data-open={open}>
      <div class="ff-collapsible__head">
        {before}
        <button
          type="button"
          class="ff-collapsible__toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => onToggle(!open)}
        >
          {icon}
          {title}
        </button>
        {after}
      </div>
      <div id={id} class="ff-collapsible__body" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
