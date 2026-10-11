import type { ComponentChildren } from 'preact';
import { useId, useState } from 'preact/hooks';

export interface AccordionProps {
  items: readonly {
    id: string;
    label: string;
    content: ComponentChildren;
    open?: boolean;
  }[];
}

export function Accordion({ items }: AccordionProps) {
  const base = useId();
  const [closed, setClosed] = useState<ReadonlySet<string>>(
    () => new Set(items.filter((item) => item.open === false).map((item) => item.id)),
  );
  const toggle = (id: string) =>
    setClosed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  return (
    <div class="ff-accordion">
      {items.map((item) => {
        const open = !closed.has(item.id);
        return (
          <section key={item.id} class="ff-accordion__item" data-open={open}>
            <h2 class="ff-accordion__heading">
              <button
                type="button"
                id={`${base}-${item.id}-button`}
                aria-expanded={open}
                aria-controls={`${base}-${item.id}-panel`}
                onClick={() => toggle(item.id)}
              >
                {item.label}
              </button>
            </h2>
            {/* biome-ignore-start lint/a11y/noNoninteractiveTabindex: keyboard users scroll the panel */}
            <div
              id={`${base}-${item.id}-panel`}
              class="ff-accordion__panel"
              tabIndex={0}
              hidden={!open}
            >
              {item.content}
            </div>
            {/* biome-ignore-end lint/a11y/noNoninteractiveTabindex: keyboard users scroll the panel */}
          </section>
        );
      })}
    </div>
  );
}
