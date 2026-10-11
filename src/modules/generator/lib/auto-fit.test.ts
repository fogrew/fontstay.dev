import { describe, expect, it } from 'vitest';
import { autoFit } from './auto-fit';
import { font } from './font.test-util';
import { rankFor } from './per-os';
import { webPredictFont } from './predict-input';

const ascii = Array.from({ length: 95 }, (_, index) => 0x20 + index);

describe('autoFit', () => {
  const web = font(ascii, 540);
  const ranking = rankFor(web, 'windows', 'en');
  const model = { web: webPredictFont(web, ranking), language: 'en' as const };
  const arial = ranking.candidates.find((item) => item.id === 'arial');

  it('never makes the estimated shift worse and keeps pinned values', async () => {
    if (!arial) throw new Error('Arial is missing');
    const result = await autoFit({
      candidate: arial,
      manual: { sizeAdjust: 1.3 },
      spacing: { letter: 0, word: 0 },
      pinSpacing: { letter: true, word: true },
      model,
    });
    expect(result?.adjustment.sizeAdjust).toBe(1.3);
    expect(result?.after).toBeLessThanOrEqual(result?.before ?? 0);
    expect(result?.spacing).toEqual({ letter: 0, word: 0 });
  });

  it('improves a badly matched fallback', async () => {
    if (!arial) throw new Error('Arial is missing');
    const result = await autoFit({
      candidate: { ...arial, adjustment: { ...arial.adjustment, sizeAdjust: 1.4 } },
      manual: {},
      spacing: { letter: 0, word: 0 },
      pinSpacing: { letter: true, word: true },
      model,
    });
    expect(result?.after).toBeLessThan(result?.before ?? 0);
  });

  it('stops when aborted', async () => {
    if (!arial) throw new Error('Arial is missing');
    const controller = new AbortController();
    controller.abort();
    const result = await autoFit({
      candidate: arial,
      manual: {},
      spacing: { letter: 0, word: 0 },
      pinSpacing: { letter: true, word: true },
      model,
      signal: controller.signal,
    });
    expect(result).toBeNull();
  });
});
