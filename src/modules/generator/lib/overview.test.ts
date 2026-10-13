import { describe, expect, it } from 'vitest';
import { type FontOutput, groupFonts, mergeOutputs, slugOf } from './overview';

const face = (weight: number) =>
  `@font-face {\n  font-family: "Averia Fallback";\n  src: local("Arial");\n  font-weight: ${weight};\n}`;

const output = (overrides: Partial<FontOutput>): FontOutput => ({
  targetFamily: 'Averia',
  generic: 'serif',
  fontFaces: '',
  families: ['"Averia"', '"Averia Fallback"'],
  strategy: '',
  fileName: 'Averia-Regular.woff2',
  weight: 400,
  style: 'normal',
  ...overrides,
});

describe('groupFonts', () => {
  it('groups the files of one family and keeps their weights and styles', () => {
    const [family, ...rest] = groupFonts([
      output({}),
      output({ fileName: 'Averia-Bold.woff2', weight: 700 }),
      output({ fileName: 'Averia-Italic.woff2', style: 'italic' }),
    ]);
    expect(rest).toEqual([]);
    expect(family?.fonts).toEqual([
      { fileName: 'Averia-Regular.woff2', weight: 400, style: 'normal' },
      { fileName: 'Averia-Bold.woff2', weight: 700, style: 'normal' },
      { fileName: 'Averia-Italic.woff2', weight: 400, style: 'italic' },
    ]);
    expect(family?.families).toEqual(['"Averia"', '"Averia Fallback"']);
  });
});

describe('mergeOutputs', () => {
  it('merges fonts of one family into a single stack and drops duplicate faces', () => {
    const css = mergeOutputs(
      [
        output({ fontFaces: face(400), strategy: 'font-size-adjust: 0.5;' }),
        output({ fontFaces: `${face(400)}\n\n${face(700)}`, fileName: 'Averia-Bold.woff2' }),
      ],
      '',
    );
    expect(css.match(/@font-face/g)).toHaveLength(2);
    expect(css).toContain(
      'body {\n  font-family: "Averia", "Averia Fallback", serif;\n  font-size-adjust: 0.5;\n}',
    );
  });

  it('uses one class per family and its own strategy when the fonts differ', () => {
    const css = mergeOutputs(
      [
        output({
          targetFamily: 'Alpha Sans',
          generic: 'sans-serif',
          families: ['"Alpha Sans"'],
          strategy: 'font-size-adjust: 0.5;',
        }),
        output({ targetFamily: 'Beta', families: ['"Beta"'] }),
      ],
      '.fonts-loading {\n}',
    );
    expect(css).toContain(
      '.alpha-sans {\n  font-family: "Alpha Sans", sans-serif;\n  font-size-adjust: 0.5;\n}',
    );
    expect(css).toContain('.beta {\n  font-family: "Beta", serif;\n}');
    expect(css.endsWith('.fonts-loading {\n}')).toBe(true);
  });

  it('builds safe class names', () => {
    expect(slugOf('Source Sans Pro')).toBe('source-sans-pro');
    expect(slugOf('  !!!  ')).toBe('font');
    expect(slugOf('1Password')).toBe('font-1password');
  });
});
