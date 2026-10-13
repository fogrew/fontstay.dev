import { type Box, layoutShiftScore } from '@/modules/layout-shift';

export const PROBE_WIDTHS = [360, 768, 1280] as const;
export const PROBE_HEIGHT = 800;

const BLOCKS = 'h3, h4, p, li, th, td, blockquote, figcaption, table, ol';

export interface WidthShift {
  width: number;
  score: number;
}

function boxesOf(root: Element, origin: DOMRect): Box[] {
  return [...root.querySelectorAll(BLOCKS)].map((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x - origin.x, y: rect.y - origin.y, width: rect.width, height: rect.height };
  });
}

export function measureShift(wrapper: HTMLElement, web: Element, fallback: Element): WidthShift[] {
  const previous = wrapper.style.inlineSize;
  const results: WidthShift[] = [];
  for (const width of PROBE_WIDTHS) {
    wrapper.style.inlineSize = `${width}px`;
    const origin = wrapper.getBoundingClientRect();
    const before = boxesOf(web, origin);
    const after = boxesOf(fallback, origin);
    const items = before.flatMap((box, index) => {
      const other = after[index];
      return other ? [{ before: box, after: other }] : [];
    });
    results.push({
      width,
      score: layoutShiftScore(items, { width, height: PROBE_HEIGHT }).score,
    });
  }
  wrapper.style.inlineSize = previous;
  return results;
}
