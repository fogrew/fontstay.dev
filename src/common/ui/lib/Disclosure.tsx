import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

export function Disclosure({
  summary,
  icon,
  children,
  open = false,
  onToggle,
  onVisible,
}: {
  summary: string;
  icon?: ComponentChildren;
  children: ComponentChildren;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  onVisible?: () => void;
}) {
  const element = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!onVisible || !element.current) return;
    if (typeof IntersectionObserver === 'undefined') {
      onVisible();
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      onVisible();
    });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  return (
    <details
      ref={element}
      class="ff-disclosure"
      open={open}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary class="ff-disclosure__summary">
        {icon}
        {summary}
      </summary>
      <div class="ff-disclosure__body">{children}</div>
    </details>
  );
}
