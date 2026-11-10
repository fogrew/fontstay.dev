import { describe, expect, it } from 'vitest';
import { scriptCoverageEntries, scriptShare } from '@/modules/os-fonts';
import {
  emojiFonts,
  fontCoversScript,
  lacksEmoji,
  STACK_SCRIPTS,
  scriptStackCandidates,
  scriptStackFonts,
  scriptStackRules,
  uncoveredScripts,
} from './script-stacks';

const range = (from: number, to: number) =>
  Uint32Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe('uncoveredScripts', () => {
  it('lists every script when the font has only Latin letters', () => {
    expect(uncoveredScripts(range(0x41, 0x7a))).toEqual([...STACK_SCRIPTS]);
  });

  it('drops a script the font covers', () => {
    expect(uncoveredScripts(range(0x620, 0x64a))).not.toContain('arabic');
  });

  it('ignores a few stray letters of a script', () => {
    expect(uncoveredScripts(range(0x620, 0x62a))).toContain('arabic');
  });
});

describe('scriptStackRules', () => {
  it('puts the system fonts of the chosen systems first and ends with the generic family', () => {
    expect(scriptStackRules(['arabic'], ['windows', 'macos'], 'sans-serif')).toBe(
      ':lang(ar), :lang(fa), :lang(ur), :lang(ps), :lang(ckb), :lang(sd) {\n  font-family: "Segoe UI", "Tahoma", "Geeza Pro", sans-serif;\n}',
    );
  });

  it('lists the Android Naskh font before Noto Sans on Android', () => {
    expect(scriptStackRules(['arabic'], ['android', 'ios'], 'serif')).toContain(
      '"Noto Naskh Arabic", "Noto Sans Arabic", "Geeza Pro", serif',
    );
  });

  it('removes duplicate fonts shared between systems', () => {
    const css = scriptStackRules(['arabic'], ['android', 'linux', 'chromeos'], 'serif');
    expect(css.match(/Noto Sans Arabic/g)).toHaveLength(1);
  });

  it('emits one rule per selected script and nothing for none', () => {
    expect(scriptStackRules([], ['windows'], 'sans-serif')).toBe('');
    const css = scriptStackRules(['thai', 'hebrew'], ['windows'], 'sans-serif');
    expect(css.split('\n\n')).toHaveLength(2);
    expect(css.indexOf(':lang(he)')).toBeLessThan(css.indexOf(':lang(th)'));
  });
});

describe('emoji fonts', () => {
  it('lists the system emoji fonts of the chosen systems without repeats', () => {
    expect(emojiFonts(['windows', 'macos', 'ios'])).toEqual([
      'Segoe UI Emoji',
      'Apple Color Emoji',
    ]);
  });

  it('is empty without systems', () => {
    expect(emojiFonts([])).toEqual([]);
  });

  it('flags a font with no emoji and accepts one that has them', () => {
    expect(lacksEmoji(range(0x41, 0x7a))).toBe(true);
    expect(lacksEmoji(range(0x1f300, 0x1f330))).toBe(false);
describe('script coverage dataset', () => {
  it('has an entry for every font the stacks name that ships with a source file', () => {
    for (const entry of scriptCoverageEntries) {
      expect(entry.source.sha256).toMatch(/^[0-9a-f]{64}$/);
      for (const script of Object.keys(entry.scripts)) {
        expect(scriptShare(entry, script)).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps every verified font of a stack, and no font that fails its script', () => {
    for (const script of STACK_SCRIPTS) {
      for (const font of scriptStackCandidates(script)) {
        const covers = fontCoversScript(font, script);
        const kept = scriptStackFonts(script, [
          'windows',
          'macos',
          'ios',
          'android',
          'linux',
          'chromeos',
        ]);
        expect(kept.includes(font)).toBe(covers !== false);
      }
    }
  });

  it('knows which curated fonts do not draw a script', () => {
    expect(fontCoversScript('Arial', 'thai')).toBe(false);
    expect(fontCoversScript('Tahoma', 'thai')).toBe(true);
    expect(fontCoversScript('Malgun Gothic', 'chinese_hans')).toBe(false);
    expect(fontCoversScript('Nirmala UI', 'bengali')).toBe(true);
    expect(fontCoversScript('Noto Sans CJK JP', 'japanese')).toBe(true);
  });

  it('leaves fonts without a dataset entry in the stack', () => {
    expect(fontCoversScript('Geeza Pro', 'arabic')).toBeUndefined();
    expect(scriptStackFonts('arabic', ['macos'])).toEqual(['Geeza Pro']);
  });

  it('emits a rule for the new scripts', () => {
    expect(scriptStackRules(['korean'], ['windows', 'linux'], 'sans-serif')).toBe(
      ':lang(ko) {\n  font-family: "Malgun Gothic", "Noto Sans CJK KR", sans-serif;\n}',
    );
  });
});
