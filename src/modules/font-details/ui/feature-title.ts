import type { Messages } from '@/common/i18n';
import type { FontFeature } from '@/modules/font-metrics';
import { classifyFeature } from '../lib/features';

export function featureTitle(t: Messages, feature: FontFeature): string {
  const kind = classifyFeature(feature.tag);
  switch (kind.kind) {
    case 'known':
      return t[`details_feature_${kind.tag}`]();
    case 'stylistic-set':
      return feature.label ?? t.details_feature_stylistic_set({ number: kind.number });
    case 'character-variant':
      return feature.label ?? t.details_feature_character_variant({ number: kind.number });
    case 'joining':
      return t.details_feature_joining();
    case 'shaping':
      return t.details_feature_shaping();
    default:
      return t.details_feature_unknown();
  }
}
