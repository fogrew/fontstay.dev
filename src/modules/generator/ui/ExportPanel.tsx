import { type Locale, localizeHref, messagesFor } from '@/common/i18n';
import { Button, CodeBlock, type CodeLanguage, Icon, type IconName, Select } from '@/common/ui';
import { buildExport, EXPORT_FORMATS, type ExportFormat, type ExportInput } from '@/modules/export';

export type ExportChoice = ExportFormat | 'report';
export interface ExportFile {
  text: string;
  fileName: string;
  language: CodeLanguage;
}

export function effectiveFormat(chosen: ExportChoice, multi: boolean): ExportChoice {
  return multi && chosen === 'report' ? 'css' : chosen;
}

export function exportFileFor(
  format: ExportChoice,
  input: ExportInput,
  report: () => string,
): ExportFile {
  return format === 'report'
    ? { text: report(), fileName: 'impact-report.md', language: 'markdown' }
    : buildExport(format, input);
}

export const FORMAT_ICONS: Record<ExportChoice, IconName> = {
  css: 'css',
  variables: 'css',
  preload: 'html',
  tailwind: 'tailwind',
  next: 'next',
  nuxt: 'nuxt',
  astro: 'astro',
  wordpress: 'wordpress',
  fontaine: 'font',
  loading: 'javascript',
  report: 'markdown',
};

export interface SelfHostControl {
  checked: boolean;
  onChange: (checked: boolean) => void;
  onDownload: () => void;
  failed: boolean;
}

export function ExportPanel({
  locale,
  chosen,
  onFormat,
  file,
  reordered = false,
  multi = false,
  label,
  selfHost,
}: {
  locale: Locale;
  chosen: ExportChoice;
  onFormat: (format: ExportChoice) => void;
  file: ExportFile;
  reordered?: boolean;
  multi?: boolean;
  label: string;
  selfHost?: SelfHostControl | undefined;
}) {
  const t = messagesFor(locale);
  const format = effectiveFormat(chosen, multi);
  const labels: Record<ExportChoice, string> = {
    report: t.export_report(),
    css: t.export_css(),
    variables: t.export_variables(),
    tailwind: t.export_tailwind(),
    next: t.export_next(),
    nuxt: t.export_nuxt(),
    astro: t.export_astro(),
    wordpress: t.export_wordpress(),
    fontaine: t.export_fontaine(),
    preload: t.export_preload(),
    loading: t.export_loading(),
  };
  return (
    <div class="ff-export">
      <Select
        label={t.export_format_label()}
        value={format}
        options={(multi ? EXPORT_FORMATS : [...EXPORT_FORMATS, 'report' as const]).map((value) => {
          const name = FORMAT_ICONS[value];
          return { value, label: labels[value], icon: name && <Icon name={name} /> };
        })}
        onChange={(value) => onFormat(value as ExportChoice)}
      />
      {format === 'css' && (
        <p class="ff-muted">
          {t.fit_latin_note()}
          {reordered && ` ${t.plan_reordered()}`}
        </p>
      )}
      {format === 'wordpress' && <p class="ff-muted">{t.wordpress_note()}</p>}
      {format === 'loading' && <p class="ff-muted">{t.loading_note()}</p>}
      {selfHost && (
        <>
          <label>
            <input
              class="ff-control"
              type="checkbox"
              aria-describedby="ff-self-host-note"
              checked={selfHost.checked}
              onChange={(event) => selfHost.onChange(event.currentTarget.checked)}
            />{' '}
            {t.self_host_label()}
          </label>
          <p class="ff-muted" id="ff-self-host-note">
            {t.self_host_note()}
          </p>
          {selfHost.checked && (
            <Button class="ff-export__download" onClick={selfHost.onDownload}>
              <Icon name="download" />
              {t.self_host_download()}
            </Button>
          )}
          {selfHost.failed && (
            <p class="ff-error" role="alert">
              {t.self_host_error()}
            </p>
          )}
        </>
      )}
      <CodeBlock
        locale={locale}
        label={label}
        code={file.text}
        fileName={file.fileName}
        language={file.language}
        controls={false}
      />
      {format !== 'report' && (
        <p class="ff-muted">
          <a class="ff-link" href={localizeHref('/cli/', { locale })}>
            {t.export_cli_link()}
          </a>
        </p>
      )}
    </div>
  );
}
