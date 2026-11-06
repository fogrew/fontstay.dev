import { describe, expect, it } from 'vitest';
import { auditSplitFaces, type FaceRule } from './split-audit';
import { SUBSETS } from './unicode-range';

const rule = (
  unicodeRange?: string,
  family = 'Inter',
  weight = '400',
  style = 'normal',
): FaceRule => ({
  family,
  weight,
  style,
  unicodeRange,
});

const googleLayout = (order: (keyof typeof SUBSETS)[]) => order.map((name) => rule(SUBSETS[name]));

describe('auditSplitFaces', () => {
  it('reports nothing for the Google Fonts layout, whatever the order', () => {
    const names = Object.keys(SUBSETS) as (keyof typeof SUBSETS)[];
    expect(auditSplitFaces(googleLayout(names))).toEqual([]);
    expect(auditSplitFaces(googleLayout([...names].reverse()))).toEqual([]);
    expect(auditSplitFaces(googleLayout(['cyrillic', 'vietnamese', 'latin-ext', 'latin']))).toEqual(
      [],
    );
  });

  it('ignores overlaps of a few code points such as shared combining marks', () => {
    expect(auditSplitFaces([rule('U+0-FF, U+304'), rule('U+100-17F, U+304, U+308')])).toEqual([]);
  });

  it('reports nothing for a single rule or rules of different families, weights and styles', () => {
    expect(auditSplitFaces([rule()])).toEqual([]);
    expect(
      auditSplitFaces([
        rule('U+20-7E', 'A'),
        rule('U+20-7E', 'B'),
        rule('U+20-7E', 'A', '700'),
        rule('U+20-7E', 'A', '400', 'italic'),
      ]),
    ).toEqual([]);
  });

  it('flags basic Latin spread over several files (cn-font-split-like)', () => {
    const issues = auditSplitFaces([
      rule('U+20-2F, U+3A-40, U+5B-60, U+7B-7E'),
      rule('U+30-39, U+41-5A'),
      rule('U+61-7A, U+A0-FF'),
      rule('U+4E00-9FFF'),
    ]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: 'latin-split',
      family: 'Inter',
      rules: [0, 1, 2],
      characters: 'U+20-7E',
      count: 95,
    });
  });

  it('does not call a redundant full copy of basic Latin a split', () => {
    const issues = auditSplitFaces([rule('U+0-FF'), rule('U+20-7E')]);
    expect(issues.map((issue) => issue.kind)).toEqual(['late-real-face']);
  });

  it('flags overlapping ranges and lists the shared characters', () => {
    const issues = auditSplitFaces([rule('U+80-FF'), rule('U+80-17F')]);
    expect(issues).toEqual([
      {
        kind: 'overlap',
        family: 'Inter',
        weight: '400',
        style: 'normal',
        rules: [0, 1],
        characters: 'U+80-FF',
        count: 128,
      },
    ]);
  });

  it('flags the face with the real glyphs declared before a face that overlaps it', () => {
    const issues = auditSplitFaces([rule(), rule('U+400-4FF')]);
    expect(issues).toMatchObject([
      { kind: 'late-real-face', rules: [0, 1], characters: 'U+400-4FF', count: 256 },
    ]);
    expect(auditSplitFaces([rule('U+400-4FF'), rule()]).map((issue) => issue.kind)).toEqual([
      'overlap',
    ]);
  });

  it('groups weight and style spellings and ignores family case', () => {
    const issues = auditSplitFaces([
      rule('U+0-FF', 'inter', 'normal', 'oblique 10deg'),
      rule('U+80-17F', 'INTER', '400', 'italic'),
    ]);
    expect(issues).toHaveLength(1);
  });

  it('understands wildcard ranges and skips unparsable ones', () => {
    expect(auditSplitFaces([rule('U+4??'), rule('U+400-4FF, U+600-6FF')])[0]).toMatchObject({
      characters: 'U+400-4FF',
    });
    expect(
      auditSplitFaces([rule('nonsense'), rule('U+0-FF'), rule('U+110000'), rule('U+5-1')]),
    ).toEqual([]);
    expect(auditSplitFaces([rule('U+0-FF'), rule('U+1-2,')])).toEqual([]);
  });

  it('ignores duplicate rules', () => {
    expect(auditSplitFaces([rule(), rule('U+0-FF'), rule('U+0-FF')])).toMatchObject([
      { kind: 'late-real-face' },
    ]);
    expect(auditSplitFaces([rule(), rule()])).toEqual([]);
  });

  it('normalizes weights and strips control characters from family names', () => {
    const [issue] = auditSplitFaces([
      rule('U+0-FF', `A${String.fromCharCode(27)}[31m${String.fromCharCode(10)}B`, '100 900'),
      rule('U+80-17F', 'a [31m b', '100  900'),
    ]);
    expect(issue).toMatchObject({ family: 'A [31m B', weight: '100 900' });
    expect(
      auditSplitFaces([rule('U+0-FF', 'A', '<x>'), rule('U+80-17F', 'A', 'normal')])[0],
    ).toMatchObject({
      weight: '400',
    });
  });

  it('applies the range limits and reports both split and overlap when they occur', () => {
    const tokens = (length: number) => {
      const parts: string[] = [];
      for (let point = 0x100; parts.join(',').length < length; point += 2)
        parts.push(`U+${point.toString(16)}`);
      return parts.join(',');
    };
    expect(auditSplitFaces([rule(tokens(4200)), rule('U+100-FFFF')])).toEqual([]);
    expect(auditSplitFaces([rule(tokens(4000)), rule('U+100-FFFF')])).toHaveLength(1);
    expect(auditSplitFaces([rule('U+??????'), rule('U+0-FF')])).toEqual([]);
    expect(auditSplitFaces([rule('U+100000-110000'), rule('U+0-FF')])).toEqual([]);
    expect(auditSplitFaces([rule('U+4?'), rule('U+0-FF')])).toHaveLength(1);
    const kinds = auditSplitFaces([rule('U+20-5F'), rule('U+40-7F')]).map((issue) => issue.kind);
    expect(kinds).toEqual(['latin-split', 'overlap']);
  });

  it('caps the number of issues', () => {
    const many = Array.from({ length: 128 }, (_, index) =>
      rule(`U+0-${(0xff + index).toString(16)}`),
    );
    expect(auditSplitFaces(many)).toHaveLength(50);
  });

  it('stays bounded on hostile input', () => {
    const many = Array.from({ length: 5000 }, () => rule('U+0-10FFFF'));
    const start = performance.now();
    const issues = auditSplitFaces(many);
    expect(performance.now() - start).toBeLessThan(2000);
    expect(issues.length).toBeLessThanOrEqual(50);
    const huge = 'U+1,'.repeat(5000);
    expect(auditSplitFaces([rule(huge), rule(huge)])).toEqual([]);
    expect(auditSplitFaces([rule('U+0-FF'), { family: '', weight: '', style: '' }])).toEqual([]);
  });
});
