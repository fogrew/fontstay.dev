import { describe, expect, it } from 'vitest';
import { scriptStackRules, uncoveredScripts } from './script-stacks';

const range = (from: number, to: number) =>
  Uint32Array.from({ length: to - from + 1 }, (_, index) => from + index);

describe('uncoveredScripts', () => {
  it('lists every script when the font has only Latin letters', () => {
    expect(uncoveredScripts(range(0x41, 0x7a))).toEqual(['arabic', 'hebrew', 'devanagari', 'thai']);
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
      ':lang(ar), :lang(fa), :lang(ur) {\n  font-family: "Segoe UI", "Tahoma", "Geeza Pro", sans-serif;\n}',
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
