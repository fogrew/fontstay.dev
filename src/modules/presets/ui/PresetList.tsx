import { type Locale, messagesFor } from '@/common/i18n';
import { CodeBlock } from '@/common/ui';
import { presetDescription, presetName } from '../lib/names';
import { cssStack, PRESETS, type PresetId } from '../lib/presets';

export function PresetList({ locale, links }: { locale: Locale; links: Record<PresetId, string> }) {
  const t = messagesFor(locale);
  return (
    <ul class="ff-presets">
      {PRESETS.map((preset) => (
        <li key={preset.id} class="ff-presets__item">
          <h2>{presetName(t, preset.id)}</h2>
          <p>{presetDescription(t, preset.id)}</p>
          <CodeBlock
            locale={locale}
            label={t.preset_code_label({ name: presetName(t, preset.id) })}
            code={`font-family: ${cssStack(preset)};`}
          />
          <a href={links[preset.id]}>{t.preset_open()}</a>
        </li>
      ))}
    </ul>
  );
}
