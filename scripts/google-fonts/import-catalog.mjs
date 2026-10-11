import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://fonts.google.com/metadata/fonts';
const output = fileURLToPath(
  new URL('../../src/modules/google-fonts/data/catalog.json', import.meta.url),
);

const response = await fetch(SOURCE, { headers: { 'user-agent': 'fontstay-catalog/1.0' } });
if (!response.ok) throw new Error(`${SOURCE}: HTTP ${response.status}`);
const text = (await response.text()).replace(/^\)\]\}'\n?/, '');
const list = JSON.parse(text).familyMetadataList;
if (!Array.isArray(list) || list.length < 1000) {
  throw new Error(`Google Fonts catalog: expected at least 1000 families, got ${list?.length}`);
}

const CATEGORIES = ['Sans Serif', 'Serif', 'Monospace', 'Display', 'Handwriting'];
const families = list
  .filter((item) => item.isOpenSource !== false)
  .sort((a, b) => (a.popularity ?? 1e9) - (b.popularity ?? 1e9))
  .map((item) => [
    item.family,
    Math.max(0, CATEGORIES.indexOf(item.category)),
    item.subsets.filter((subset) => subset !== 'menu'),
    Object.keys(item.fonts),
    (item.axes ?? []).map((axis) => axis.tag),
  ]);

writeFileSync(output, `${JSON.stringify({ source: SOURCE, categories: CATEGORIES, families })}\n`);
console.log(`${families.length} families written`);
