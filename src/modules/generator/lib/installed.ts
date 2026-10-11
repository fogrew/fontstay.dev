const PROBE_TEXT = 'mmmmmmmmmmlliWW@#0123456789';
const BASES = ['monospace', 'serif', 'sans-serif'] as const;

export type Measure = (fontFamily: string) => number;

export function isInstalled(names: readonly string[], measure: Measure): boolean {
  return names.some((name) => {
    const quoted = JSON.stringify(name);
    return BASES.some((base) => measure(`${quoted}, ${base}`) !== measure(base));
  });
}

export function canvasMeasure(): Measure | null {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;
  return (fontFamily) => {
    context.font = `72px ${fontFamily}`;
    return context.measureText(PROBE_TEXT).width;
  };
}
