import { describe, expect, it } from 'vitest';
import { mergeOutputs, slugOf } from './overview';

const face = (weight: number) =>
  `@font-face {\n  font-family: "Averia Fallback";\n  src: local("Arial");\n  font-weight: ${weight};\n}`;

describe('mergeOutputs', () => {
  it('merges fonts of one family into a single stack and drops duplicate faces', () => {
    const css = mergeOutputs(
      [
        {
          targetFamily: 'Averia',
          generic: 'serif',
          fontFaces: face(400),
          families: ['"Averia"', '"Averia Fallback"'],
        },
        {
          targetFamily: 'Averia',
          generic: 'serif',
          fontFaces: `${face(400)}\n\n${face(700)}`,
          families: ['"Averia"', '"Averia Fallback"'],
        },
      ],
      'font-size-adjust: 0.5;',
      '',
    );
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).toContain(
      'body {\n  font-family: "Averia", "Averia Fallback", serif;\n  font-size-adjust: 0.5;\n}',
    );
  });

  it('uses one class per family when the fonts differ', () => {
    const css = mergeOutputs(
      [
        {
          targetFamily: 'Alpha Sans',
          generic: 'sans-serif',
          fontFaces: '',
          families: ['"Alpha Sans"'],
        },
        { targetFamily: 'Beta', generic: 'serif', fontFaces: '', families: ['"Beta"'] },
      ],
      'font-size-adjust: 0.5;',
      '.fonts-loading {\n}',
    );
    expect(css).toContain('.alpha-sans {\n  font-family: "Alpha Sans", sans-serif;\n}');
    expect(css).toContain('.beta {\n  font-family: "Beta", serif;\n}');
    expect(css).not.toContain('font-size-adjust');
    expect(css.endsWith('.fonts-loading {\n}')).toBe(true);
  });

  it('builds safe class names', () => {
    expect(slugOf('Source Sans Pro')).toBe('source-sans-pro');
    expect(slugOf('  !!!  ')).toBe('font');
  });
});
