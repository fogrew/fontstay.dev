import { describe, expect, it } from 'vitest';
import { buildMatrix, type SystemInfo, stateOf } from './matrix';

const entry = (name: string, usage: number) => ({ entry: name, usage });
const split = { windows: 50, macos: 50, linux: 0, chromeos: 0 };
const system = (fonts: string, enabled = true): SystemInfo => ({
  enabled,
  available: true,
  fonts,
  shift: (variant) => ({ full: 0.01, partial: 0.05, none: 0.2 })[variant],
});
const released = { safari: ['15', '16', '17', '18'], chrome: ['119', '120', '121'] };

describe('stateOf', () => {
  it('classifies versions by descriptor support', () => {
    expect(stateOf('chrome 120')).toBe('full');
    expect(stateOf('chrome 80')).toBe('none');
    expect(stateOf('safari 17')).toBe('partial');
    expect(stateOf('safari 16')).toBe('none');
    expect(stateOf('ios_saf 17.0-17.1')).toBe('partial');
    expect(stateOf('op_mini all')).toBe('unknown');
  });
});

describe('buildMatrix', () => {
  const entries = [
    entry('chrome 120', 30),
    entry('chrome 121', 10),
    entry('safari 16', 10),
    entry('safari 17', 10),
    entry('safari 18', 10),
    entry('ios_saf 17.0-17.1', 10),
  ];

  it('groups columns by system, sorts by share and normalizes to 100', () => {
    const groups = buildMatrix(
      entries,
      split,
      { windows: system('Arial'), macos: system('Helvetica'), ios: system('Helvetica') },
      { released },
    );
    expect(groups.reduce((sum, group) => sum + group.share, 0)).toBeCloseTo(100);
    expect(groups.map((group) => group.os)).toEqual(['macos', 'windows', 'ios']);
    const macos = groups[0];
    expect(macos?.columns.map((column) => column.browser)).toEqual(['safari', 'chrome']);
    expect(macos?.columns[0]?.share).toBeCloseTo(37.5);
    expect(macos?.fonts).toBe('Helvetica');
  });

  it('merges adjacent releases with the same state and carries the shift', () => {
    const groups = buildMatrix(entries, split, { macos: system('Helvetica') }, { released });
    const safari = groups
      .find((group) => group.os === 'macos')
      ?.columns.find((column) => column.browser === 'safari');
    expect(safari?.cells).toEqual([
      { label: '16', state: 'none', shift: 0.2, baseline: null },
      { label: '17–18', state: 'partial', shift: 0.05, baseline: 0.2 },
    ]);
    const chrome = groups
      .find((group) => group.os === 'macos')
      ?.columns.find((column) => column.browser === 'chrome');
    expect(chrome?.cells).toEqual([
      { label: '120–121', state: 'full', shift: 0.01, baseline: 0.2 },
    ]);
  });

  it('turns every cell red without a shift for systems that are switched off', () => {
    const groups = buildMatrix(entries, split, { windows: system('Arial', false) }, { released });
    const windows = groups.find((group) => group.os === 'windows');
    expect(windows?.enabled).toBe(false);
    expect(
      windows?.columns
        .flatMap((column) => column.cells)
        .every((cell) => cell.state === 'none' && cell.shift === null),
    ).toBe(true);
  });

  it('hides tiny columns but keeps their share', () => {
    const groups = buildMatrix(
      [entry('chrome 120', 99.8), entry('safari 17', 0.2)],
      { windows: 100, macos: 0, linux: 0, chromeos: 0 },
      {},
      { released, minColumnShare: 0.5 },
    );
    const mac = groups.find((group) => group.os === 'macos');
    expect(mac?.columns).toEqual([]);
    expect(mac?.hiddenShare).toBeCloseTo(0.2);
  });

  it('weights columns equally when no usage is known', () => {
    const groups = buildMatrix(
      [entry('ios_saf 17.0-17.1', 0), entry('and_chr 120', 0)],
      split,
      {},
      { released: {} },
    );
    expect(groups.map((group) => group.share)).toEqual([50, 50]);
  });

  it('keeps unknown browsers unknown when a system is switched off and merges equal neighbours', () => {
    const groups = buildMatrix(
      [entry('op_mini all', 5), entry('chrome 119', 5), entry('chrome 120', 5)],
      { windows: 100, macos: 0, linux: 0, chromeos: 0 },
      { windows: system('Arial', false), other: system('', false) },
      { released: { chrome: ['119', '120', '121'], op_mini: ['all'] } },
    );
    const windows = groups.find((group) => group.os === 'windows');
    expect(windows?.columns[0]?.cells).toEqual([
      { label: '119–120', state: 'none', shift: null, baseline: null },
    ]);
    const other = groups.find((group) => group.os === 'other');
    expect(other?.columns[0]?.cells).toEqual([
      { label: 'all', state: 'unknown', shift: null, baseline: null },
    ]);
  });

  it('treats safari TP and versions missing from the release list as separate cells', () => {
    const groups = buildMatrix(
      [entry('safari 18', 1), entry('safari TP', 1)],
      { windows: 0, macos: 100, linux: 0, chromeos: 0 },
      { macos: system('Helvetica') },
      { released: { safari: ['17', '18'] } },
    );
    const cells = groups[0]?.columns[0]?.cells.map((cell) => cell.label);
    expect(cells).toEqual(['18', 'TP']);
  });
});
