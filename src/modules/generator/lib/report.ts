import { type Locale, type Messages, messagesFor } from '@/common/i18n';
import type { FeatureSupport, MatrixGroup } from '@/modules/audience';

export interface ReportInput {
  locale: Locale;
  family: string;
  fileName: string;
  audienceCount: number | undefined;
  matrix: readonly MatrixGroup[];
  support: readonly FeatureSupport[];
  fontCoverage: number;
  systems: readonly { os: string; label: string; enabled: boolean; fonts: string }[];
  warnings: readonly string[];
  strategy: boolean;
  spacing: boolean;
  rating: (shift: number) => 'good' | 'needs' | 'poor';
}

const pad = (value: number, digits = 3) => value.toFixed(digits);

function ratingLabel(t: Messages, level: 'good' | 'needs' | 'poor'): string {
  if (level === 'good') return t.cls_rating_good();
  return level === 'needs' ? t.cls_rating_needs() : t.cls_rating_poor();
}

function stateLabel(t: Messages, state: string): string {
  if (state === 'full') return t.matrix_full();
  if (state === 'partial') return t.matrix_partial();
  return state === 'none' ? t.matrix_none() : t.matrix_unknown();
}

const escapeCell = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function buildReport(input: ReportInput): string {
  const t = messagesFor(input.locale);
  const lines: string[] = [];
  lines.push(`# ${t.report_title({ family: input.family })}`, '');
  lines.push(`${t.report_font({ file: input.fileName })}`);
  if (input.audienceCount !== undefined) {
    lines.push(t.report_audience({ count: input.audienceCount }));
  }
  lines.push(t.report_coverage({ percent: Math.round(input.fontCoverage * 100) }), '');

  lines.push(`## ${t.report_systems()}`, '');
  lines.push(`| ${t.catalog_col_system()} | ${t.report_fallbacks()} |`, '| --- | --- |');
  for (const system of input.systems) {
    const value = system.enabled ? system.fonts || '—' : t.matrix_generic();
    lines.push(`| ${escapeCell(system.label)} | ${escapeCell(value)} |`);
  }
  lines.push('');

  lines.push(`## ${t.report_shift()}`, '', t.report_shift_note(), '');
  lines.push(
    `| ${t.catalog_col_system()} | ${t.report_browser()} | ${t.matrix_heading()} | ${t.report_with()} | ${t.report_without()} |`,
    '| --- | --- | --- | --- | --- |',
  );
  for (const group of input.matrix) {
    for (const column of group.columns) {
      for (const cell of column.cells) {
        const withCss =
          cell.shift === null
            ? '—'
            : `${pad(cell.shift)} (${ratingLabel(t, input.rating(cell.shift))})`;
        const without = cell.baseline === null ? '—' : pad(cell.baseline);
        lines.push(
          `| ${escapeCell(t[`audience_os_${group.os}`]())} | ${escapeCell(column.name)} ${escapeCell(cell.label)} | ${stateLabel(t, cell.state)} | ${withCss} | ${without} |`,
        );
      }
    }
  }
  lines.push('');

  lines.push(`## ${t.report_support()}`, '');
  lines.push(
    `| ${t.report_feature()} | ${t.report_supported()} | ${t.report_unsupported()} | ${t.report_unknown()} |`,
    '| --- | --- | --- | --- |',
  );
  for (const item of input.support) {
    lines.push(
      `| \`${item.feature}\` | ${pad(item.supported, 1)}% | ${pad(item.unsupported, 1)}% | ${pad(item.unknown, 1)}% |`,
    );
  }
  lines.push('');

  if (input.warnings.length > 0) {
    lines.push(`## ${t.report_warnings()}`, '');
    for (const warning of input.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }

  lines.push(`## ${t.report_loading()}`, '');
  lines.push(`- ${t.report_loading_swap()}`);
  lines.push(`- ${t.report_loading_preload()}`);
  if (input.strategy) lines.push(`- ${t.report_loading_strategy()}`);
  if (input.spacing) lines.push(`- ${t.report_loading_spacing()}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}
