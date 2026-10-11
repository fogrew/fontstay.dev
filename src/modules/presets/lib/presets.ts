import type { Category, OsFontsDataset, OsId } from '@/modules/os-fonts';
import { osAvailability } from '@/modules/os-fonts';

export const PRESET_IDS = [
  'system-ui',
  'neo-grotesque',
  'humanist',
  'classical-humanist',
  'transitional',
  'old-style',
  'classic-serif',
  'slab-serif',
  'monospace-code',
] as const;

export type PresetId = (typeof PRESET_IDS)[number];

export interface Preset {
  id: PresetId;
  kind: Category;
  stack: readonly string[];
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'system-ui',
    kind: 'sans-serif',
    stack: [
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'Helvetica Neue',
      'Arial',
      'sans-serif',
    ],
  },
  {
    id: 'neo-grotesque',
    kind: 'sans-serif',
    stack: ['Inter', 'Roboto', 'Helvetica Neue', 'Arial Nova', 'Arial', 'sans-serif'],
  },
  {
    id: 'humanist',
    kind: 'sans-serif',
    stack: ['Seravek', 'Gill Sans Nova', 'Ubuntu', 'Calibri', 'DejaVu Sans', 'sans-serif'],
  },
  {
    id: 'classical-humanist',
    kind: 'sans-serif',
    stack: ['Optima', 'Candara', 'Noto Sans', 'sans-serif'],
  },
  {
    id: 'transitional',
    kind: 'serif',
    stack: ['Charter', 'Bitstream Charter', 'Sitka Text', 'Cambria', 'serif'],
  },
  {
    id: 'old-style',
    kind: 'serif',
    stack: ['Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', 'P052', 'serif'],
  },
  {
    id: 'classic-serif',
    kind: 'serif',
    stack: ['Times New Roman', 'Georgia', 'Liberation Serif', 'Noto Serif', 'serif'],
  },
  {
    id: 'slab-serif',
    kind: 'serif',
    stack: ['Rockwell', 'Rockwell Nova', 'Roboto Slab', 'DejaVu Serif', 'serif'],
  },
  {
    id: 'monospace-code',
    kind: 'monospace',
    stack: [
      'ui-monospace',
      'Cascadia Code',
      'Source Code Pro',
      'Menlo',
      'Consolas',
      'DejaVu Sans Mono',
      'monospace',
    ],
  },
];

const MAX_PICKS = 2;

export function presetPicks(
  preset: Preset,
  dataset: OsFontsDataset,
  systems: readonly OsId[],
): Partial<Record<OsId, string[]>> {
  const byFamily = new Map(dataset.fonts.map((font) => [font.family.toLowerCase(), font]));
  const picks: Partial<Record<OsId, string[]>> = {};
  for (const os of systems) {
    const ids: string[] = [];
    for (const name of preset.stack) {
      const font = byFamily.get(name.toLowerCase());
      if (
        font &&
        font.category === preset.kind &&
        osAvailability(font, os, dataset).level === 'preinstalled'
      ) {
        ids.push(font.id);
      }
      if (ids.length >= MAX_PICKS) break;
    }
    if (ids.length > 0) picks[os] = ids;
  }
  return picks;
}

export function cssStack(preset: Preset): string {
  const generic = new Set([
    'serif',
    'sans-serif',
    'monospace',
    'system-ui',
    'ui-monospace',
    '-apple-system',
  ]);
  return preset.stack
    .map((name) => (generic.has(name) || /^[a-z-]+$/i.test(name) ? name : `"${name}"`))
    .join(', ');
}
