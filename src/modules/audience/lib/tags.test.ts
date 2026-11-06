import { describe, expect, it } from 'vitest';
import {
  addTag,
  addTags,
  browserOf,
  isExcluded,
  joinQuery,
  normalizeQuery,
  removeTag,
  splitQuery,
} from './tags';

describe('query tags', () => {
  it('splits and joins comma separated queries', () => {
    expect(splitQuery(' last 2  versions ,, not dead ')).toEqual(['last 2 versions', 'not dead']);
    expect(joinQuery(['defaults', 'not ie > 0'])).toBe('defaults, not ie > 0');
    expect(splitQuery('')).toEqual([]);
  });

  it('adds a tag once and removes it', () => {
    expect(addTag('defaults', '> 1%')).toBe('defaults, > 1%');
    expect(addTag('defaults, > 1%', '> 1%')).toBe('defaults, > 1%');
    expect(removeTag('defaults, > 1%', '> 1%')).toBe('defaults');
    expect(removeTag('defaults', 'defaults')).toBe('');
  });

  it('recognises exclusions and browsers', () => {
    expect(isExcluded('not dead')).toBe(true);
    expect(isExcluded('Not ie > 0')).toBe(true);
    expect(isExcluded('notable')).toBe(false);
    expect(browserOf('last 2 chrome versions')).toBe('chrome');
    expect(browserOf('not ios_saf > 0')).toBe('ios_saf');
    expect(browserOf('os windows')).toBeUndefined();
    expect(browserOf('> 1%')).toBeUndefined();
  });
});

describe('adding several tags', () => {
  it('skips duplicates', () => {
    expect(addTags('dead', ['dead', '> 1%'])).toBe('dead, > 1%');
  });

  it('replaces the opposite OS tag', () => {
    expect(addTag('defaults, not os ios', 'os ios')).toBe('defaults, os ios');
    expect(addTag('defaults, os ios, os linux', 'not os ios')).toBe(
      'defaults, os linux, not os ios',
    );
    expect(addTag('defaults, Not OS iOS', 'os ios')).toBe('defaults, os ios');
  });
});

describe('normalizeQuery', () => {
  it('adds the default browsers when only OS tags remain', () => {
    expect(normalizeQuery('os ios')).toBe('baseline widely available, os ios');
    expect(normalizeQuery('not os linux, os ios')).toBe(
      'baseline widely available, not os linux, os ios',
    );
  });

  it('keeps a query that already names browsers', () => {
    expect(normalizeQuery('defaults, os ios')).toBe('defaults, os ios');
    expect(normalizeQuery('')).toBe('');
  });

  it('lets the later of two contradicting OS tags win', () => {
    expect(normalizeQuery('defaults, os linux, os ios, not os ios')).toBe(
      'defaults, os linux, not os ios',
    );
    expect(normalizeQuery('defaults, not os ios, os ios')).toBe('defaults, os ios');
  });
});
