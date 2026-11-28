export interface PopoverAnchor {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface PopoverPlacement {
  left: number;
  top: number;
  room: number;
}

export function popoverPosition(
  anchor: PopoverAnchor,
  panel: { width: number; height: number },
  viewport: { width: number; height: number },
  towardLeft: boolean,
  gap = 4,
): PopoverPlacement {
  const rightward = anchor.left;
  const leftward = anchor.right - panel.width;
  const fits = (left: number) => left >= 0 && left + panel.width <= viewport.width;
  const [first, second] = towardLeft ? [leftward, rightward] : [rightward, leftward];
  const left = fits(first)
    ? first
    : fits(second)
      ? second
      : Math.max(0, Math.min(first, viewport.width - panel.width));
  const below = Math.max(0, viewport.height - anchor.bottom - gap * 2);
  const above = Math.max(0, anchor.top - gap * 2);
  const up = panel.height > below && above > below;
  const room = up ? above : below;
  const top = up ? anchor.top - gap - Math.min(panel.height, room) : anchor.bottom + gap;
  return { left, top, room };
}
