import { describe, expect, it } from 'vitest';
import { effectiveFormat, exportFileFor } from './ExportPanel';

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
