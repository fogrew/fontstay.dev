import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const svg = readFileSync(new URL('../../public/favicon.svg', import.meta.url), 'utf8');
const out = (name) => fileURLToPath(new URL(`../../public/icons/${name}`, import.meta.url));
const icons = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['icon-maskable-512.png', 512, 0.2],
  ['apple-touch-icon.png', 180, 0],
];

const browser = await chromium.launch();
for (const [name, size, padding] of icons) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const inner = Math.round(size * (1 - padding * 2));
  const offset = Math.round((size - inner) / 2);
  await page.setContent(
    `<!doctype html><style>html,body{margin:0;width:${size}px;height:${size}px;background:#161a19}svg{position:absolute;left:${offset}px;top:${offset}px;width:${inner}px;height:${inner}px}</style>${svg}`,
  );
  await page.screenshot({ path: out(name), omitBackground: false });
  await page.close();
}
await browser.close();
console.log('icons written');
