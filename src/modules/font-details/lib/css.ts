import type { FontAxis } from '@/modules/font-metrics';
import { changedAxes, changedFeatures, type DetailsSelection } from './selection';

export { changedAxes, changedFeatures, type DetailsSelection, NO_SELECTION } from './selection';

interface VariantRule {
  property: string;
  value: string;
  tags: readonly string[];
  group: string;
}

const VARIANT_RULES: readonly VariantRule[] = [
  { property: 'font-variant-caps', value: 'all-small-caps', tags: ['smcp', 'c2sc'], group: 'caps' },
  {
    property: 'font-variant-caps',
    value: 'all-petite-caps',
    tags: ['pcap', 'c2pc'],
    group: 'caps',
  },
  { property: 'font-variant-caps', value: 'small-caps', tags: ['smcp'], group: 'caps' },
  { property: 'font-variant-caps', value: 'petite-caps', tags: ['pcap'], group: 'caps' },
  { property: 'font-variant-caps', value: 'unicase', tags: ['unic'], group: 'caps' },
  { property: 'font-variant-caps', value: 'titling-caps', tags: ['titl'], group: 'caps' },
  { property: 'font-variant-numeric', value: 'lining-nums', tags: ['lnum'], group: 'figure' },
  { property: 'font-variant-numeric', value: 'oldstyle-nums', tags: ['onum'], group: 'figure' },
  {
    property: 'font-variant-numeric',
    value: 'proportional-nums',
    tags: ['pnum'],
    group: 'spacing',
  },
  { property: 'font-variant-numeric', value: 'tabular-nums', tags: ['tnum'], group: 'spacing' },
  {
    property: 'font-variant-numeric',
    value: 'diagonal-fractions',
    tags: ['frac'],
    group: 'fraction',
  },
  {
    property: 'font-variant-numeric',
    value: 'stacked-fractions',
    tags: ['afrc'],
    group: 'fraction',
  },
  { property: 'font-variant-numeric', value: 'ordinal', tags: ['ordn'], group: 'ordinal' },
  { property: 'font-variant-numeric', value: 'slashed-zero', tags: ['zero'], group: 'zero' },
  { property: 'font-variant-position', value: 'super', tags: ['sups'], group: 'position' },
  { property: 'font-variant-position', value: 'sub', tags: ['subs'], group: 'position' },
  {
    property: 'font-variant-ligatures',
    value: 'discretionary-ligatures',
    tags: ['dlig'],
    group: 'dlig',
  },
  {
    property: 'font-variant-ligatures',
    value: 'historical-ligatures',
    tags: ['hlig'],
    group: 'hlig',
  },
];
const PROPERTY_ORDER = [
  'font-variant-ligatures',
  'font-variant-caps',
  'font-variant-numeric',
  'font-variant-position',
];

const trimmed = (value: number) => String(Number(value.toFixed(3)));

function variantValues(pending: Map<string, boolean>): Map<string, string[]> {
  const values = new Map<string, string[]>();
  const emit = (property: string, value: string, tags: readonly string[]) => {
    values.set(property, [...(values.get(property) ?? []), value]);
    for (const tag of tags) pending.delete(tag);
  };

  if (pending.get('liga') === false && pending.get('clig') === false) {
    emit('font-variant-ligatures', 'no-common-ligatures', ['liga', 'clig']);
  }
  if (pending.get('calt') === false) emit('font-variant-ligatures', 'no-contextual', ['calt']);

  const groups = new Map<string, VariantRule[]>();
  for (const rule of VARIANT_RULES) {
    if (!rule.tags.every((tag) => pending.get(tag) === true)) continue;
    groups.set(rule.group, [...(groups.get(rule.group) ?? []), rule]);
  }
  const chosen: VariantRule[] = [];
  for (const rules of groups.values()) {
    const outermost = rules.filter(
      (rule) =>
        !rules.some(
          (other) =>
            other !== rule &&
            other.tags.length > rule.tags.length &&
            rule.tags.every((tag) => other.tags.includes(tag)),
        ),
    );
    const only = outermost.length === 1 ? outermost[0] : undefined;
    if (only) chosen.push(only);
  }
  for (const rule of VARIANT_RULES) {
    if (chosen.includes(rule)) emit(rule.property, rule.value, rule.tags);
  }
  return values;
}

export function buildDetailsCss(axes: readonly FontAxis[], selection: DetailsSelection): string {
  const pending = new Map(changedFeatures(selection.features).map((item) => [item.tag, item.on]));
  const variants = variantValues(pending);
  const lines = PROPERTY_ORDER.flatMap((property) => {
    const values = variants.get(property);
    return values ? [`${property}: ${values.join(' ')};`] : [];
  });
  const settings = [...pending].map(([tag, on]) => `"${tag}" ${on ? 1 : 0}`);
  if (settings.length > 0) lines.push(`font-feature-settings: ${settings.join(', ')};`);
  const variation = changedAxes(axes, selection.axes).map(
    ({ tag, value }) => `"${tag}" ${trimmed(value)}`,
  );
  if (variation.length > 0) lines.push(`font-variation-settings: ${variation.join(', ')};`);
  return lines.join('\n');
}
