import { describe, expect, it } from 'vitest';
import { messagesFor } from './messages';

describe('messagesFor', () => {
  it('fills the placeholders of the locale catalog', () => {
    expect(messagesFor('en').audience_data_date({ date: '1 May' })).toBe(
      'Browser data up to 1 May',
    );
    expect(messagesFor('ru').dock_next({ label: 'X' })).toBe('Далее: X');
  });

  it('keeps a placeholder that has no value', () => {
    expect(messagesFor('en').audience_data_date({} as { date: string })).toBe(
      'Browser data up to {date}',
    );
  });

  it('keeps both service tokens in every locale of the input hint', () => {
    for (const locale of ['en', 'ru', 'es', 'pt', 'ar', 'vi', 'th'] as const) {
      const hint = messagesFor(locale).input_hint_link({
        google: '{google}',
        fontsource: '{fontsource}',
      });
      expect(hint).toContain('{google}');
      expect(hint).toContain('{fontsource}');
    }
  });

  it('throws for a key that does not exist', () => {
    const messages = messagesFor('en') as unknown as Record<string, () => string>;
    expect(() => messages.no_such_key?.()).toThrow('Unknown message key');
  });
});
