import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  decodeShareState,
  encodeShareState,
  MAX_HASH_CHARS,
  parseShareState,
  payloadFromHash,
  type ShareState,
} from './share';

const sample: ShareState = {
  v: 1,
  query: 'defaults',
  fontName: 'Inter.woff2',
  kind: 'serif',
  style: 'bold',
  disabled: ['linux'],
  picks: { windows: ['arial', 'segoe-ui'] },
  manual: { arial: { sizeAdjust: 110.5 } },
  others: {
    'Inter-Bold.woff2': {
      style: 'bold',
      picks: { macos: ['arial'] },
      manual: { arial: { sizeAdjust: 99 } },
    },
  },
  range: true,
  spacing: { on: true, letter: 0.1 },
};

describe('share state', () => {
  it('keeps the state of every font and drops hostile names', () => {
    const parsed = parseShareState({
      v: 1,
      others: { 'A.woff2': { kind: 'serif', style: 'nope' }, ['__proto__']: { kind: 'serif' } },
    });
    expect(parsed?.others).toEqual({ 'A.woff2': { kind: 'serif' } });
  });

  it('round-trips through the compressed hash payload', async () => {
    const payload = await encodeShareState(sample);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(await decodeShareState(payload)).toEqual(sample);
  });

  it('is much shorter than the JSON for repetitive state', async () => {
    const big: ShareState = { ...sample, query: 'chrome 120, '.repeat(30) };
    const payload = await encodeShareState(big);
    expect(payload.length).toBeLessThan(JSON.stringify(big).length);
  });

  it('extracts the payload from the hash', () => {
    expect(payloadFromHash('#s=abc')).toBe('abc');
    expect(payloadFromHash('s=abc')).toBe('abc');
    expect(payloadFromHash('#other')).toBeNull();
  });

  it.each(['', '***', 'A'.repeat(MAX_HASH_CHARS + 1), 'AAAA', 'not valid'])(
    'rejects the hostile payload %j',
    async (payload) => {
      expect(await decodeShareState(payload)).toBeNull();
    },
  );

  it('rejects a decompression bomb', async () => {
    const stream = new CompressionStream('deflate-raw');
    const writer = stream.writable.getWriter();
    void writer.write(new Uint8Array(5_000_000));
    void writer.close();
    const chunks: number[] = [];
    const reader = stream.readable.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(...value);
    }
    const payload = btoa(String.fromCharCode(...chunks))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(payload.length).toBeLessThan(MAX_HASH_CHARS);
    expect(await decodeShareState(payload)).toBeNull();
  });
});

describe('parseShareState', () => {
  it('drops unknown keys and invalid values', () => {
    expect(
      parseShareState({
        v: 1,
        query: 'x'.repeat(501),
        kind: 'cursive',
        disabled: ['linux', 'beos', 5],
        picks: { windows: ['arial', '../etc', 'A B'], nope: ['x'] },
        manual: {
          arial: { sizeAdjust: 9999, ascentOverride: 100, evil: 1 },
          __proto__: { sizeAdjust: 100 },
        },
        spacing: { on: true, letter: 99 },
        extra: 'ignored',
      }),
    ).toEqual({
      v: 1,
      disabled: ['linux'],
      picks: { windows: ['arial'] },
      manual: { arial: { ascentOverride: 100 } },
      spacing: { on: true },
    });
  });

  it('migrates older versions step by step', () => {
    const migrations = { 0: (state: Record<string, unknown>) => ({ ...state, range: true }) };
    expect(parseShareState({ v: 0 }, migrations)).toEqual({ v: 1, range: true });
    expect(parseShareState({ v: 0 }, {})).toBeNull();
  });

  it('rejects unknown versions and non-objects', () => {
    expect(parseShareState({ v: 2 })).toBeNull();
    expect(parseShareState(null)).toBeNull();
    expect(parseShareState([])).toBeNull();
    expect(parseShareState('x')).toBeNull();
  });

  it('never throws and never returns an unsafe shape for arbitrary input', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const result = parseShareState(input);
        if (result) expect(result.v).toBe(1);
      }),
    );
  });
});

describe('font origins', () => {
  const origin = { source: 'google', family: 'Open Sans', style: '400', subset: 'latin' };

  it('keeps valid origins', () => {
    expect(parseShareState({ v: 1, sources: [origin] })?.sources).toEqual([origin]);
  });

  it('drops malformed origins and caps the list', () => {
    const bad = [
      { ...origin, source: 'evil' },
      { ...origin, family: '../x/<script>' },
      { ...origin, style: 'bold' },
      { ...origin, subset: 'Latin Ext' },
      'text',
    ];
    const many = Array.from({ length: 20 }, () => origin);
    expect(parseShareState({ v: 1, sources: bad })?.sources).toEqual([]);
    expect(parseShareState({ v: 1, sources: many })?.sources).toHaveLength(8);
  });
});
