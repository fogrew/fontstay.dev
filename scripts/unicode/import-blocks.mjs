import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SOURCE = 'https://www.unicode.org/Public/16.0.0/ucd/Blocks.txt';
const output = fileURLToPath(
  new URL('../../src/modules/font-metrics/data/blocks.json', import.meta.url),
);

const response = await fetch(SOURCE, { headers: { 'user-agent': 'fontstay-unicode-import/1.0' } });
if (!response.ok) throw new Error(`${SOURCE}: HTTP ${response.status}`);
const text = await response.text();
const blocks = [];
for (const line of text.split('\n')) {
  const match = /^([0-9A-F]+)\.\.([0-9A-F]+); (.+)$/.exec(line.trim());
  if (match) blocks.push([Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), match[3]]);
}
if (blocks.length < 300)
  throw new Error(`Unicode blocks: expected at least 300, got ${blocks.length}`);
writeFileSync(output, `${JSON.stringify({ source: SOURCE, blocks })}\n`);
console.log(`${blocks.length} blocks written`);
