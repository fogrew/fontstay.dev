import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const API = 'https://api.fontsource.org/v1/fonts';
const output = fileURLToPath(
  new URL('../../src/modules/font-sources/data/fontsource-catalog.json', import.meta.url),
);

const response = await fetch(API, { headers: { 'user-agent': 'fontstay-catalog/1.0' } });
if (!response.ok) throw new Error(`${API}: HTTP ${response.status}`);
const list = (await response.json()).filter((item) => item.type === 'other');
if (list.length < 50)
  throw new Error(`Fontsource catalog: expected at least 50 fonts, got ${list.length}`);

const CATEGORIES = ['Sans Serif', 'Serif', 'Monospace', 'Display', 'Handwriting', 'Other'];
const NAMES = { 'sans-serif': 0, serif: 1, monospace: 2, display: 3, handwriting: 4 };
const families = [];
for (const item of list.sort((a, b) => a.family.localeCompare(b.family))) {
  const detail = await (
    await fetch(`${API}/${item.id}`, { headers: { 'user-agent': 'fontstay-catalog/1.0' } })
  ).json();
  const styles = [];
  for (const [weight, byStyle] of Object.entries(detail.variants ?? {})) {
    for (const style of Object.keys(byStyle)) {
      if (style === 'normal' || style === 'italic')
        styles.push(`${weight}${style === 'italic' ? 'i' : ''}`);
    }
  }
  styles.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10) || a.length - b.length);
  if (styles.length === 0) continue;
  families.push([item.id, item.family, NAMES[item.category] ?? 5, item.subsets, styles]);
}

writeFileSync(output, `${JSON.stringify({ source: API, categories: CATEGORIES, families })}\n`);
console.log(`${families.length} families written`);
