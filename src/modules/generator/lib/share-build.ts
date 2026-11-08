import type { FontOrigin } from '@/modules/font-sources';
import type { OsId } from '@/modules/os-fonts';
import type { Overrides } from './css';
import {
  DEFAULT_PANEL,
  type FontState,
  LIMITS,
  type NO_PANEL,
  type PanelId,
  SHARE_VERSION,
  type ShareState,
} from './share';
import type { ViewDiff } from './view-state';

type Picks = NonNullable<FontState['picks']>;

const OS_ORDER: readonly OsId[] = ['windows', 'macos', 'ios', 'android', 'linux', 'chromeos'];

export interface FontChoices {
  kind?: FontState['kind'] | undefined;
  style?: FontState['style'] | undefined;
  picks?: Picks | undefined;
  manual?: FontState['manual'] | undefined;
}

export interface ShareInput {
  data?: string | undefined;
  query?: string | undefined;
  fontName?: string | undefined;
  all?: boolean | undefined;
  preset?: string | undefined;
  basePicks?: Picks | undefined;
  selected?: FontChoices | undefined;
  others?: Record<string, FontChoices>;
  sources?: FontOrigin[];
  disabled?: readonly OsId[];
  range?: boolean;
  perScript?: boolean;
  spacing?: { on: boolean; letter?: number | undefined; word?: number | undefined };
  panel?: PanelId | typeof NO_PANEL | undefined;
  os?: OsId | undefined;
  face?: string | undefined;
  view?: ViewDiff | undefined;
}

export function diffPicks(picks: Picks | undefined, base: Picks = {}): Picks | undefined {
  if (!picks) return undefined;
  const changed: Picks = {};
  for (const os of OS_ORDER) {
    const list = picks[os] ?? [];
    const baseList = base[os] ?? [];
    if (list.length !== baseList.length || list.some((id, index) => id !== baseList[index])) {
      changed[os] = list;
    }
  }
  return Object.keys(changed).length > 0 ? changed : undefined;
}

export function mergePicks(base: Picks, saved: Picks | undefined): Picks {
  return saved ? { ...base, ...saved } : base;
}

function fontPart(choices: FontChoices | undefined, base: Picks): FontState {
  if (!choices) return {};
  const picks = diffPicks(choices.picks, base);
  const manual =
    choices.manual && Object.keys(choices.manual).length > 0 ? choices.manual : undefined;
  return {
    ...(choices.kind ? { kind: choices.kind } : {}),
    ...(choices.style ? { style: choices.style } : {}),
    ...(picks ? { picks } : {}),
    ...(manual ? { manual } : {}),
  };
}

export function buildShareState(input: ShareInput): ShareState {
  const base = input.basePicks ?? {};
  const others = Object.fromEntries(
    Object.entries(input.others ?? {})
      .map(([name, choices]): [string, FontState] => [name, fontPart(choices, base)])
      .filter(([, part]) => Object.keys(part).length > 0),
  );
  const spacing = input.spacing;
  const spacingChanged =
    spacing && (!spacing.on || spacing.letter !== undefined || spacing.word !== undefined);
  return {
    v: SHARE_VERSION,
    ...(input.data ? { data: input.data } : {}),
    ...(input.query ? { query: input.query } : {}),
    ...(input.fontName ? { fontName: input.fontName } : {}),
    ...(input.all ? { all: true } : {}),
    ...(input.preset ? { preset: input.preset } : {}),
    ...fontPart(input.selected, base),
    ...(input.disabled && input.disabled.length > 0 ? { disabled: [...input.disabled] } : {}),
    ...(Object.keys(others).length > 0 ? { others } : {}),
    ...(input.sources && input.sources.length > 0 ? { sources: input.sources } : {}),
    ...(input.range ? { range: true } : {}),
    ...(input.perScript === false ? { scripts: false } : {}),
    ...(spacingChanged
      ? {
          spacing: {
            on: spacing.on,
            ...(spacing.letter !== undefined ? { letter: spacing.letter } : {}),
            ...(spacing.word !== undefined ? { word: spacing.word } : {}),
          },
        }
      : {}),
    ...(input.panel && input.panel !== DEFAULT_PANEL ? { panel: input.panel } : {}),
    ...(input.os ? { os: input.os } : {}),
    ...(input.face ? { face: input.face } : {}),
    ...(input.view && Object.keys(input.view).length > 0 ? { view: input.view } : {}),
  };
}

export function dataVersionOf(picksByPreset: Record<string, Picks>): string {
  const text = JSON.stringify(
    Object.entries(picksByPreset)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([id, picks]) => [id, OS_ORDER.map((os) => picks[os] ?? [])]),
  );
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function isStaleLink(state: ShareState, current: string): boolean {
  return state.data !== undefined && state.data !== current;
}

export function keepKnownPicks(
  state: ShareState,
  isKnown: (os: OsId, id: string) => boolean,
): ShareState {
  const prune = ({ picks, ...rest }: FontState): FontState => {
    const kept: Picks = {};
    for (const os of OS_ORDER) {
      const ids = (picks?.[os] ?? []).filter((id) => isKnown(os, id));
      if (ids.length > 0) kept[os] = ids;
    }
    return Object.keys(kept).length > 0 ? { ...rest, picks: kept } : rest;
  };
  const { others, picks, ...rest } = state;
  return {
    ...rest,
    ...prune(picks ? { picks } : {}),
    ...(others
      ? { others: Object.fromEntries(Object.entries(others).map(([k, v]) => [k, prune(v)])) }
      : {}),
  };
}

export function pinFitValues(fits: Record<string, Overrides>): NonNullable<FontState['manual']> {
  const percent = (key: keyof Overrides, ratio: number) => {
    const [min, max] = LIMITS[key];
    return Math.min(max, Math.max(min, Math.round(ratio * 10_000) / 100));
  };
  return Object.fromEntries(
    Object.entries(fits).map(([faceId, fit]) => [
      faceId,
      {
        sizeAdjust: percent('sizeAdjust', fit.sizeAdjust),
        ascentOverride: percent('ascentOverride', fit.ascentOverride),
        descentOverride: percent('descentOverride', fit.descentOverride),
        lineGapOverride: percent('lineGapOverride', fit.lineGapOverride),
      },
    ]),
  );
}
