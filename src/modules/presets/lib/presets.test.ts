import { describe, expect, it } from 'vitest';
import { osFontsDataset } from '@/modules/os-fonts';
import { cssStack, PRESET_IDS, PRESETS, presetPicks } from './presets';

const SYSTEMS = ['windows', 'macos', 'ios', 'android', 'linux', 'chromeos'] as const;

describe('presets', () => {
  it('has a unique id per preset id', () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual([...PRESET_IDS]);
  });

  it('ends every stack with a generic family of its kind', () => {
    for (const preset of PRESETS) expect(preset.stack.at(-1)).toBe(preset.kind);
  });

  it('maps each stack to preinstalled fonts of the same kind', () => {
    for (const preset of PRESETS) {
      const picks = presetPicks(preset, osFontsDataset, SYSTEMS);
      expect(Object.keys(picks).length).toBeGreaterThan(0);
      for (const ids of Object.values(picks)) {
        for (const id of ids ?? []) {
          const font = osFontsDataset.fonts.find((item) => item.id === id);
          expect(font?.category).toBe(preset.kind);
        }
      }
    }
  });

  it('picks the first stack font that a system ships', () => {
    const neo = PRESETS.find((preset) => preset.id === 'neo-grotesque');
    if (!neo) throw new Error('missing preset');
    const picks = presetPicks(neo, osFontsDataset, SYSTEMS);
    expect(picks.android?.[0]).toBe('roboto');
    expect(picks.windows?.[0]).toBe('arial');
    expect(picks.macos?.[0]).toBe('helvetica-neue');
  });

  it('quotes names with spaces only', () => {
    const preset = PRESETS.find((item) => item.id === 'humanist');
    expect(preset && cssStack(preset)).toBe(
      'Seravek, "Gill Sans Nova", Ubuntu, Calibri, "DejaVu Sans", sans-serif',
    );
  });
});
