import type { FontOrigin } from '@/modules/font-sources';
import type { OsId } from '@/modules/os-fonts';
import {
  DEFAULT_PANEL,
  type FontState,
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
  query?: string | undefined;
  fontName?: string | undefined;
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
    ...(input.query ? { query: input.query } : {}),
    ...(input.fontName ? { fontName: input.fontName } : {}),
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
