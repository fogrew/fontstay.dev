import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(
  new URL('../../src/modules/site-import/collector/collect.js', import.meta.url),
  'utf8',
);

export const runner = `${source.replace(/^export /m, '')}\nfontstayCollect(window, document, { base64: true });\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(new URL('../../extension/collect-run.js', import.meta.url), runner);
  console.log('extension/collect-run.js written');
}
