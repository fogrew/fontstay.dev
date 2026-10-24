import { describe, expect, it } from 'vitest';
import { localeName, pickLocale } from './locales';

describe('pickLocale', () => {
  it('matches the primary language subtag', () => {
    expect(pickLocale(['ru-RU', 'en'])).toBe('ru');
  });

  it('is case-insensitive', () => {
    expect(pickLocale(['RU'])).toBe('ru');
  });

  it('matches Arabic regional tags', () => {
    expect(pickLocale(['ar-EG', 'en'])).toBe('ar');
  });

  it('skips unsupported languages', () => {
    expect(pickLocale(['de', 'ru'])).toBe('ru');
  });

  it('falls back to the base locale', () => {
    expect(pickLocale(['de', 'fr'])).toBe('en');
    expect(pickLocale([])).toBe('en');
  });
});

describe('localeName', () => {
  it('returns the capitalized autonym', () => {
    expect(localeName('en')).toBe('English');
    expect(localeName('ru')).toBe('Русский');
    expect(localeName('ar')).toBe('العربية');
  });
});
