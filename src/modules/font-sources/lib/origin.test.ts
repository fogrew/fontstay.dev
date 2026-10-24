import { describe, expect, it } from 'vitest';
import { FontSourceError } from './download';
import { downloadOrigin, sameOrigin } from './origin';

const origin = { source: 'google', family: 'Open Sans', style: '400', subset: 'latin' } as const;

describe('font origins', () => {
  it('compares every field', () => {
    expect(sameOrigin(origin, { ...origin })).toBe(true);
    expect(sameOrigin(origin, { ...origin, subset: 'cyrillic' })).toBe(false);
  });

  it('refuses a family, style or subset that the catalog does not list', async () => {
    for (const bad of [
      { ...origin, family: 'No Such Family' },
      { ...origin, style: '123' },
      { ...origin, subset: 'nope' },
    ]) {
      await expect(downloadOrigin(bad)).rejects.toBeInstanceOf(FontSourceError);
    }
  });
});
