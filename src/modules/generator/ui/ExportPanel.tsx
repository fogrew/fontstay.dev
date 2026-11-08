import { useRef } from 'preact/hooks';
import { type Locale, localizeHref, messagesFor } from '@/common/i18n';
import { CodeBlock, type CodeLanguage, Icon, type IconName, Select } from '@/common/ui';
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
  const helpButton = useRef<HTMLButtonElement>(null);
  const helpTooltip = useRef<HTMLSpanElement>(null);
  const showHelp = () => {
    if (!helpTooltip.current?.matches(':popover-open')) helpTooltip.current?.showPopover();
  };
  const hideHelp = () => {
    if (helpTooltip.current?.matches(':popover-open')) helpTooltip.current.hidePopover();
  };
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
          <div class="ff-export__self-host">
            <label>
              <input
                class="ff-control"
                type="checkbox"
                checked={selfHost.checked}
                onChange={(event) => selfHost.onChange(event.currentTarget.checked)}
              />{' '}
              {t.self_host_label()}
            </label>
            <span class="ff-export__help">
              <button
                ref={helpButton}
                class="ff-export__question"
                type="button"
                aria-label={t.self_host_help()}
                aria-describedby="ff-self-host-note"
                onPointerEnter={showHelp}
                onPointerLeave={() => {
                  if (!helpButton.current?.matches(':focus')) hideHelp();
                }}
                onFocus={showHelp}
                onBlur={() => {
                  if (!helpButton.current?.matches(':hover')) hideHelp();
                }}
              >
                ?
              </button>
              <span
                ref={helpTooltip}
                class="ff-export__tooltip"
                id="ff-self-host-note"
                role="tooltip"
                popover="manual"
              >
                {t.self_host_note()}
              </span>
            </span>
          </div>
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
