import { describe, expect, it } from 'vitest';
import { FontSourceError } from './download';
import { downloadOrigin, familyPageUrl, isHandwritingOrigin, sameOrigin } from './origin';

const origin = { source: 'google', family: 'Open Sans', style: '400', subset: 'latin' } as const;

describe('font origins', () => {
  it('builds the font page URL of each source', () => {
    const family = {
      id: 'open-sans',
      name: 'Open Sans & Co',
      category: '',
      subsets: [],
      styles: [],
    };
    expect(familyPageUrl('google', family)).toBe(
      'https://fonts.google.com/specimen/Open+Sans+%26+Co',
    );
    expect(familyPageUrl('fontsource', family)).toBe('https://fontsource.org/fonts/open-sans');
  });

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

  it('treats the Handwriting category as cursive and nothing else', async () => {
    expect(await isHandwritingOrigin({ ...origin, family: 'Allison' })).toBe(true);
    expect(await isHandwritingOrigin(origin)).toBe(false);
    expect(await isHandwritingOrigin({ ...origin, family: 'No Such Family' })).toBe(false);
  });
});
