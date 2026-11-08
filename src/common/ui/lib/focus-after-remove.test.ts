import { describe, expect, it } from 'vitest';
import { neighbourAfterRemoval } from './focus-after-remove';

describe('neighbourAfterRemoval', () => {
  it('prefers the next item', () => {
    expect(neighbourAfterRemoval([1, 2, 3], 2)).toBe(3);
    expect(neighbourAfterRemoval([1, 2, 3], 1)).toBe(2);
  });

  it('falls back to the previous item for the last one', () => {
    expect(neighbourAfterRemoval([1, 2, 3], 3)).toBe(2);
  });

  it('returns nothing when the list becomes empty or the item is unknown', () => {
    expect(neighbourAfterRemoval([1], 1)).toBeUndefined();
    expect(neighbourAfterRemoval([1, 2], 9)).toBeUndefined();
  });
});
