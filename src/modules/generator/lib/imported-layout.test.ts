import { describe, expect, it } from 'vitest';
import { layoutFromImport } from './imported-layout';

const block = {
  tag: 'p' as const,
  text: 'Hello',
  fontPx: 18,
  width: 640,
  indent: 12,
  marginTop: 0,
  marginBottom: 20,
  padX: 0,
  padY: 0,
};

describe('layoutFromImport', () => {
  it('returns nothing without blocks', () => {
    expect(layoutFromImport('https://a.test', [], 'k')).toBeUndefined();
  });

  it('maps a fixed-width box to block styling with the width as a cap', () => {
    const layout = layoutFromImport('https://a.test', [{ ...block, lineHeight: 1.5 }], 'k', 1350);
    expect(layout?.blocks[0]).toEqual({
      tag: 'p',
      text: 'Hello',
      style: {
        fontPx: 18,
        marginTop: 0,
        marginBottom: 20,
        indent: 12,
        padX: 0,
        padY: 0,
        maxWidth: 640,
        lineHeightEm: 1.5,
      },
    });
  });

  it('does not cap a box that filled the capture viewport', () => {
    const fluid = layoutFromImport('https://a.test', [{ ...block, width: 343 }], 'k', 375);
    expect(fluid?.blocks[0]?.style).not.toHaveProperty('maxWidth');
    const unknown = layoutFromImport('https://a.test', [block], 'k');
    expect(unknown?.blocks[0]?.style).not.toHaveProperty('maxWidth');
  });

  it('leaves the line height out when the page had none', () => {
    const layout = layoutFromImport('https://a.test', [block], 'k');
    expect(layout?.blocks[0]?.style).not.toHaveProperty('lineHeightEm');
  });
});
