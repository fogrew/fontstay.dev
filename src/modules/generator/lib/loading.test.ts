import { describe, expect, it } from 'vitest';
import { hasSpacing, loadingCss, loadingScript } from './loading';

describe('loadingCss', () => {
  it('emits only the non-zero spacings', () => {
    expect(loadingCss({ letter: 0, word: 0 })).toBe('');
    expect(loadingCss({ letter: -0.00123, word: 0 })).toBe(
      '.fonts-loading {\n  letter-spacing: -0.0012em;\n}',
    );
    expect(loadingCss({ letter: 0.002, word: 0.05 })).toBe(
      '.fonts-loading {\n  letter-spacing: 0.002em;\n  word-spacing: 0.05em;\n}',
    );
  });

  it('treats tiny values as no spacing', () => {
    expect(hasSpacing({ letter: 0.00001, word: -0.00002 })).toBe(false);
    expect(hasSpacing({ letter: 0, word: 0.01 })).toBe(true);
  });
});

describe('loadingScript', () => {
  it('loads the font and removes the class when done', () => {
    const script = loadingScript('Source Sans Pro');
    expect(script).toContain("classList.add('fonts-loading')");
    expect(script).toContain(`document.fonts.load('1em "Source Sans Pro"')`);
    expect(script).toContain("classList.remove('fonts-loading')");
    expect(script).toContain('.then(done, done)');
  });

  it('waits for every family when there are several', () => {
    const script = loadingScript(['A', 'B']);
    expect(script).toContain(
      `Promise.all([document.fonts.load('1em "A"'), document.fonts.load('1em "B"')]).then(done, done);`,
    );
  });

  it('escapes quotes and backslashes in the family name', () => {
    const script = loadingScript('A"B\\C');
    expect(script).toContain('A\\\\"B');
    expect(() => new Function(script.replace('document.fonts.load', 'void'))).not.toThrow();
  });

  it('stays a valid script for names with line breaks and script-like text', () => {
    const script = loadingScript('x\n</script><script>alert(1)//');
    expect(() => new Function(script.replace('document.fonts.load', 'void'))).not.toThrow();
    expect(script.split('\n').length).toBe(4);
  });
});
