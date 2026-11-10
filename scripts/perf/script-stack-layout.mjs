import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const FONT = new URL('../../tests/fixtures/fonts/SourceSansPro-Regular.woff2', import.meta.url);
const ROUNDS = Number(process.env.ROUNDS ?? 15);
const PARAGRAPHS = 200;

const CASES = [
  {
    name: 'Arabic',
    lang: 'ar',
    dir: 'rtl',
    text: 'النص العربي الطويل يحتاج إلى تشكيل كل كلمة بشكل صحيح عند عرضه في الصفحة ',
    current: '"Web", sans-serif',
    aware: '"Segoe UI", "Tahoma", "Geeza Pro", "Noto Sans Arabic", sans-serif',
  },
  {
    name: 'Emoji-heavy',
    lang: 'en',
    dir: 'ltr',
    text: 'Launch day 🚀 with the team 👩‍💻👨‍💻 and coffee ☕ plus cake 🎂 for everyone 🎉 ',
    current: '"Web", sans-serif',
    aware: '"Web", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
  },
];

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const browser = await chromium.launch();
const page = await browser.newPage();
const fontBase64 = readFileSync(FONT).toString('base64');
await page.setContent(
  `<style>@font-face{font-family:"Web";src:url(data:font/woff2;base64,${fontBase64}) format("woff2")}
   body{margin:0;width:600px;font-size:16px}p{margin:0}</style><body></body>`,
);
await page.evaluate(() => document.fonts.load('16px "Web"'));

const rows = [];
for (const testCase of CASES) {
  const measure = (family) =>
    page.evaluate(
      ({ text, lang, dir, family, paragraphs }) => {
        document.body.replaceChildren();
        document.body.lang = lang;
        document.body.dir = dir;
        document.body.style.fontFamily = family;
        for (let i = 0; i < paragraphs; i += 1) {
          const p = document.createElement('p');
          p.textContent = `${text.repeat(6)}${i}`;
          document.body.append(p);
        }
        const start = performance.now();
        const height = document.body.offsetHeight;
        return { ms: performance.now() - start, height };
      },
      { ...testCase, family, paragraphs: PARAGRAPHS },
    );

  await measure(testCase.current);
  await measure(testCase.aware);
  const current = [];
  const aware = [];
  const heights = [
    (await measure(testCase.current)).height,
    (await measure(testCase.aware)).height,
  ];
  if (heights[0] === heights[1]) {
    console.warn(
      `${testCase.name}: both stacks laid out to the same height; the system fonts may be missing`,
    );
  }
  for (let round = 0; round < ROUNDS; round += 1) {
    current.push((await measure(testCase.current)).ms);
    aware.push((await measure(testCase.aware)).ms);
  }
  rows.push({
    case: testCase.name,
    'web font first (ms)': median(current).toFixed(1),
    'script-aware (ms)': median(aware).toFixed(1),
    ratio: (median(current) / median(aware)).toFixed(2),
  });
}

console.log(`${browser.version()}, ${PARAGRAPHS} paragraphs, median of ${ROUNDS} rounds`);
console.table(rows);
await browser.close();
