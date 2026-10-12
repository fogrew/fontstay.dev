import { useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { CodeBlock, Icon, type IconName, Select } from '@/common/ui';
import { buildExport, EXPORT_FORMATS, type ExportFormat, type ExportInput } from '@/modules/export';

type Choice = ExportFormat | 'report';

const FORMAT_ICONS: Partial<Record<Choice, IconName>> = {
  tailwind: 'tailwind',
  next: 'next',
  nuxt: 'nuxt',
  astro: 'astro',
};

export function ExportPanel({
  locale,
  input,
  report,
  reordered = false,
}: {
  locale: Locale;
  input: ExportInput;
  report: () => string;
  reordered?: boolean;
}) {
  const t = messagesFor(locale);
  const [format, setFormat] = useState<Choice>('css');
  const icon = FORMAT_ICONS[format];
  const labels: Record<Choice, string> = {
    report: t.export_report(),
    css: t.export_css(),
    variables: t.export_variables(),
    tailwind: t.export_tailwind(),
    next: t.export_next(),
    nuxt: t.export_nuxt(),
    astro: t.export_astro(),
    preload: t.export_preload(),
    loading: t.export_loading(),
  };
  const file =
    format === 'report'
      ? { text: report(), fileName: 'impact-report.md' }
      : buildExport(format, input);
  return (
    <div class="ff-export">
      <Select
        label={t.export_format_label()}
        value={format}
        options={[...EXPORT_FORMATS, 'report' as const].map((value) => ({
          value,
          label: labels[value],
        }))}
        onChange={(value) => setFormat(value as Choice)}
      />
      {format === 'css' && (
        <p class="ff-muted">
          {t.fit_latin_note()}
          {reordered && ` ${t.plan_reordered()}`}
        </p>
      )}
      {format === 'loading' && <p class="ff-muted">{t.loading_note()}</p>}
      {icon && (
        <p class="ff-export__target">
          <Icon name={icon} />
          {labels[format]}
        </p>
      )}
      <CodeBlock
        locale={locale}
        label={
          format === 'css' ? t.css_code_label() : t.export_code_label({ format: labels[format] })
        }
        code={file.text}
        fileName={file.fileName}
      />
    </div>
  );
}
