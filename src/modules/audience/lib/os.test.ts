import { describe, expect, it } from 'vitest';
import {
  computeOsShares,
  DEFAULT_DESKTOP_SPLIT,
  isValidSplit,
  OS_IDS,
  osOf,
  splitTotal,
} from './os';

const total = (shares: Record<string, number>) => Object.values(shares).reduce((a, b) => a + b, 0);

describe('osOf', () => {
  it('maps browsers to the systems they run on', () => {
    expect(osOf('safari 17')).toEqual(['macos']);
    expect(osOf('ios_saf 17.0-17.1')).toEqual(['ios']);
    expect(osOf('and_chr 120')).toEqual(['android']);
    expect(osOf('chrome 120')).toContain('chromeos');
    expect(osOf('firefox 120')).not.toContain('chromeos');
    expect(osOf('op_mini all')).toEqual(['other']);
    expect(osOf('unknown_browser 1')).toEqual(['other']);
  });
});

describe('computeOsShares', () => {
  it('splits desktop browsers by the desktop OS split and normalizes to 100', () => {
    const shares = computeOsShares(
      [
        { entry: 'safari 17', usage: 10 },
        { entry: 'ios_saf 17.0-17.1', usage: 30 },
        { entry: 'firefox 120', usage: 60 },
      ],
      { windows: 50, macos: 30, linux: 20, chromeos: 0 },
    );
    expect(total(shares)).toBeCloseTo(100);
    expect(shares.ios).toBeCloseTo(30);
    expect(shares.macos).toBeCloseTo(10 + 60 * 0.3);
    expect(shares.windows).toBeCloseTo(30);
    expect(shares.linux).toBeCloseTo(12);
    expect(shares.chromeos).toBe(0);
  });

  it('weighs entries equally when no usage is known', () => {
    const shares = computeOsShares(
      [
        { entry: 'ios_saf 17', usage: 0 },
        { entry: 'and_chr 120', usage: 0 },
      ],
      DEFAULT_DESKTOP_SPLIT,
    );
    expect(shares.ios).toBeCloseTo(50);
    expect(shares.android).toBeCloseTo(50);
  });

  it('returns zeros for an empty audience', () => {
    const shares = computeOsShares([], DEFAULT_DESKTOP_SPLIT);
    expect(OS_IDS.every((id) => shares[id] === 0)).toBe(true);
  });
});

describe('desktop split', () => {
  it('defaults to a valid split', () => {
    expect(splitTotal(DEFAULT_DESKTOP_SPLIT)).toBeCloseTo(100);
    expect(isValidSplit(DEFAULT_DESKTOP_SPLIT)).toBe(true);
  });

  it('rejects splits that do not sum to 100 or have bad values', () => {
    expect(isValidSplit({ ...DEFAULT_DESKTOP_SPLIT, linux: 10 })).toBe(false);
    expect(isValidSplit({ windows: 110, macos: -10, linux: 0, chromeos: 0 })).toBe(false);
    expect(isValidSplit({ ...DEFAULT_DESKTOP_SPLIT, windows: Number.NaN })).toBe(false);
  });
});
