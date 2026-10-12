import { useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { CodeBlock, Icon, type IconName, Select } from '@/common/ui';
import { buildExport, EXPORT_FORMATS, type ExportFormat, type ExportInput } from '@/modules/export';

type Choice = ExportFormat | 'report';

const FORMAT_ICONS: Partial<Record<Choice, IconName>> = {
  css: 'css',
  variables: 'css',
  preload: 'html',
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
        options={[...EXPORT_FORMATS, 'report' as const].map((value) => {
          const name = FORMAT_ICONS[value];
          return { value, label: labels[value], icon: name && <Icon name={name} /> };
        })}
        onChange={(value) => setFormat(value as Choice)}
      />
      {format === 'css' && (
        <p class="ff-muted">
          {t.fit_latin_note()}
          {reordered && ` ${t.plan_reordered()}`}
        </p>
      )}
      {format === 'loading' && <p class="ff-muted">{t.loading_note()}</p>}
      <CodeBlock
        locale={locale}
        label={format === 'css' ? t.css_code_label() : file.fileName}
        code={file.text}
        fileName={file.fileName}
      />
    </div>
  );
}
