import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ARTICLE_LANGUAGES, type ArticleId, loadArticle } from './articles';

const SUBSET: Record<string, string> = {
  ar: 'arabic',
  ja: 'japanese',
  he: 'hebrew',
  hi: 'devanagari',
  bn: 'bengali',
  ta: 'tamil',
  th: 'thai',
  ko: 'korean',
  'zh-Hans': 'chinese-simplified',
  'zh-Hant': 'chinese-traditional',
  km: 'khmer',
  te: 'telugu',
  gu: 'gujarati',
  pa: 'gurmukhi',
  kn: 'kannada',
  ml: 'malayalam',
  si: 'sinhala',
  am: 'ethiopic',
  hy: 'armenian',
  el: 'greek',
  lo: 'lao',
  ru: 'cyrillic',
  en: 'latin',
};

const RANGES: Record<string, [number, number][]> = {
  he: [[0x590, 0x5ff]],
  hi: [[0x900, 0x97f]],
  bn: [[0x980, 0x9ff]],
  ta: [[0xb80, 0xbff]],
  th: [[0xe00, 0xe7f]],
  ko: [[0xac00, 0xd7af]],
  km: [[0x1780, 0x17ff]],
  te: [[0xc00, 0xc7f]],
  gu: [[0xa80, 0xaff]],
  pa: [[0xa00, 0xa7f]],
  kn: [[0xc80, 0xcff]],
  ml: [[0xd00, 0xd7f]],
  si: [[0xd80, 0xdff]],
  am: [[0x1200, 0x137f]],
  hy: [[0x530, 0x58f]],
  el: [[0x370, 0x3ff]],
  lo: [[0xe80, 0xeff]],
  'zh-Hans': [[0x4e00, 0x9fff]],
  'zh-Hant': [[0x4e00, 0x9fff]],
};

const families = (
  JSON.parse(readFileSync('src/modules/font-sources/data/google-catalog.json', 'utf8')) as {
    families: [string, number, string[]][];
  }
).families;

describe('article languages', () => {
  it('only offers scripts with at least five Google Fonts families', () => {
    for (const [id] of ARTICLE_LANGUAGES) {
      const subset = SUBSET[id];
      expect(subset, id).toBeDefined();
      const count = families.filter((family) => family[2].includes(subset as string)).length;
      expect(count, `${id} (${subset})`).toBeGreaterThanOrEqual(5);
    }
  });

  it('has a complete article in the right script for every language', async () => {
    for (const [id] of ARTICLE_LANGUAGES) {
      const article = await loadArticle(id as ArticleId);
      expect(article, id).toBeDefined();
      if (!article) continue;
      expect(article.id).toBe(id);
      expect(article.lang).toBe(id);
      for (const value of [article.title, article.lead, article.glyphs, article.footer]) {
        expect(value.length, id).toBeGreaterThan(5);
      }
      expect(article.columns.length).toBeGreaterThan(0);
      const ranges = RANGES[id];
      if (ranges) {
        const letters = [...`${article.title}${article.lead}${article.glyphs}`];
        const inScript = letters.filter((char) => {
          const code = char.codePointAt(0) ?? 0;
          return ranges.some(([from, to]) => code >= from && code <= to);
        });
        expect(inScript.length / letters.length, id).toBeGreaterThan(0.4);
      }
    }
  });

  it('marks right-to-left languages', async () => {
    for (const id of ['ar', 'he'] as const) {
      expect((await loadArticle(id))?.dir).toBe('rtl');
    }
    expect((await loadArticle('th'))?.dir).toBe('ltr');
  });
});
