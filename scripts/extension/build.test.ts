import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { runner } from './build.mjs';

describe('extension build', () => {
  it('keeps extension/collect-run.js in sync with the shared collector', () => {
    const committed = readFileSync(
      new URL('../../extension/collect-run.js', import.meta.url),
      'utf8',
    );
    expect(committed).toBe(runner);
  });

  it('asks for base64 files because injection results must be serializable', () => {
    expect(runner).toContain('fontstayCollect(window, document, { base64: true })');
    expect(runner).not.toMatch(/^export /m);
  });
});
