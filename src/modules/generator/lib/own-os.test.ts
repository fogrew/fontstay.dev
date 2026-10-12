import { describe, expect, it } from 'vitest';
import { detectOs } from './own-os';

const chrome = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

describe('detectOs', () => {
  it('recognises the desktop systems', () => {
    expect(detectOs({ userAgent: chrome, platform: 'Win32' })).toBe('windows');
    expect(detectOs({ userAgent: chrome, platform: 'MacIntel' })).toBe('macos');
    expect(detectOs({ userAgent: chrome, platform: 'Linux x86_64' })).toBe('linux');
    expect(detectOs({ userAgent: chrome, platform: 'Linux x86_64', uaPlatform: 'Chrome OS' })).toBe(
      'chromeos',
    );
  });

  it('recognises the mobile systems, including iPadOS posing as a Mac', () => {
    expect(detectOs({ userAgent: `${chrome} Android 14`, platform: 'Linux armv8l' })).toBe(
      'android',
    );
    expect(detectOs({ userAgent: 'iPhone', platform: 'iPhone' })).toBe('ios');
    expect(detectOs({ userAgent: chrome, platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios');
  });

  it('returns nothing for an unknown system', () => {
    expect(detectOs({ userAgent: 'curl', platform: '' })).toBeUndefined();
  });
});
