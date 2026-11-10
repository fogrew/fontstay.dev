import { describe, expect, it } from 'vitest';
import { clampWidth, dragState, parseSidebar } from './sidebar';

const limits = { min: 200, max: 600, initial: 300 };

describe('clampWidth', () => {
  it('keeps the width inside the limits', () => {
    expect(clampWidth(50, limits)).toBe(200);
    expect(clampWidth(900, limits)).toBe(600);
    expect(clampWidth(333.4, limits)).toBe(333);
  });

  it('prefers the minimum when the maximum is smaller', () => {
    expect(clampWidth(500, { ...limits, max: 100 })).toBe(200);
  });
});

describe('dragState', () => {
  it('collapses below half of the minimum and remembers the last width', () => {
    expect(dragState(40, limits, 420)).toEqual({ open: false, width: 420 });
    expect(dragState(99, limits, 420)).toEqual({ open: false, width: 420 });
  });

  it('snaps to the minimum between collapse and minimum', () => {
    expect(dragState(100, limits, 420)).toEqual({ open: true, width: 200 });
  });

  it('follows the pointer inside the limits', () => {
    expect(dragState(450, limits, 300)).toEqual({ open: true, width: 450 });
    expect(dragState(5000, limits, 300)).toEqual({ open: true, width: 600 });
  });
});

describe('parseSidebar', () => {
  it('uses the defaults for missing or malformed data', () => {
    expect(parseSidebar(undefined, limits, false)).toEqual({ open: false, width: 300 });
    expect(parseSidebar('x', limits, true)).toEqual({ open: true, width: 300 });
    expect(parseSidebar({ open: 'yes', width: NaN }, limits, false)).toEqual({
      open: false,
      width: 300,
    });
  });

  it('restores a saved state and clamps the width', () => {
    expect(parseSidebar({ open: true, width: 450 }, limits, false)).toEqual({
      open: true,
      width: 450,
    });
    expect(parseSidebar({ open: false, width: 9000 }, limits, true)).toEqual({
      open: false,
      width: 600,
    });
  });
});
