import { describe, expect, it } from 'vitest';
import { isBrowserslistFile, parseBrowserslist } from './browserslist-file';

describe('parseBrowserslist', () => {
  it('reads one query per line and drops comments and blanks', () => {
    expect(parseBrowserslist('# targets\n> 0.5%\n\nlast 2 versions # recent\nnot dead\n')).toEqual([
      '> 0.5%',
      'last 2 versions',
      'not dead',
    ]);
  });

  it('splits comma lists and removes duplicates', () => {
    expect(parseBrowserslist('chrome 120, safari 17\nchrome 120\r\n')).toEqual([
      'chrome 120',
      'safari 17',
    ]);
  });

  it('prefers the production section and ignores extends', () => {
    const text = '[development]\nlast 1 chrome version\n[production]\n> 1%\nextends my-config\n';
    expect(parseBrowserslist(text)).toEqual(['> 1%']);
    expect(parseBrowserslist('[modern]\nlast 2 versions\n[legacy]\nie 11')).toEqual([
      'last 2 versions',
    ]);
  });

  it('reads the browserslist key of a package.json', () => {
    expect(parseBrowserslist('{"browserslist": ["> 1%", "not dead"]}')).toEqual([
      '> 1%',
      'not dead',
    ]);
    expect(parseBrowserslist('{"browserslist": {"production": ["defaults"]}}')).toEqual([
      'defaults',
    ]);
    expect(parseBrowserslist('{"name": "x"}')).toEqual([]);
    expect(parseBrowserslist('{broken')).toEqual([]);
  });

  it('bounds the number and length of the queries', () => {
    const many = Array.from({ length: 100 }, (_, index) => `chrome ${index + 1}`).join('\n');
    expect(parseBrowserslist(many)).toHaveLength(40);
    expect(parseBrowserslist('x'.repeat(1000))[0]).toHaveLength(200);
  });

  it('recognises the file names', () => {
    for (const name of ['.browserslistrc', '.browserslist', 'browserslist', 'package.json']) {
      expect(isBrowserslistFile(name)).toBe(true);
    }
    expect(isBrowserslistFile('font.woff2')).toBe(false);
  });
});
