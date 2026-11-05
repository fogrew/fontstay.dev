import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEmulatedDevices } from './parse.ts';

const REPO = 'ChromeDevTools/devtools-frontend';
const FILE = 'front_end/models/emulation/EmulatedDevices.ts';
const output = fileURLToPath(
  new URL('../../src/modules/devices/data/devices.json', import.meta.url),
);

const headers = { 'user-agent': 'fontstay-devices/1.0' };
const ref = process.argv[2] ?? 'main';
if (!/^[\w./-]+$/.test(ref) || ref.includes('..')) throw new Error(`Invalid ref: ${ref}`);

const commitResponse = await fetch(`https://api.github.com/repos/${REPO}/commits/${ref}`, {
  headers,
});
if (!commitResponse.ok) throw new Error(`${REPO}@${ref}: HTTP ${commitResponse.status}`);
const commit = (await commitResponse.json()).sha;
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('Unexpected commit response');

const sourceUrl = `https://raw.githubusercontent.com/${REPO}/${commit}/${FILE}`;
const response = await fetch(sourceUrl, { headers });
if (!response.ok) throw new Error(`${sourceUrl}: HTTP ${response.status}`);

const devices = parseEmulatedDevices(await response.text());
if (devices.length < 20) throw new Error(`Expected at least 20 devices, got ${devices.length}`);

const source = `https://github.com/${REPO}/blob/${commit}/${FILE}`;
const rows = devices.map((device) => `    ${JSON.stringify(device)}`);
const lines = [
  '{',
  `  "source": ${JSON.stringify(source)},`,
  `  "commit": ${JSON.stringify(commit)},`,
  '  "devices": [',
  rows.join(',\n'),
  '  ]',
  '}',
  '',
];
writeFileSync(output, lines.join('\n'));
console.log(`${devices.length} devices from ${commit.slice(0, 12)} written`);
