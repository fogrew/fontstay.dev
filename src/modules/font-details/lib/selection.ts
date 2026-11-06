import type { FontAxis } from '@/modules/font-metrics';
import { isDefaultOn } from './default-on';

export interface DetailsSelection {
  features: Readonly<Record<string, boolean>>;
  axes: Readonly<Record<string, number>>;
}

export const NO_SELECTION: DetailsSelection = { features: {}, axes: {} };

export function changedFeatures(
  state: Readonly<Record<string, boolean>>,
): { tag: string; on: boolean }[] {
  return Object.keys(state)
    .filter((tag) => state[tag] !== isDefaultOn(tag))
    .sort()
    .map((tag) => ({ tag, on: state[tag] === true }));
}

export function changedAxes(
  axes: readonly FontAxis[],
  values: Readonly<Record<string, number>>,
): { tag: string; value: number }[] {
  const changed: { tag: string; value: number }[] = [];
  for (const axis of axes) {
    const raw = values[axis.tag];
    if (raw === undefined || !Number.isFinite(raw)) continue;
    const value = Math.min(axis.max, Math.max(axis.min, raw));
    if (value !== axis.default) changed.push({ tag: axis.tag, value });
  }
  return changed;
}

const settingsOf = (tags: Record<string, number>) =>
  Object.entries(tags)
    .map(([tag, value]) => `"${tag}" ${value}`)
    .join(', ');

export function selectionStyle(axes: readonly FontAxis[], selection: DetailsSelection) {
  return {
    fontFeatureSettings:
      settingsOf(
        Object.fromEntries(
          changedFeatures(selection.features).map(({ tag, on }) => [tag, on ? 1 : 0]),
        ),
      ) || 'normal',
    fontVariationSettings:
      settingsOf(
        Object.fromEntries(changedAxes(axes, selection.axes).map(({ tag, value }) => [tag, value])),
      ) || 'normal',
  };
}
