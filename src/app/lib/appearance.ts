export type Theme = 'system' | 'light' | 'dark';
export type Vision =
  | 'none'
  | 'protanopia'
  | 'deuteranopia'
  | 'tritanopia'
  | 'achromatopsia'
  | 'blur';
export type Aid = 'contrast' | 'motion' | 'spacing' | 'largeText';
export type Appearance = { theme: Theme; vision: Vision } & Record<Aid, boolean>;

export const appearanceKey = 'fontstay:appearance';
export const defaults: Appearance = {
  theme: 'system',
  vision: 'none',
  contrast: false,
  motion: false,
  spacing: false,
  largeText: false,
};

export function parseAppearance(raw: string | null): Appearance {
  if (!raw) return { ...defaults };
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return { ...defaults };
    const item = value as Record<string, unknown>;
    return {
      theme: item.theme === 'light' || item.theme === 'dark' ? item.theme : 'system',
      vision: ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia', 'blur'].includes(
        String(item.vision),
      )
        ? (item.vision as Vision)
        : 'none',
      contrast: item.contrast === true,
      motion: item.motion === true,
      spacing: item.spacing === true,
      largeText: item.largeText === true,
    };
  } catch {
    return { ...defaults };
  }
}

export function applyAppearance(root: HTMLElement, appearance: Appearance): void {
  if (appearance.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = appearance.theme;
  if (appearance.vision === 'none') delete root.dataset.vision;
  else root.dataset.vision = appearance.vision;
  for (const aid of ['contrast', 'motion', 'spacing', 'largeText'] as const) {
    if (appearance[aid]) root.dataset[aid] = '';
    else delete root.dataset[aid];
  }
}
