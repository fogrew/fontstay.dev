import type { FontMetrics } from '@/modules/font-metrics';

const MIN_ASPECT = 0.1;
const MAX_ASPECT = 1.2;

export function aspectOf(web: FontMetrics): number | null {
  if (!web.xHeight || web.xHeight <= 0 || web.unitsPerEm <= 0) return null;
  const aspect = web.xHeight / web.unitsPerEm;
  return aspect >= MIN_ASPECT && aspect <= MAX_ASPECT ? aspect : null;
}

const trimmed = (value: number) => Number.parseFloat(value.toFixed(4)).toString();

export function safariStrategyCss(aspect: number, lineHeight: number): string {
  if (!Number.isFinite(aspect) || !Number.isFinite(lineHeight) || lineHeight <= 0) {
    throw new RangeError('Invalid Safari strategy values');
  }
  return `/* Safari has no vertical overrides: match the x-height and fix the line box */
font-size-adjust: ${trimmed(aspect)};
line-height: ${trimmed(lineHeight)};`;
}
