import { describe, expect, it } from 'vitest';
import { codePointLabel, missingCharacters, textRuns } from './missing';

const latin = Array.from({ length: 95 }, (_, index) => 0x20 + index);

describe('textRuns', () => {
  it('splits the text into covered and missing runs', () => {
    expect(textRuns('ab ☃☃ cd', latin)).toEqual([
      { text: 'ab ', covered: true },
      { text: '☃☃', covered: false },
      { text: ' cd', covered: true },
    ]);
  });

  it('treats spaces and combining marks as covered', () => {
    expect(textRuns('á b', latin)).toEqual([{ text: 'á b', covered: true }]);
  });

  it('keeps astral characters whole', () => {
    expect(textRuns('a😀', latin)).toEqual([
      { text: 'a', covered: true },
      { text: '😀', covered: false },
    ]);
  });

  it('is empty for empty text', () => {
    expect(textRuns('', latin)).toEqual([]);
  });
});

describe('missingCharacters', () => {
  it('lists each missing character once', () => {
    expect(missingCharacters(textRuns('☃a☃😀', latin))).toEqual(['☃', '😀']);
  });
});

describe('codePointLabel', () => {
  it('pads the code point', () => {
    expect(codePointLabel('☃')).toBe('U+2603');
    expect(codePointLabel('A')).toBe('U+0041');
    expect(codePointLabel('😀')).toBe('U+1F600');
  });
});
