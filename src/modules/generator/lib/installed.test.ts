import { describe, expect, it } from 'vitest';
import { isInstalled, type Measure } from './installed';

const widths: Record<string, number> = { monospace: 100, serif: 120, 'sans-serif': 130 };

function measureWith(installed: string[]): Measure {
  return (family) => {
    const [first, base] = family.includes(',') ? family.split(', ') : [undefined, family];
    const name = first ? JSON.parse(first) : undefined;
    return name && installed.includes(name) ? 200 : (widths[base ?? ''] ?? 0);
  };
}

describe('isInstalled', () => {
  it('detects a font whose width differs from every generic family', () => {
    expect(isInstalled(['Arial'], measureWith(['Arial']))).toBe(true);
  });

  it('treats a missing font as the generic fallback', () => {
    expect(isInstalled(['Roboto', 'Roboto-Regular'], measureWith(['Arial']))).toBe(false);
  });

  it('accepts any of the local names', () => {
    expect(isInstalled(['Arial', 'ArialMT'], measureWith(['ArialMT']))).toBe(true);
  });
});
