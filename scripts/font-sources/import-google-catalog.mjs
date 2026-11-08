import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://fonts.google.com/metadata/fonts';
const output = fileURLToPath(
  new URL('../../src/modules/font-sources/data/google-catalog.json', import.meta.url),
);

const response = await fetch(SOURCE, { headers: { 'user-agent': 'fontstay-catalog/1.0' } });
if (!response.ok) throw new Error(`${SOURCE}: HTTP ${response.status}`);
const text = (await response.text()).replace(/^\)\]\}'\n?/, '');
const list = JSON.parse(text).familyMetadataList;
if (!Array.isArray(list) || list.length < 1000) {
  throw new Error(`Google Fonts catalog: expected at least 1000 families, got ${list?.length}`);
}

const LICENSES = ['OFL-1.1', 'Apache-2.0', 'UFL-1.0'];
const GITHUB = 'https://api.github.com/repos/google/fonts/git/trees';
const githubTree = async (ref) => {
  const reply = await fetch(`${GITHUB}/${ref}`, {
    headers: { 'user-agent': 'fontstay-catalog/1.0' },
  });
  if (!reply.ok) throw new Error(`${GITHUB}/${ref}: HTTP ${reply.status}`);
  return (await reply.json()).tree;
};
const root = await githubTree('main');
const licenseOf = new Map();
for (const [index, directory] of ['ofl', 'apache', 'ufl'].entries()) {
  const entry = root.find((item) => item.path === directory);
  if (!entry) throw new Error(`google/fonts: no ${directory} directory`);
  for (const item of await githubTree(entry.sha)) licenseOf.set(item.path, index);
}
const folder = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

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
    licenseOf.get(folder(item.family)) ?? 0,
  ]);

writeFileSync(
  output,
  `${JSON.stringify({ source: SOURCE, categories: CATEGORIES, licenses: LICENSES, families })}\n`,
);
console.log(`${families.length} families written`);
