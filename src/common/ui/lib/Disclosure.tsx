import type { ComponentChildren } from 'preact';

export function Disclosure({
  summary,
  icon,
  children,
  open = false,
  onToggle,
}: {
  summary: string;
  icon?: ComponentChildren;
  children: ComponentChildren;
  open?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  return (
    <details
      class="ff-disclosure"
      open={open}
      onToggle={(event) => onToggle?.(event.currentTarget.open)}
    >
      <summary>
        {icon}
        {summary}
      </summary>
      <div>{children}</div>
    </details>
  );
}
