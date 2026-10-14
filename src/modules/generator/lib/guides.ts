export const GUIDES = ['ascender', 'cap', 'x', 'baseline', 'descender'] as const;
export type GuideId = (typeof GUIDES)[number];

export type GuideOffsets = Record<GuideId, number>;

let canvas: CanvasRenderingContext2D | null | undefined;

export function guideOffsets(stack: string, size: number, lineHeight: number): GuideOffsets | null {
  canvas ??= document.createElement('canvas').getContext('2d');
  if (!canvas) return null;
  canvas.font = `${size}px ${stack}`;
  const reference = canvas.measureText('x');
  const content = reference.fontBoundingBoxAscent + reference.fontBoundingBoxDescent;
  const baseline = (size * lineHeight - content) / 2 + reference.fontBoundingBoxAscent;
  const rise = (text: string) => canvas?.measureText(text).actualBoundingBoxAscent ?? 0;
  const drop = (text: string) => canvas?.measureText(text).actualBoundingBoxDescent ?? 0;
  return {
    ascender: baseline - rise('bdhkl'),
    cap: baseline - rise('H'),
    x: baseline - rise('x'),
    baseline,
    descender: baseline + drop('gpqy'),
  };
}

export function guideImage(offsets: GuideOffsets, enabled: readonly GuideId[] = GUIDES): string {
  const stops = enabled
    .map((id) => ({ id, y: offsets[id] }))
    .sort((a, b) => a.y - b.y)
    .map(({ id, y }) => {
      const top = y.toFixed(2);
      const bottom = (y + 1).toFixed(2);
      return `transparent ${top}px, var(--ff-guide-${id}) ${top}px, var(--ff-guide-${id}) ${bottom}px, transparent ${bottom}px`;
    });
  return `linear-gradient(to bottom, ${stops.join(', ')})`;
}
