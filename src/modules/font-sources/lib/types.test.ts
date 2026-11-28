import { describe, expect, it } from 'vitest';
import { localeScript, localeScriptName, localeScriptPoint, locales } from '@/common/i18n';
import { defaultSubsets, type FontFamily, searchFamilies } from './types';

const family = (name: string, subsets: string[]): FontFamily => ({
  id: name,
  name,
  category: 'Sans Serif',
  subsets,
  styles: ['400'],
  license: 'OFL-1.1',
});

describe('locale script', () => {
  it('has no extra script for English and the basic-Latin locales', () => {
    for (const locale of ['en', 'es', 'pt']) {
      expect(localeScript(locale)).toBeUndefined();
      expect(localeScriptPoint(locale)).toBeUndefined();
      expect(localeScriptName(locale)).toBe('');
    }
  });

  it('names the script of every other locale', () => {
    for (const locale of locales.filter((item) => !['en', 'es', 'pt'].includes(item))) {
      expect(localeScript(locale)).toBeDefined();
      expect(localeScriptName(locale)).not.toBe('');
    }
  });

  it('preselects the script after Latin only when the family has it', () => {
    expect(defaultSubsets(['cyrillic', 'latin'], 'cyrillic')).toEqual(['latin', 'cyrillic']);
    expect(defaultSubsets(['latin'], 'cyrillic')).toEqual(['latin']);
    expect(defaultSubsets(['cyrillic', 'latin'])).toEqual(['latin']);
    expect(defaultSubsets(['arabic'], 'arabic')).toEqual(['arabic']);
  });

  it('puts an exact name first, then families with the script, before the limit', () => {
    const families = [
      family('Open Sans Condensed', ['latin']),
      family('Open Sans', ['latin']),
      family('Open Serif', ['latin', 'cyrillic']),
    ];
    const names = (preferred?: string) =>
      searchFamilies(families, 'open sans', '', 2, preferred).map((item) => item.name);
    expect(names('cyrillic')).toEqual(['Open Sans', 'Open Sans Condensed']);
    expect(searchFamilies(families, 'open', '', 1, 'cyrillic')[0]?.name).toBe('Open Serif');
    expect(searchFamilies(families, 'open', '', 1)[0]?.name).toBe('Open Sans Condensed');
  });
});
