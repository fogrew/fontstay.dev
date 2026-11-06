import { describe, expect, it } from 'vitest';
import { EXPORT_FORMATS } from '@/modules/export';
import { effectiveFormat, exportFileFor, FORMAT_ICONS } from './ExportPanel';

describe('export format selection', () => {
  it('falls back to css when the report is chosen for several fonts', () => {
    expect(effectiveFormat('report', true)).toBe('css');
    expect(effectiveFormat('report', false)).toBe('report');
    expect(effectiveFormat('tailwind', true)).toBe('tailwind');
  });

  it('builds the impact report file from the report callback', () => {
    const file = exportFileFor('report', {} as never, () => '# Report');
    expect(file).toEqual({ text: '# Report', fileName: 'impact-report.md', language: 'markdown' });
  });
});

describe('export format icons', () => {
  it('has an icon for every format and the report', () => {
    for (const format of [...EXPORT_FORMATS, 'report'] as const) {
      expect(FORMAT_ICONS[format]).toBeTruthy();
    }
  });
});
