export const SPECIMEN_PRESETS = {
  paper: { foreground: '#171717', background: '#ffffff' },
  ink: { foreground: '#f9fafb', background: '#111827' },
  cream: { foreground: '#242424', background: '#fff4d6' },
  blue: { foreground: '#ffffff', background: '#17325c' },
} as const;

export type SpecimenPreset = keyof typeof SPECIMEN_PRESETS;

export function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((index) => {
      const value = Number.parseInt(hex.slice(index, index + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

export function glyphsForPreview(points: Uint32Array): number[] {
  return Array.from(points).filter(
    (point) => point >= 0x20 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff),
  );
}

export function glyphAdvance(points: Uint32Array, advances: Float64Array, point: number): number {
  let low = 0;
  let high = points.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (points[middle] === point) return advances[middle] ?? 0;
    if ((points[middle] ?? 0) < point) low = middle + 1;
    else high = middle - 1;
  }
  return 0;
}
