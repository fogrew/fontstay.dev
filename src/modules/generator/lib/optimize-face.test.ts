import { describe, expect, it } from 'vitest';
import { font } from './font.test-util';
import { optimizeFace } from './optimize-fit';
import { rankFor } from './per-os';
import { webPredictFont } from './predict-input';

const ascii = Array.from({ length: 95 }, (_, index) => 0x20 + index);

describe('optimizeFace', () => {
  const web = font(ascii, 540);
  const ranking = rankFor(web, 'windows', 'en');
  const model = { web: webPredictFont(web, ranking), language: 'en' as const };
  const arial = ranking.candidates.find((item) => item.id === 'arial');
  const start = { letter: 0.01, word: 0.02 };

  it('keeps the spacing when the face is not the free one', async () => {
    if (!arial) throw new Error('Arial is missing');
    const result = await optimizeFace({
      candidate: arial,
      widthK: 1,
      model,
      spacing: start,
      free: false,
    });
    expect(result?.spacing).toEqual(start);
  });

  it('keeps a manual spacing axis even for the free face', async () => {
    if (!arial) throw new Error('Arial is missing');
    const result = await optimizeFace({
      candidate: arial,
      widthK: 1,
      model,
      spacing: start,
      free: true,
      manualSpacing: { letter: true, word: true },
    });
    expect(result?.spacing).toEqual(start);
  });

  it('lets the free face move the spacing', async () => {
    if (!arial) throw new Error('Arial is missing');
    const result = await optimizeFace({
      candidate: { ...arial, adjustment: { ...arial.adjustment, sizeAdjust: 1.4 } },
      widthK: 1,
      model,
      spacing: { letter: 0, word: 0 },
      free: true,
    });
    expect(result?.spacing).not.toEqual({ letter: 0, word: 0 });
  });

  it('returns null when aborted', async () => {
    if (!arial) throw new Error('Arial is missing');
    const controller = new AbortController();
    controller.abort();
    const result = await optimizeFace({
      candidate: arial,
      widthK: 1,
      model,
      spacing: start,
      free: true,
      signal: controller.signal,
    });
    expect(result).toBeNull();
  });
});
