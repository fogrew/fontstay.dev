import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { transition } from './transition';

export interface CollapsibleProps {
  title: string;
  detail?: string | undefined;
  icon?: ComponentChildren;
  open: boolean;
  toggleId?: string;
  onToggle: (open: boolean) => void;
  before?: ComponentChildren;
  after?: ComponentChildren;
  children?: ComponentChildren;
}

export function Collapsible({
  title,
  detail,
  icon,
  open,
  toggleId,
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
          class="ff-control ff-collapsible__toggle"
          aria-expanded={open}
          aria-controls={id}
          data-toggle-id={toggleId}
          onClick={() => transition(() => onToggle(!open))}
        >
          {icon}
          {title}
          {detail && <span class="ff-collapsible__detail">{detail}</span>}
        </button>
        {after}
      </div>
      <div id={id} class="ff-collapsible__body" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
