import { describe, expect, it } from 'vitest';
import { faceLabel } from './face-label';

const words = { regular: 'Regular', italic: 'Italic' };

describe('faceLabel', () => {
  it('names weight and style', () => {
    expect(faceLabel({ weight: 400, italic: false }, words)).toBe('400 Regular');
    expect(faceLabel({ weight: 700, italic: true }, words)).toBe('700 Italic');
  });

  it('appends the subset when known', () => {
    expect(faceLabel({ weight: 400, italic: true, subset: 'cyrillic' }, words)).toBe(
      '400 Italic · cyrillic',
    );
  });

  it('ignores an empty subset', () => {
    expect(faceLabel({ weight: 400, italic: false, subset: '' }, words)).toBe('400 Regular');
  });
});
