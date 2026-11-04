// Regenerates src/modules/font-details/data/languages.json from CLDR exemplar characters.
import { writeFileSync } from 'node:fs';

const REF = '7d2b9cb11cec08f4d333ad73209deb3df0711c3b';
const BASE = `https://raw.githubusercontent.com/unicode-org/cldr-json/${REF}/cldr-json/cldr-misc-full/main/`;
const LISTING = `https://api.github.com/repos/unicode-org/cldr-json/contents/cldr-json/cldr-misc-full/main?ref=${REF}`;
const CODE = /^[a-z]{2,3}(-[A-Za-z]{4})?$/;
const EXTRA = ['sr-Latn'];
const MAX_CHARS = 300;

function expand(set) {
  const body = set.trim().replace(/^\[/, '').replace(/\]$/, '');
  const text = body
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\\(.)/gu, '$1')
    .replace(/[{}]/g, '');
  const chars = [...text.normalize('NFC')];
  const out = new Set();
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (/\s/u.test(char)) continue;
    if (chars[i + 1] === '-' && chars[i + 2] && !/\s/u.test(chars[i + 2])) {
      const from = char.codePointAt(0);
      const to = chars[i + 2].codePointAt(0);
      for (let point = from; point <= to; point++) out.add(point);
      i += 2;
    } else {
      out.add(char.codePointAt(0));
    }
  }
  return [...out].sort((a, b) => a - b);
}

const listing = await (await fetch(LISTING)).json();
const codes = listing
  .map((entry) => entry.name)
  .filter((name) => CODE.test(name) && (!name.includes('-') || EXTRA.includes(name)));

const languages = [];
for (const code of codes) {
  const response = await fetch(`${BASE}${code}/characters.json`);
  if (!response.ok) continue;
  const json = await response.json();
  const exemplar = json.main[code]?.characters?.exemplarCharacters;
  if (!exemplar) continue;
  const points = expand(exemplar).filter((point) => point > 0x20);
  if (points.length === 0 || points.length > MAX_CHARS) continue;
  languages.push([code, String.fromCodePoint(...points)]);
}

languages.sort((a, b) => a[0].localeCompare(b[0]));
writeFileSync(
  new URL('../src/modules/font-details/data/languages.json', import.meta.url),
  `${JSON.stringify({ source: `https://github.com/unicode-org/cldr-json/tree/${REF} (cldr-misc-full, main exemplar characters)`, languages })}\n`,
);
console.log(`${languages.length} languages`);
