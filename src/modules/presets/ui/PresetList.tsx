import { type Locale, messagesFor } from '@/common/i18n';
import { CodeBlock } from '@/common/ui';
import { cssStack, PRESETS, type PresetId } from '../lib/presets';

type PresetKey =
  | 'system_ui'
  | 'neo_grotesque'
  | 'humanist'
  | 'classical_humanist'
  | 'transitional'
  | 'old_style'
  | 'classic_serif'
  | 'slab_serif'
  | 'monospace_code';

const key = (id: PresetId) => id.replaceAll('-', '_') as PresetKey;

export function PresetList({ locale, links }: { locale: Locale; links: Record<PresetId, string> }) {
  const t = messagesFor(locale);
  return (
    <ul class="ff-presets">
      {PRESETS.map((preset) => (
        <li key={preset.id} class="ff-presets__item">
          <h2>{t[`preset_${key(preset.id)}_name`]()}</h2>
          <p>{t[`preset_${key(preset.id)}_description`]()}</p>
          <CodeBlock
            locale={locale}
            label={t.preset_code_label({ name: t[`preset_${key(preset.id)}_name`]() })}
            code={`font-family: ${cssStack(preset)};`}
          />
          <a href={links[preset.id]}>{t.preset_open()}</a>
        </li>
      ))}
    </ul>
  );
}
