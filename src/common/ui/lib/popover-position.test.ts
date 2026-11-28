import { describe, expect, it } from 'vitest';
import { popoverPosition } from './popover-position';

const viewport = { width: 400, height: 600 };
const panel = { width: 200, height: 100 };
const anchor = (left: number, top: number) => ({
  left,
  right: left + 24,
  top,
  bottom: top + 24,
});

describe('popoverPosition', () => {
  it('opens below the button in the preferred direction', () => {
    expect(popoverPosition(anchor(40, 50), panel, viewport, false)).toMatchObject({
      left: 40,
      top: 78,
    });
    expect(popoverPosition(anchor(300, 50), panel, viewport, true).left).toBe(124);
  });

  it('flips to the other side at a viewport edge', () => {
    expect(popoverPosition(anchor(350, 50), panel, viewport, false).left).toBe(174);
    expect(popoverPosition(anchor(10, 50), panel, viewport, true).left).toBe(10);
  });

  it('stays inside the viewport when neither side fits', () => {
    const wide = { width: 380, height: 100 };
    expect(popoverPosition(anchor(200, 50), wide, viewport, false).left).toBe(20);
    expect(popoverPosition(anchor(200, 50), wide, viewport, true).left).toBe(0);
  });

  it('opens above the button when there is more room there', () => {
    expect(popoverPosition(anchor(40, 540), panel, viewport, false)).toEqual({
      left: 40,
      top: 436,
      room: 532,
    });
  });

  it('limits a tall panel to the room on the larger side', () => {
    const tall = { width: 200, height: 900 };
    expect(popoverPosition(anchor(40, 100), tall, viewport, false)).toMatchObject({
      top: 128,
      room: 468,
    });
    expect(popoverPosition(anchor(40, 500), tall, viewport, false)).toMatchObject({
      top: 4,
      room: 492,
    });
  });
});
