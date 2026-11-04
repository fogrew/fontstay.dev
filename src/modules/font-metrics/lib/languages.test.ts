import { describe, expect, it } from 'vitest';
import { languageRequirements, loadLanguageRequirements, supportedLanguages } from './languages';

const points = (text: string) => [...text].map((char) => char.codePointAt(0) as number);

describe('supportedLanguages', () => {
  const requirements = languageRequirements({
    languages: [
      ['en', 'abc'],
      ['ru', 'абв'],
      ['tr', 'iı'],
    ],
  });

  it('requires every lowercase letter and its capital', () => {
    expect(supportedLanguages(points('abcABC'), requirements)).toEqual(['en']);
    expect(supportedLanguages(points('abc'), requirements)).toEqual([]);
  });

  it('upper-cases with the language rules', () => {
    expect(supportedLanguages(points('iıİI'), requirements)).toEqual(['tr']);
    expect(supportedLanguages(points('iıII'), requirements)).toEqual([]);
  });

  it('lists several languages in data order', () => {
    const covered = points('abcABCабвАБВ');
    expect(supportedLanguages(covered, requirements)).toEqual(['en', 'ru']);
  });
});

describe('loadLanguageRequirements', () => {
  it('derives the CLDR languages from a character set', async () => {
    const requirements = await loadLanguageRequirements();
    const latin = points('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
    const codes = supportedLanguages(latin, requirements);
    expect(codes).toContain('en');
    expect(codes).not.toContain('ru');
    expect(codes).not.toContain('de');
  });
});
