import { describe, expect, it } from 'vitest';
import { resolveQuery } from './resolve';
import { isStatsFile, MAX_STATS_BYTES, MAX_STATS_ENTRIES, parseStats } from './stats';

const known = {
  chrome: { versions: ['119', '120'] },
  firefox: { versions: ['121'] },
};

describe('parseStats', () => {
  it('keeps known entries and reports unknown browsers and versions', () => {
    const result = parseStats(
      JSON.stringify({
        chrome: { '120': 60, '5': 1 },
        firefox: { '121': 10 },
        netscape: { '4': 1 },
      }),
      known,
    );
    expect(result).toMatchObject({
      ok: true,
      entries: 2,
      unknownBrowsers: ['netscape'],
      unknownVersions: ['chrome 5'],
    });
    if (result.ok) expect(result.stats).toEqual({ chrome: { '120': 60 }, firefox: { '121': 10 } });
  });

  it('rejects a file where no browser or version is known', () => {
    expect(parseStats(JSON.stringify({ netscape: { '4': 1 }, chrome: { '5': 1 } }), known)).toEqual(
      {
        ok: false,
        code: 'empty',
        detail: '',
      },
    );
  });

  it('recognises the statistics file by name', () => {
    expect(isStatsFile('browserslist-stats.json')).toBe(true);
    expect(isStatsFile('Browserslist_Stats (1).json')).toBe(true);
    expect(isStatsFile('package.json')).toBe(false);
  });

  it('rejects malformed input with a code', () => {
    expect(parseStats('{oops', known)).toMatchObject({ ok: false, code: 'not-json' });
    expect(parseStats('[]', known)).toMatchObject({ ok: false, code: 'wrong-shape' });
    expect(parseStats('{}', known)).toMatchObject({ ok: false, code: 'wrong-shape' });
    expect(parseStats('{"chrome": 5}', known)).toMatchObject({ ok: false, code: 'wrong-shape' });
    for (const bad of ['"12"', '101', '-1']) {
      expect(parseStats(`{"chrome": {"120": ${bad}}}`, known)).toMatchObject({
        ok: false,
        code: 'bad-value',
      });
    }
  });

  it('enforces size and entry limits', () => {
    expect(parseStats(' '.repeat(MAX_STATS_BYTES + 1), known)).toMatchObject({
      code: 'too-large',
    });
    const versions = Object.fromEntries(
      Array.from({ length: MAX_STATS_ENTRIES + 1 }, (_, index) => [String(index), 1]),
    );
    expect(parseStats(JSON.stringify({ chrome: versions }), known)).toMatchObject({
      code: 'too-many',
    });
  });

  it('treats prototype keys as plain data', () => {
    const safe = parseStats('{"__proto__": {"x": 1}, "chrome": {"120": 1}}', known);
    expect(safe).toMatchObject({ ok: true, unknownBrowsers: ['__proto__'] });
    expect(({} as Record<string, unknown>).x).toBeUndefined();
    expect(parseStats('{"chrome": {"__proto__": 1, "120": 1}}', known)).toMatchObject({ ok: true });
  });
});

describe('queries with imported stats', () => {
  it('resolves "in my stats" queries and reports coverage', async () => {
    const stats = { chrome: { '120': 60, '119': 3 }, firefox: { '121': 10 } };
    const result = await resolveQuery('> 5% in my stats', stats);
    expect(result).toMatchObject({ ok: true, count: 2, coverage: 70 });
  });
});
