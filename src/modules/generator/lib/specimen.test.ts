import { describe, expect, it } from 'vitest';
import { contrastRatio, glyphAdvance, glyphsForPreview, SPECIMEN_PRESETS } from './specimen';

describe('specimen previews', () => {
  it('keeps every colour preset above WCAG AA normal-text contrast', () => {
    for (const preset of Object.values(SPECIMEN_PRESETS)) {
      expect(contrastRatio(preset.foreground, preset.background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('lists supported printable code points and looks up their advances', () => {
    const points = Uint32Array.from([10, 32, 65, 66, 0x1f600]);
    const advances = Float64Array.from([0, 200, 600, 590, 1000]);
    expect(glyphsForPreview(points)).toEqual([32, 65, 66, 0x1f600]);
    expect(glyphAdvance(points, advances, 65)).toBe(600);
    expect(glyphAdvance(points, advances, 67)).toBe(0);
  });
});
