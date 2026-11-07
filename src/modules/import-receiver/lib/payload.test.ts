import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  cleanName,
  cleanText,
  cleanUrl,
  MAX_FILE_BYTES,
  MAX_FILES,
  parseClipboardImport,
  sanitizeImport,
} from './payload';

const ORIGIN = 'https://example.com';
const bytes = (size: number) => new ArrayBuffer(size);

describe('cleanText', () => {
  it('removes control, bidi and format characters and collapses whitespace', () => {
    expect(cleanText('a\u0000b\u202ec\u2066d\n\t e', 50)).toBe('a b c d e');
    expect(cleanText('\u200bhidden\u0085line', 50)).toBe('hidden line');
  });

  it('keeps joiners and caps the length by code points', () => {
    expect(cleanText('a\u200db', 10)).toBe('a\u200db');
    expect(cleanText('😀😀😀😀', 2)).toBe('😀😀');
    expect(cleanText('\ud800 lone', 20)).not.toContain('\ud800');
  });

  it('collapses stacks of combining marks', () => {
    const marks = String.fromCodePoint(0x301);
    expect(cleanText(`a${marks.repeat(50)}b`, 100)).toBe(`a${marks.repeat(3)}b`);
  });

  it('rejects non-strings', () => {
    expect(cleanText(42, 10)).toBe('');
    expect(cleanText({ toString: () => 'x' }, 10)).toBe('');
  });
});

describe('cleanName and cleanUrl', () => {
  it('keeps a safe base name only', () => {
    expect(cleanName('../../etc/passwd')).toBe('passwd');
    expect(cleanName('C:\\fonts\\a<b>.woff2')).toBe('a-b-.woff2');
    expect(cleanName('')).toBe('font');
    expect(cleanName('.hidden')).toBe('hidden');
  });

  it('accepts https URLs without credentials only', () => {
    expect(cleanUrl('https://cdn.example/a.woff2')).toBe('https://cdn.example/a.woff2');
    expect(cleanUrl('http://cdn.example/a.woff2')).toBeUndefined();
    expect(cleanUrl('javascript:alert(1)')).toBeUndefined();
    expect(cleanUrl('data:font/woff2;base64,AAAA')).toBeUndefined();
    expect(cleanUrl('https://user:pass@cdn.example/a')).toBeUndefined();
    expect(cleanUrl(`https://cdn.example/${'a'.repeat(3000)}`)).toBeUndefined();
  });
});

describe('sanitizeImport', () => {
  const good = {
    v: 1,
    title: ' My <b>site</b> ',
    faces: [{ family: 'Inter', weight: 700, style: 'italic', url: 'https://cdn.example/i.woff2' }],
    used: [{ role: 'body', family: 'Inter, sans-serif', size: 16, lineHeight: 1.5, weight: 400 }],
    samples: [{ role: 'heading', text: 'Hello' }],
    files: [{ name: 'Inter.woff2', bytes: bytes(10) }],
  };

  it('rebuilds a well-formed payload and trusts only the given origin', () => {
    const result = sanitizeImport({ ...good, origin: 'https://evil.example' }, ORIGIN, true);
    expect(result).toMatchObject({
      origin: ORIGIN,
      verified: true,
      title: 'My <b>site</b>',
      faces: [{ family: 'Inter', weight: 700, style: 'italic' }],
      used: [{ role: 'body', size: 16, lineHeight: 1.5 }],
    });
    expect(result?.files).toHaveLength(1);
    expect(result).not.toHaveProperty('samples');
  });

  it('rejects other versions, other shapes and unknown origins', () => {
    expect(sanitizeImport({ ...good, v: 2 }, ORIGIN, true)).toBeNull();
    expect(sanitizeImport([], ORIGIN, true)).toBeNull();
    expect(sanitizeImport(null, ORIGIN, true)).toBeNull();
    expect(sanitizeImport(good, 'null', true)).toBeNull();
    expect(sanitizeImport(good, 'javascript:alert(1)', true)).toBeNull();
    expect(sanitizeImport({ v: 1 }, ORIGIN, true)).toBeNull();
  });

  it('drops invalid entries instead of failing the whole payload', () => {
    const result = sanitizeImport(
      {
        v: 1,
        faces: [{ family: '' }, 7, { family: 'A', weight: 'bold', style: 'oblique' }],
        used: [
          { role: 'footer', family: 'x', size: 10 },
          { role: 'h1', family: 'x', size: -3 },
          { role: 'h1', family: 'X', size: 32 },
        ],
        files: [
          { name: 'a', bytes: 'not a buffer' },
          { name: 'b', bytes: bytes(0) },
          { name: 'c', bytes: bytes(MAX_FILE_BYTES + 1) },
          { name: 'd', bytes: bytes(5) },
        ],
      },
      ORIGIN,
      true,
    );
    expect(result?.faces).toEqual([{ family: 'A', weight: 400, style: 'normal' }]);
    expect(result?.used).toEqual([{ role: 'h1', family: 'X', size: 32, weight: 400 }]);
    expect(result?.files.map((file) => file.name)).toEqual(['d']);
  });

  it('limits the number and the total size of files', () => {
    const many = Array.from({ length: MAX_FILES + 5 }, (_, index) => ({
      name: `f${index}`,
      bytes: bytes(1),
    }));
    expect(sanitizeImport({ v: 1, files: many }, ORIGIN, true)?.files).toHaveLength(MAX_FILES);
    const big = Array.from({ length: 4 }, (_, index) => ({
      name: `b${index}`,
      bytes: bytes(MAX_FILE_BYTES),
    }));
    expect(sanitizeImport({ v: 1, files: big }, ORIGIN, true)?.files).toHaveLength(3);
  });

  it('does not copy unknown keys or prototype pollution', () => {
    const polluted = JSON.parse(
      '{"v":1,"__proto__":{"polluted":true},"faces":[{"family":"A","__proto__":{"x":1},"extra":1}]}',
    );
    const result = sanitizeImport(polluted, ORIGIN, true);
    expect(result?.faces[0]).toEqual({ family: 'A', weight: 400, style: 'normal' });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('never throws and never returns control characters for arbitrary input', () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        const result = sanitizeImport(raw, ORIGIN, true);
        if (!result) return true;
        return !/\p{Cc}/u.test(result.title);
      }),
      { numRuns: 300 },
    );
  });
});

