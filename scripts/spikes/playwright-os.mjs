import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium, devices } from '@playwright/test';

const started = performance.now();
const output = path.resolve(process.argv[2] ?? 'test-results/playwright-os');
await mkdir(output, { recursive: true });
const fixture = await readFile(
  new URL('../../tests/fixtures/fonts/SourceSansPro-Regular.woff2', import.meta.url),
);
const families = ['Arial', 'Segoe UI', 'Helvetica Neue', 'Times New Roman'];
const browser = await chromium.launch();
const results = [];
try {
  for (const preset of ['Native Chromium', 'Desktop Chrome', 'iPhone 13']) {
    const context = await browser.newContext({
      ...(preset === 'Native Chromium' ? {} : devices[preset]),
      viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 1,
      locale: 'en-US',
      colorScheme: 'light',
      reducedMotion: 'reduce',
    });
    try {
      const page = await context.newPage();
      const measurement = await page.evaluate(
        async ({ families, bytes }) => {
          const sheet = new CSSStyleSheet();
          sheet.replaceSync(`
            .ff-probe { margin: 24px; color: #111; background: #fff; }
            .ff-probe__sample { width: 440px; font-size: 32px; line-height: normal; }
          `);
          document.adoptedStyleSheets = [sheet];
          document.body.className = 'ff-probe';
          const fixtureFace = await new FontFace('Probe Web', new Uint8Array(bytes)).load();
          document.fonts.add(fixtureFace);
          const available = {};
          for (const [index, family] of families.entries()) {
            try {
              const face = await new FontFace(`Probe Local ${index}`, `local("${family}")`).load();
              document.fonts.add(face);
              available[family] = true;
            } catch {
              available[family] = false;
            }
          }
          const sample = 'Hamburgefontsiv 0123456789. The quick brown fox jumps over the lazy dog.';
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const metrics = {};
          for (const family of ['Probe Web', ...families, 'monospace']) {
            const heading = document.createElement('h2');
            heading.textContent = family;
            const paragraph = document.createElement('div');
            paragraph.className = 'ff-probe__sample';
            paragraph.textContent = sample;
            paragraph.style.fontFamily =
              family === 'Probe Web'
                ? '"Probe Web", monospace'
                : available[family]
                  ? `"Probe Local ${families.indexOf(family)}", monospace`
                  : 'monospace';
            document.body.append(heading, paragraph);
            ctx.font = `32px ${paragraph.style.fontFamily}`;
            const measured = ctx.measureText(sample);
            metrics[family] = {
              width: measured.width,
              ascent: measured.actualBoundingBoxAscent,
              descent: measured.actualBoundingBoxDescent,
              blockHeight: paragraph.getBoundingClientRect().height,
            };
          }
          await document.fonts.ready;
          return { userAgent: navigator.userAgent, available, metrics };
        },
        { families, bytes: [...fixture] },
      );
      const screenshot = await page.screenshot({ fullPage: true });
      const name = preset.toLowerCase().replaceAll(' ', '-');
      await writeFile(path.join(output, `${name}.png`), screenshot);
      results.push({
        preset,
        ...measurement,
        screenshotSha256: createHash('sha256').update(screenshot).digest('hex'),
      });
    } finally {
      await context.close();
    }
  }
  const report = {
    host: { platform: os.platform(), release: os.release(), arch: os.arch() },
    node: process.version,
    browser: browser.version(),
    fixtureSha256: createHash('sha256').update(fixture).digest('hex'),
    durationSeconds: (performance.now() - started) / 1000,
    results,
  };
  await writeFile(path.join(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
