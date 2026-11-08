import { describe, expect, it } from 'vitest';
import { applyAppearance, defaults, parseAppearance } from './appearance';

describe('appearance preferences', () => {
  it('ignores invalid and unknown persisted values', () => {
    expect(parseAppearance('{')).toEqual(defaults);
    expect(parseAppearance('{"theme":"hacked","vision":"unknown","contrast":1}')).toEqual(defaults);
  });

  it('preserves independent, valid choices', () => {
    expect(parseAppearance('{"theme":"dark","vision":"tritanopia","spacing":true}')).toEqual({
      ...defaults,
      theme: 'dark',
      vision: 'tritanopia',
      spacing: true,
    });
  });

  it('removes stale attributes when choices return to defaults', () => {
    const root = { dataset: {} as Record<string, string> } as HTMLElement;
    applyAppearance(root, { ...defaults, theme: 'light', vision: 'blur', motion: true });
    expect(root.dataset).toEqual({ theme: 'light', vision: 'blur', motion: '' });
    applyAppearance(root, defaults);
    expect(root.dataset).toEqual({});
  });
});
