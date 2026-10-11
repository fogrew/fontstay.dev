import { describe, expect, it } from 'vitest';
import type { MatrixGroup } from '@/modules/audience';
import { buildReport, type ReportInput } from './report';

const base: ReportInput = {
  locale: 'en',
  family: 'Inter',
  fileName: 'Inter.woff2',
  audienceCount: 42,
  matrix: [
    {
      os: 'windows',
      share: 80,
      enabled: true,
      available: true,
      fonts: 'Arial',
      hiddenShare: 0,
      columns: [
        {
          browser: 'chrome',
          name: 'Chrome',
          share: 70,
          cells: [{ label: '123–154', state: 'full', shift: 0.012, baseline: 0.051 }],
        },
      ],
    },
  ],
  support: [
    {
      feature: 'size-adjust',
      supported: 90,
      unsupported: 5,
      unknown: 5,
      unsupportedBrowsers: [],
      unknownBrowsers: [],
    },
  ],
  fontCoverage: 0.97,
  systems: [{ os: 'windows', label: 'Windows', enabled: true, fonts: 'Arial' }],
  warnings: ['Check the font type.'],
  strategy: true,
  spacing: false,
  rating: (shift) => (shift <= 0.1 ? 'good' : shift <= 0.25 ? 'needs' : 'poor'),
};

describe('buildReport', () => {
  it('lists the shift with and without the CSS per browser', () => {
    const report = buildReport(base);
    expect(report).toContain('# Impact report: Inter');
    expect(report).toContain(
      '| Windows | Chrome 123–154 | Fully adjusted | 0.012 (Good) | 0.051 |',
    );
    expect(report).toContain('| `size-adjust` | 90.0% | 5.0% | 5.0% |');
    expect(report).toContain('Check the font type.');
    expect(report).toContain('Safari');
  });

  it('is localized', () => {
    expect(buildReport({ ...base, locale: 'ru' })).toContain('# Отчёт о влиянии: Inter');
  });

  it('escapes table separators and marks missing values', () => {
    const group = base.matrix[0] as MatrixGroup;
    const column = group.columns[0] as MatrixGroup['columns'][number];
    const report = buildReport({
      ...base,
      systems: [{ os: 'windows', label: 'Win|dows', enabled: false, fonts: '' }],
      matrix: [
        {
          ...group,
          columns: [
            { ...column, cells: [{ label: 'all', state: 'none', shift: null, baseline: null }] },
          ],
        },
      ],
    });
    expect(report).toContain('Win\\|dows');
    expect(report).toContain('| — | — |');
  });

  it('omits sections without content', () => {
    const report = buildReport({ ...base, warnings: [], strategy: false });
    expect(report).not.toContain('## Warnings');
    expect(report).not.toContain('font-size-adjust');
  });
});
