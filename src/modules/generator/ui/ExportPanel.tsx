import { useState } from 'preact/hooks';
import { type Locale, messagesFor } from '@/common/i18n';
import { CodeBlock, Select } from '@/common/ui';
import { buildExport, EXPORT_FORMATS, type ExportFormat, type ExportInput } from '@/modules/export';

export function ExportPanel({ locale, input }: { locale: Locale; input: ExportInput }) {
  const t = messagesFor(locale);
  const [format, setFormat] = useState<ExportFormat>('css');
  const labels: Record<ExportFormat, string> = {
    css: t.export_css(),
    variables: t.export_variables(),
    tailwind: t.export_tailwind(),
    next: t.export_next(),
    nuxt: t.export_nuxt(),
    astro: t.export_astro(),
    json: t.export_json(),
    preload: t.export_preload(),
    loading: t.export_loading(),
  };
  const file = buildExport(format, input);
  return (
    <div class="ff-export">
      <Select
        label={t.export_format_label()}
        value={format}
        options={EXPORT_FORMATS.map((value) => ({ value, label: labels[value] }))}
        onChange={(value) => setFormat(value as ExportFormat)}
      />
      <CodeBlock
        locale={locale}
        label={t.export_code_label({ format: labels[format] })}
        code={file.text}
        fileName={file.fileName}
      />
    </div>
  );
}
