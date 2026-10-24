import { describe, expect, it } from 'vitest';
import { classifyInput } from './classify-input';

describe('classifyInput', () => {
  it.each([
    ['', 'empty'],
    ['   \n ', 'empty'],
    ['Inter', 'name'],
    ['  Source Sans 3 ', 'name'],
    ['@font-face { font-family: A; src: url(a.woff2); }', 'css'],
    ['@import url("https://fonts.googleapis.com/css2?family=Inter");', 'css'],
    ['<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">', 'css'],
    ['https://fonts.googleapis.com/css2?family=Inter:wght@400', 'css'],
    ['{"v":1,"origin":"https://site.test"}', 'import'],
    ['a'.repeat(81), 'css'],
    ['line one\nline two', 'css'],
  ])('reads %j as %s', (text, kind) => {
    expect(classifyInput(text)).toBe(kind);
  });
});
