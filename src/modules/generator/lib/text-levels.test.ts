import { describe, expect, it } from 'vitest';
import { levelsCss, placeBar, setLevelStyle } from './text-levels';
import { applyView, defaultView, diffView, parseViewDiff } from './view-state';

describe('setLevelStyle', () => {
  it('merges a change and drops undefined values and empty levels', () => {
    const one = setLevelStyle({}, 'title', { size: 40 });
    const two = setLevelStyle(one, 'title', { lineHeight: 1.2 });
    expect(two).toEqual({ title: { size: 40, lineHeight: 1.2 } });
    expect(setLevelStyle(two, 'title', { size: undefined, lineHeight: undefined })).toEqual({});
    expect(setLevelStyle(two, 'title', undefined)).toEqual({});
  });
});

describe('levelsCss', () => {
  it('writes rules only for overridden levels', () => {
    expect(levelsCss({})).toBe('');
    const css = levelsCss({ title: { size: 40, wrap: 'nowrap' }, code: { size: 12 } });
    expect(css).toContain('[data-level="title"] { font-size: 40px; text-wrap: nowrap;');
    expect(css).toContain('[data-level="code"] .ff-article__mono { font-size: 1em; }');
    expect(css).not.toContain('"body"');
  });

  it('outlines the active level', () => {
    expect(levelsCss({}, 'quote')).toContain('[data-level="quote"] { outline');
  });
});

describe('placeBar', () => {
  const viewport = { left: 0, top: 0, width: 400, height: 600 };
  const bar = { width: 300, height: 100 };

  it('sits above the anchor and stays inside the viewport', () => {
    expect(placeBar({ left: 300, top: 300, width: 90, height: 20 }, bar, viewport)).toEqual({
      left: 92,
      top: 192,
    });
  });

  it('flips below when there is no room above', () => {
    expect(placeBar({ left: 0, top: 20, width: 100, height: 20 }, bar, viewport)).toEqual({
      left: 8,
      top: 48,
    });
  });

  it('is clamped when the anchor is out of view', () => {
    expect(placeBar({ left: 0, top: 900, width: 100, height: 20 }, bar, viewport).top).toBe(492);
  });
});

describe('level overrides in the view diff', () => {
  const base = defaultView('en');

  it('round-trips through diff, parse and apply', () => {
    const view = { ...base, levels: { title: { size: 40 }, body: { wrap: 'balance' as const } } };
    const parsed = parseViewDiff(JSON.parse(JSON.stringify(diffView(view, base))));
    expect(applyView(base, parsed ?? {})).toEqual(view);
    expect(diffView(base, base)).toEqual({});
  });

  it('keeps only known levels and values in range', () => {
    const raw = JSON.parse(
      '{"levels":{"__proto__":{"size":20},"huge":{"size":20},"title":{"size":1e9,"lineHeight":"2","wrap":"x;}"},"lead":{"size":8,"lineHeight":2.4,"extra":1},"body":{"size":40,"lineHeight":2},"quote":[1],"code":null}}',
    );
    expect(parseViewDiff(raw)).toEqual({ levels: { lead: { size: 8, lineHeight: 2.4 } } });
    expect(parseViewDiff({ levels: 'title' })).toEqual({});
  });
});
