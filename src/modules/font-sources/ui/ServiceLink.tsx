import type { ComponentChildren } from 'preact';
import type { SourceId } from '../lib/origin';

const ICONS: Record<SourceId, string> = {
  google: '/icons/google-fonts.svg',
  fontsource: '/icons/fontsource.png',
};
const HOMES: Record<SourceId, string> = {
  google: 'https://fonts.google.com/',
  fontsource: 'https://fontsource.org/fonts',
};

export function ServiceIcon({ source }: { source: SourceId }) {
  return (
    <img
      class="ff-source__icon"
      src={ICONS[source]}
      width="16"
      height="16"
      alt=""
      aria-hidden="true"
    />
  );
}

export function ServiceLink({
  source,
  children,
}: {
  source: SourceId;
  children: ComponentChildren;
}) {
  return (
    <a
      class="ff-link ff-source__service"
      href={HOMES[source]}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ServiceIcon source={source} />
      {children}
    </a>
  );
}
