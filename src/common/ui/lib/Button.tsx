import type { ComponentChildren, JSX } from 'preact';

export type ButtonProps = JSX.IntrinsicElements['button'] & {
  children: ComponentChildren;
  variant?: 'primary' | 'secondary';
};

export function Button({
  children,
  variant = 'secondary',
  class: className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      class={`ff-control ff-button ff-button--${variant} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
