import { describe, expect, it } from 'vitest';
import { measureEdges, measurePageEdges } from './ScrollShadow';

const box = (overrides: Partial<Parameters<typeof measureEdges>[0]> = {}) => ({
  scrollLeft: 0,
  scrollTop: 0,
  scrollWidth: 100,
  scrollHeight: 100,
  clientWidth: 100,
  clientHeight: 100,
  ...overrides,
});

describe('measureEdges', () => {
  it('shows nothing when the content fits', () => {
    expect(measureEdges(box())).toEqual({ start: false, end: false, top: false, bottom: false });
  });

  it('shows the end edge at the start of a scrollable area and the start edge at its end', () => {
    expect(measureEdges(box({ scrollWidth: 300 }))).toMatchObject({ start: false, end: true });
    expect(measureEdges(box({ scrollWidth: 300, scrollLeft: 100 }))).toMatchObject({
      start: true,
      end: true,
    });
    expect(measureEdges(box({ scrollWidth: 300, scrollLeft: 200 }))).toMatchObject({
      start: true,
      end: false,
    });
  });

  it('works for vertical scrolling and for the negative offsets of right-to-left text', () => {
    expect(measureEdges(box({ scrollHeight: 300, scrollTop: 50 }))).toMatchObject({
      top: true,
      bottom: true,
    });
    expect(measureEdges(box({ scrollWidth: 300, scrollLeft: -200 }))).toMatchObject({
      start: true,
      end: false,
    });
  });
});

describe('measurePageEdges', () => {
  const box = { top: 0, bottom: 1000 };

  it('shows nothing while both edges rest at the ends of the content', () => {
    expect(measurePageEdges(box, { top: 0 }, { bottom: 1000 })).toEqual({
      top: false,
      bottom: false,
    });
  });

  it('shows a side once its edge is stuck away from the end of the content', () => {
    expect(measurePageEdges(box, { top: 200 }, { bottom: 600 })).toEqual({
      top: true,
      bottom: true,
    });
  });
});
