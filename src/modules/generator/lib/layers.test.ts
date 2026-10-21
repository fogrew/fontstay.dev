import { describe, expect, it } from 'vitest';
import {
  arrangementOf,
  hasPosition,
  layersAt,
  PRESET_IDS,
  PRESETS,
  presetOf,
  visibleLayers,
} from './layers';

describe('layer presets', () => {
  it('identifies every preset from its positions', () => {
    for (const preset of PRESET_IDS) expect(presetOf(PRESETS[preset])).toBe(preset);
  });

  it('has no preset for a custom arrangement', () => {
    expect(presetOf({ web: 'full', fallback: 'ghost', plain: 'ghost' })).toBeUndefined();
  });

  it('arranges side by side as columns and the rest as one stack', () => {
    expect(arrangementOf(PRESETS.side)).toBe('columns');
    for (const preset of PRESET_IDS.filter((id) => id !== 'side')) {
      expect(arrangementOf(PRESETS[preset])).toBe('stack');
    }
  });

  it('lists the visible layers in a fixed order', () => {
    expect(visibleLayers(PRESETS.overlay)).toEqual(['web', 'fallback']);
    expect(visibleLayers(PRESETS.plain)).toEqual(['plain']);
    expect(layersAt(PRESETS.slider, 'clip')).toEqual(['fallback']);
    expect(hasPosition(PRESETS.slider, 'clip')).toBe(true);
    expect(hasPosition(PRESETS.overlay, 'clip')).toBe(false);
  });
});
