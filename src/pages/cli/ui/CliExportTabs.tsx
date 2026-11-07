import { type Locale, messagesFor } from '@/common/i18n';
import { Tabs } from '@/common/ui';
import { EXPORT_FORMATS } from '@/modules/export';
import { cliExampleOutput } from './cli-example-output';
import './cli-export-tabs.css';

interface Props {
  locale: Locale;
}

export function CliExportTabs({ locale }: Props) {
  const t = messagesFor(locale);
  const labels = {
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
    <div class="ff-cli-export">
      <Tabs
        label={t.cli_formats_heading()}
        animate
        scrollable
        items={EXPORT_FORMATS.map((format) => ({
          id: format,
          label: labels[format],
          content: (
            <div class="ff-cli-export__content">
              <p class="ff-cli-export__label">{t.cli_example_command()}</p>
              {/* biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable code needs a keyboard focus target */}
              <pre class="ff-prose__code ff-cli-export__code" tabIndex={0} dir="ltr">
                <code>{`fontstay fit tests/fixtures/fonts/FiraSans-Regular.ttf --systems windows --no-scripts --format ${format}`}</code>
              </pre>
              <p class="ff-cli-export__label">{t.cli_example_output()}</p>
              {/* biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable code needs a keyboard focus target */}
              <pre class="ff-prose__code ff-cli-export__code" tabIndex={0} dir="ltr">
                <code>{cliExampleOutput[format]}</code>
              </pre>
            </div>
          ),
        }))}
      />
    </div>
  );
}
