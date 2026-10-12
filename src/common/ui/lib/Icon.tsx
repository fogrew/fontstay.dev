import type { IconName } from './icons';

export type { IconName };

export function Icon({ name }: { name: IconName }) {
  return (
    <svg class="ff-icon" width="1em" height="1em" aria-hidden="true" focusable="false">
      <use href={`/brands.svg#${name}`} />
    </svg>
  );
}
