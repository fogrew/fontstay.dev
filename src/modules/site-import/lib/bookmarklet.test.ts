import { describe, expect, it } from 'vitest';
import { bookmarkletHref, bookmarkletSource } from './bookmarklet';

const options = {
  origin: 'https://fontstay.dev',
  locale: 'en',
  copied: "Copied $& $' $` done",
  failed: 'Failed',
};

describe('bookmarklet', () => {
  it('inserts the options literally, even with replacement patterns', () => {
    const source = bookmarkletSource(options);
    expect(source).toContain(JSON.stringify(options.copied));
    expect(source).toContain('"https://fontstay.dev"');
    expect(source).toContain('"/en/import/"');
    expect(source).not.toContain('__TARGET__');
    expect(source).not.toContain('export ');
  });

  it('is one self-invoking line that parses as JavaScript', () => {
    const source = bookmarkletSource(options);
    expect(source).not.toContain('\n');
    expect(() => new Function(source)).not.toThrow();
  });

  it('builds a javascript: URL that round-trips', () => {
    const href = bookmarkletHref(options);
    expect(new URL(href).protocol).toBe('javascript:');
    expect(decodeURIComponent(href.slice('javascript:'.length))).toBe(bookmarkletSource(options));
    expect(href.length).toBeLessThan(16000);
    expect(href).not.toContain('#');
  });

  it('addresses the message to the exact generator origin and waits for the handshake', () => {
    const source = bookmarkletSource(options);
    expect(source).toContain('event.origin !== target');
    expect(source).toContain('event.source !== child');
    expect(source).toContain('fontstay:ready');
  });
});
