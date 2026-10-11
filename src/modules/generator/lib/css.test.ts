import { describe, expect, it } from 'vitest';
import { fallbackRule } from './css';

describe('fallbackRule', () => {
  it('wraps the font-family in a body rule', () => {
    expect(fallbackRule('font-family: "A", sans-serif;', '')).toBe(
      'body {\n  font-family: "A", sans-serif;\n}',
    );
  });

  it('indents the Safari strategy inside the same rule', () => {
    expect(fallbackRule('font-family: "A";', '/* note */\nline-height: 1.4;')).toBe(
      'body {\n  font-family: "A";\n  /* note */\n  line-height: 1.4;\n}',
    );
  });
});
