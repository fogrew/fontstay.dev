import { describe, expect, it } from 'vitest';
import { osFontsDataset } from '@/modules/os-fonts';
import { audienceCoverage, CATALOG_SYSTEMS, catalogRows, sortRows } from './catalog';

describe('catalogRows', () => {
  const rows = catalogRows(osFontsDataset);

  it('has a cell for every system of every dataset font', () => {
    expect(rows).toHaveLength(osFontsDataset.fonts.length);
    for (const row of rows) {
      for (const os of CATALOG_SYSTEMS) expect(row.cells[os]).toBeDefined();
    }
  });

  it('reflects known availability', () => {
    const arial = rows.find((row) => row.id === 'arial');
    expect(arial?.cells.windows.level).toBe('preinstalled');
    expect(arial?.cells.android.level).toBe('unknown');
  });
});

describe('audienceCoverage', () => {
  const rows = catalogRows(osFontsDataset);
  const arial = rows.find((row) => row.id === 'arial');
  const roboto = rows.find((row) => row.id === 'roboto');

  it('weights the systems by their audience share', () => {
    if (!arial || !roboto) throw new Error('missing fonts');
    expect(audienceCoverage(arial, { windows: 100 })).toBe(100);
    expect(audienceCoverage(arial, { android: 100 })).toBe(0);
    expect(audienceCoverage(roboto, { android: 50, windows: 50 })).toBeGreaterThan(40);
  });

  it('is zero without any audience', () => {
    if (!arial) throw new Error('missing font');
    expect(audienceCoverage(arial, {})).toBe(0);
  });
});

describe('sortRows', () => {
  const rows = catalogRows(osFontsDataset);

  it('sorts by name in both directions', () => {
    const up = sortRows(rows, 'family', false, {}).map((row) => row.family);
    const down = sortRows(rows, 'family', true, {}).map((row) => row.family);
    expect(up).toEqual([...up].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
    expect(down).toEqual([...up].reverse());
  });

  it('puts the fonts with the best availability on a system first', () => {
    const [first] = sortRows(rows, 'windows', true, {});
    expect(first?.cells.windows.level).toBe('preinstalled');
  });

  it('sorts by the audience coverage', () => {
    const sorted = sortRows(rows, 'coverage', true, { windows: 100 });
    expect(audienceCoverage(sorted[0] as (typeof rows)[number], { windows: 100 })).toBe(100);
  });
});