describe('text samples', () => {
  it('ignores the text of the site', () => {
    const result = sanitizeImport(
      { v: 1, faces: [{ family: 'A' }], samples: [{ role: 'body', text: 'Some article text' }] },
      ORIGIN,
      false,
    );
    expect(result).not.toHaveProperty('samples');
    expect(JSON.stringify(result)).not.toContain('article text');
  });

  it('rejects a payload that only carries text', () => {
    expect(
      sanitizeImport({ v: 1, samples: [{ role: 'body', text: 'text' }] }, ORIGIN, false),
    ).toBeNull();
  });
});

describe('parseClipboardImport', () => {
  it('reads metadata, marks it unverified and never carries files', () => {
    const result = parseClipboardImport(
      JSON.stringify({
        v: 1,
        origin: 'https://example.com/path',
        faces: [{ family: 'Inter' }],
        files: [{ name: 'a', bytes: [1, 2, 3] }],
      }),
    );
    expect(result).toMatchObject({ origin: ORIGIN, verified: false, files: [] });
  });

  it('rejects invalid JSON, huge text and a missing origin', () => {
    expect(parseClipboardImport('not json')).toBeNull();
    expect(parseClipboardImport(' '.repeat(300_000))).toBeNull();
    expect(parseClipboardImport(JSON.stringify({ v: 1, faces: [{ family: 'A' }] }))).toBeNull();
  });
});

describe('sanitizeImport rules', () => {
  const base = { v: 1, faces: [{ family: 'A' }] };

  it('keeps well-formed rules and drops rules with a malformed range', () => {
    const result = sanitizeImport(
      {
        ...base,
        rules: [
          { family: 'A', weight: '700', style: 'italic', unicodeRange: 'U+0-FF, U+4??' },
          { family: 'A', weight: 'bold', unicodeRange: '<script>' },
          { family: 'A', weight: '100 900' },
          { family: 'A', weight: 'x'.repeat(30), unicodeRange: `U+0,${' U+1,'.repeat(1000)}` },
          { family: 'A', weight: 5 },
          { family: '' },
          'x',
        ],
      },
      ORIGIN,
      true,
    );
    expect(result?.rules).toEqual([
      { family: 'A', weight: '700', style: 'italic', unicodeRange: 'U+0-FF, U+4??' },
      { family: 'A', weight: '100 900', style: 'normal' },
      { family: 'A', weight: '400', style: 'normal' },
    ]);
  });

  it('caps the number of rules and tolerates a missing or invalid list', () => {
    const many = Array.from({ length: 400 }, () => ({ family: 'A' }));
    expect(sanitizeImport({ ...base, rules: many }, ORIGIN, true)?.rules).toHaveLength(256);
    expect(sanitizeImport(base, ORIGIN, true)?.rules).toEqual([]);
    expect(sanitizeImport({ ...base, rules: 'x' }, ORIGIN, true)?.rules).toEqual([]);
  });
});
