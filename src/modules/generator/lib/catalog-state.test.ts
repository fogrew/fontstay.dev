import { describe, expect, it } from 'vitest';
import { osAvailability, osFontsDataset } from '@/modules/os-fonts';
import { catalogFontState } from './per-os';
import { decodeShareState, encodeShareState } from './share';

describe('catalog fallback links', () => {
  it('round trips a named fallback and its category without selecting unsupported systems', async () => {
    const state = catalogFontState('georgia');
    if (!state) throw new Error('Georgia must be supported');
    expect(state).toMatchObject({ kind: 'serif', panel: 'inputs' });
    expect(state.style).toBeUndefined();
    expect(state.picks?.windows).toEqual(['georgia']);
    expect(state?.picks?.android).toBeUndefined();
    expect(await decodeShareState(await encodeShareState(state))).toEqual(state);
  });

  it('offers only fallbacks preinstalled on every catalogued version of each chosen system', () => {
    for (const font of osFontsDataset.fonts) {
      const state = catalogFontState(font.id);
      if (!state) continue;
      expect(state.kind).toBe(font.category);
      expect(Object.keys(state.picks ?? {})).not.toHaveLength(0);
      for (const [os, picks] of Object.entries(state.picks ?? {})) {
        expect(picks).toEqual([font.id]);
        expect(
          osAvailability(font, os as keyof typeof osFontsDataset.platforms, osFontsDataset).level,
        ).toBe('preinstalled');
      }
    }
  });

  it('does not offer an unknown font', () => {
    expect(catalogFontState('unknown-font')).toBeNull();
    expect(catalogFontState('helvetica')).toBeNull();
  });
});
