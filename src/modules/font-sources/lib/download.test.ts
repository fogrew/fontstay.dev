import { describe, expect, it } from 'vitest';
import { isHttpsUrl, readBounded } from './download';

describe('isHttpsUrl', () => {
  it('accepts the exact host and path over https only', () => {
    expect(isHttpsUrl('https://cdn.example/fonts/a.woff2', 'cdn.example', '/fonts/')).toBe(true);
    expect(isHttpsUrl('https://cdn.example/other/a.woff2', 'cdn.example', '/fonts/')).toBe(false);
    expect(isHttpsUrl('http://cdn.example/fonts/a', 'cdn.example', '/fonts/')).toBe(false);
    expect(isHttpsUrl('https://cdn.example:8443/fonts/a', 'cdn.example', '/fonts/')).toBe(false);
    expect(isHttpsUrl('https://u:p@cdn.example/fonts/a', 'cdn.example', '/fonts/')).toBe(false);
    expect(isHttpsUrl('https://cdn.example.evil/fonts/a', 'cdn.example', '/fonts/')).toBe(false);
    expect(isHttpsUrl('not a url', 'cdn.example')).toBe(false);
  });
});

describe('readBounded', () => {
  it('stops a stream that exceeds the limit without a content-length', async () => {
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(600));
      },
    });
    await expect(readBounded(new Response(stream), 1000)).rejects.toMatchObject({
      code: 'too-large',
    });
  });

  it('returns the bytes within the limit', async () => {
    const bytes = await readBounded(new Response(new Uint8Array([1, 2, 3])), 10);
    expect(bytes.byteLength).toBe(3);
  });
});
