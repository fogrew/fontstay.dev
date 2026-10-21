import type { GuideId } from '../lib/guides';
import type { Preset } from '../lib/layers';

export type ToolIconName = Preset | 'xray' | 'boxes' | GuideId;

const GUIDE_LINE: Record<GuideId, number> = {
  ascender: 2.5,
  cap: 4,
  x: 7.5,
  baseline: 12,
  descender: 14.5,
};

function Shapes({ name }: { name: ToolIconName }) {
  switch (name) {
    case 'overlay':
      return (
        <>
          <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" />
          <rect x="5.5" y="5.5" width="9" height="9" rx="1.5" stroke-dasharray="2 1.5" />
        </>
      );
    case 'side':
      return (
        <>
          <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
          <path d="M8 3v10" />
        </>
      );
    case 'slider':
      return (
        <>
          <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
          <path d="M8 3v10" />
          <circle cx="8" cy="8" r="2" class="ff-tool-icon__fill" />
        </>
      );
    case 'web':
      return (
        <>
          <circle cx="8" cy="8" r="6.2" />
          <ellipse cx="8" cy="8" rx="2.6" ry="6.2" />
          <path d="M1.8 8h12.4" />
        </>
      );
    case 'fallback':
      return (
        <>
          <path d="M2 5h12M2 11h12" />
          <circle cx="6" cy="5" r="1.8" class="ff-tool-icon__fill" />
          <circle cx="10.5" cy="11" r="1.8" class="ff-tool-icon__fill" />
        </>
      );
    case 'plain':
      return <path d="M3 4h10M8 4v9" />;
    case 'xray':
      return (
        <>
          <circle cx="6.8" cy="6.8" r="4.6" />
          <path d="M10.2 10.2L14 14" />
        </>
      );
    case 'boxes':
      return (
        <>
          <rect x="1.5" y="3.5" width="13" height="9" rx="1" stroke-dasharray="2 1.5" />
          <rect x="4.5" y="6" width="3" height="4" />
          <rect x="9" y="6" width="3" height="4" />
        </>
      );
    default:
      return (
        <>
          <path d="M5 2.5V12M5 7.5Q8 6 10 7.5V12" class="ff-tool-icon__faint" />
          <path d={`M1 ${GUIDE_LINE[name]}h14`} class="ff-tool-icon__guide" data-guide={name} />
        </>
      );
  }
}

export function ToolIcon({ name }: { name: ToolIconName }) {
  return (
    <svg
      class="ff-tool-icon"
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
    >
      <Shapes name={name} />
    </svg>
  );
}
