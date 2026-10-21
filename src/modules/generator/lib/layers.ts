export const LAYER_IDS = ['web', 'fallback', 'plain'] as const;
export type LayerId = (typeof LAYER_IDS)[number];

export type Position = 'hidden' | 'full' | 'ghost' | 'clip' | 'start' | 'end';
export type Positions = Record<LayerId, Position>;
export type Preset = 'overlay' | 'side' | 'slider' | 'web' | 'fallback' | 'plain';
export type Arrangement = 'stack' | 'columns';

export const PRESETS: Record<Preset, Positions> = {
  overlay: { web: 'full', fallback: 'ghost', plain: 'hidden' },
  side: { web: 'start', fallback: 'end', plain: 'hidden' },
  slider: { web: 'full', fallback: 'clip', plain: 'hidden' },
  web: { web: 'full', fallback: 'hidden', plain: 'hidden' },
  fallback: { web: 'hidden', fallback: 'full', plain: 'hidden' },
  plain: { web: 'hidden', fallback: 'hidden', plain: 'full' },
};

export const PRESET_IDS = Object.keys(PRESETS) as Preset[];

export function arrangementOf(positions: Positions): Arrangement {
  return LAYER_IDS.some((id) => positions[id] === 'start' || positions[id] === 'end')
    ? 'columns'
    : 'stack';
}

export const visibleLayers = (positions: Positions): LayerId[] =>
  LAYER_IDS.filter((id) => positions[id] !== 'hidden');

export const layersAt = (positions: Positions, position: Position): LayerId[] =>
  LAYER_IDS.filter((id) => positions[id] === position);

export function presetOf(positions: Positions): Preset | undefined {
  return PRESET_IDS.find((preset) =>
    LAYER_IDS.every((id) => PRESETS[preset][id] === positions[id]),
  );
}

export const hasPosition = (positions: Positions, position: Position) =>
  LAYER_IDS.some((id) => positions[id] === position);
