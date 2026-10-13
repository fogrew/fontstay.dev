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

async function localFaceExists(name: string): Promise<boolean> {
  try {
    await new FontFace('ff-probe', `local(${JSON.stringify(name)})`).load();
    return true;
  } catch {
    return false;
  }
}

export async function isInstalledOnDevice(names: readonly string[]): Promise<boolean> {
  if (typeof FontFace === 'undefined') {
    const measure = canvasMeasure();
    return measure ? isInstalled(names, measure) : true;
  }
  const found = await Promise.all(names.map(localFaceExists));
  if (found.some(Boolean)) return true;
  const measure = canvasMeasure();
  return measure ? isInstalled(names, measure) : false;
}
