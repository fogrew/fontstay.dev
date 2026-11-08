export const DEFAULT_FONT_LIMIT = 32;
export const MIN_FONT_LIMIT = 1;
export const MAX_FONT_LIMIT = 128;
const KEY = 'fontstay:font-limit';

export function clampFontLimit(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FONT_LIMIT;
  return Math.min(MAX_FONT_LIMIT, Math.max(MIN_FONT_LIMIT, Math.round(value)));
}

export function loadFontLimit(): number {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? DEFAULT_FONT_LIMIT : clampFontLimit(Number(raw));
  } catch {
    return DEFAULT_FONT_LIMIT;
  }
}

export function saveFontLimit(value: number): void {
  try {
    localStorage.setItem(KEY, String(value));
  } catch {
    // storage may be unavailable
  }
}
