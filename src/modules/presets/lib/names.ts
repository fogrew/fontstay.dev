import type { Messages } from '@/common/i18n';
import type { PresetId } from './presets';

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

const keyOf = (id: PresetId) => id.replaceAll('-', '_') as PresetKey;

export function presetName(t: Messages, id: PresetId): string {
  return t[`preset_${keyOf(id)}_name`]();
}

export function presetDescription(t: Messages, id: PresetId): string {
  return t[`preset_${keyOf(id)}_description`]();
}
