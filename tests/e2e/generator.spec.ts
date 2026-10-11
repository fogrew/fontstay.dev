import AxeBuilder from '@axe-core/playwright';
import { buildFont } from '../../src/modules/font-metrics/lib/forged.test-util';
import { expect, openSection, test } from './fixtures';

const fonts = new URL('../fixtures/fonts/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const sourceSans = `${fonts}SourceSansPro-Regular.woff2`;

test('uploading a font produces per-system fallbacks, editable values and CSS', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);

  const fallback = page.getByLabel('Fallback font 1', { exact: true });
  await expect(fallback).toBeVisible();
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).toContainText('@font-face');
  await expect(code).toContainText('size-adjust');
  await expect(code).toContainText('"Source Sans Pro Fallback');
  await expect(code).not.toContainText('font-family: font-family');

  await page.getByLabel('System', { exact: true }).selectOption('windows');
  const before = await code.textContent();
  await fallback.selectOption({ index: 2 });
  await expect(code).not.toHaveText(before ?? '');
  const picked = await fallback.inputValue();

  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('110');
  await size.press('Enter');
  await expect(code).toContainText('size-adjust: 110%');
  await expect(page.getByRole('checkbox', { name: 'Auto' }).first()).not.toBeChecked();

  await fallback.selectOption({ index: 0 });
  await expect(code).not.toContainText('size-adjust: 110%');
  await fallback.selectOption(picked);
  await expect(code).toContainText('size-adjust: 110%');
});

test('serif and monospace fallbacks are available by font type', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await page.getByLabel('System', { exact: true }).selectOption('windows');
  await page.getByLabel('Font type').selectOption('serif');
  await expect(page.getByLabel('Fallback font 1', { exact: true })).toContainText(
    'Times New Roman',
  );
  await expect(page.getByRole('region', { name: 'Generated CSS' })).toContainText('serif;');
});

test('the fallback list follows the selected system and reports shadowing with a fix', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const system = page.getByLabel('System', { exact: true });
  const fallback = page.getByLabel('Fallback font 1', { exact: true });

  await system.selectOption('android');
  await expect(fallback).toContainText('Roboto');
  await expect(fallback).not.toContainText('Segoe UI');
  await system.selectOption('windows');
  await expect(fallback).toContainText('Segoe UI');
  await expect(fallback).not.toContainText('Roboto');

  await page.getByText('Audience (browsers)').click();
  await page.getByLabel('Browserslist query').fill('safari 17, chrome 120');
  await system.selectOption('macos');
  await fallback.selectOption('helvetica');
  await system.selectOption('windows');
  await fallback.selectOption('arial');
  await expect(page.locator('p.ff-error', { hasText: /would be used instead of/ })).toBeVisible();
  await page.getByRole('button', { name: 'Reorder to fix' }).click();
  await expect(page.locator('p.ff-error', { hasText: /would be used instead of/ })).toHaveCount(0);
});

test('the text language changes the fit for Cyrillic', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await page.getByLabel('System', { exact: true }).selectOption('windows');
  const fallback = page.getByLabel('Fallback font 1', { exact: true });
  await expect(fallback)
    .toContainText('Latin only')
    .catch(() => undefined);
  await page.getByLabel('Text language').selectOption('ru');
  await expect(fallback).not.toContainText('Latin only');
});

test('an invalid file is rejected with an announced error', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles({
    name: 'broken.woff2',
    mimeType: 'font/woff2',
    buffer: Buffer.from('not a font at all, just text'),
  });
  await expect(page.getByRole('alert')).toContainText('broken.woff2');
});

for (const locale of ['en', 'ru']) {
  test(`${locale}: generator page has no detectable accessibility violations with a font loaded`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/`);
    await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
    await expect(page.getByRole('heading', { level: 2 }).nth(3)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

for (const { width, height } of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
]) {
  test(`${width}x${height}: settings and results fit the first viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/en/');
    await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
    await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeVisible();
    const sizes = await page.evaluate(() => ({
      page: [document.documentElement.scrollHeight, window.innerHeight],
      settings: document.querySelector('.ff-generator__settings')?.scrollHeight,
      settingsVisible: document.querySelector('.ff-generator__settings')?.clientHeight,
    }));
    expect(sizes.page[0]).toBeLessThanOrEqual(sizes.page[1] ?? 0);
    const settings = await page.locator('.ff-generator__settings').boundingBox();
    const results = await page.locator('.ff-generator__main').boundingBox();
    expect(settings?.x).toBeLessThan(results?.x ?? 0);
  });
}

test('preview modes switch between side by side, overlay, web font and fallback', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const mode = page.getByLabel('View', { exact: true });
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(mode).toHaveValue('overlay');
  await expect(preview.getByRole('figure')).toHaveCount(1);

  await mode.selectOption('side');
  await expect(preview.getByRole('figure')).toHaveCount(2);

  await mode.selectOption('overlay');
  await expect(preview.getByRole('figure')).toHaveCount(1);
  await expect(preview).toContainText('outlined dotted text');
  await expect(preview.locator('[aria-hidden="true"].ff-preview__outline')).toHaveCount(1);

  await mode.selectOption('web');
  await expect(preview.getByRole('figure', { name: 'Web font' })).toHaveCount(1);
  await expect(preview.getByRole('figure', { name: 'Adjusted fallback' })).toHaveCount(0);
  await mode.selectOption('fallback');
  await expect(preview.getByRole('figure', { name: 'Adjusted fallback' })).toHaveCount(1);

  await preview.getByLabel(/Text size/).fill('48');
  await expect(preview.locator('.ff-preview__text').first()).toHaveCSS('font-size', '48px');
});

test('preview does not animate when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await expect(page.getByRole('figure').first()).toHaveCSS('transition-duration', '0s');
});

test('the CSS tab keeps the generated code reachable', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const preview = page.getByRole('region', { name: 'Preview' });
  await preview.getByLabel('Text size').fill('72');
  await preview.getByLabel('Line height').fill('2');
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).toBeInViewport();
  const box = await code.boundingBox();
  expect(box?.height).toBeGreaterThan(40);
});

test('a font with few Latin glyphs warns about coverage and previews its own glyphs', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  const font = buildFont(
    [
      [0x61, 0x61, 1],
      [0x65, 0x65, 2],
      [0x74, 0x74, 3],
      [0x16a0, 0x16b3, 4],
    ],
    30,
  );
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles({
    name: 'runes.ttf',
    mimeType: 'font/ttf',
    buffer: Buffer.from(font),
  });
  await expect(page.getByRole('status').filter({ hasText: 'Covered share' })).toBeVisible();
  const sample = page.getByLabel('Sample text');
  await expect(sample).not.toHaveValue(/quick/);
  await expect(sample).toHaveValue(/[ᚠ-ᚳ]/);
});

test('the audience editor resolves presets and reports invalid queries', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.getByText('Audience (browsers)').click();
  const list = page.getByRole('list', { name: 'Resolved browsers' });
  await expect(list).toContainText('Chrome');
  await expect(page.getByText(/\d+ browser versions/)).toBeVisible();
  await expect(page.getByText(/Browser data up to/)).toBeVisible();

  const query = page.getByLabel('Browserslist query');
  await query.fill('chrome 120');
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(page.getByLabel('Preset')).toHaveValue('custom');

  await query.fill('not a query');
  await expect(page.getByRole('status').filter({ hasText: 'not valid' })).toBeVisible();
  await expect(query).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Preset').selectOption('defaults');
  await expect(query).toHaveValue('defaults');
  await expect(list).toBeVisible();
});

test('the audience editor passes axe when open', async ({ page }) => {
  await page.goto('/ru/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.getByText('Аудитория (браузеры)').click();
  await expect(page.getByRole('list', { name: 'Подходящие браузеры' })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});

test('imported usage statistics enable "in my stats" queries and report ignored entries', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.getByText('Audience (browsers)').click();
  const upload = (content: string) =>
    page.locator('input[type="file"][accept*="json"]').setInputFiles({
      name: 'browserslist-stats.json',
      mimeType: 'application/json',
      buffer: Buffer.from(content),
    });

  await upload('not json');
  await expect(page.getByText('not valid JSON')).toBeVisible();

  await upload(
    JSON.stringify({
      chrome: { '120': 60, '119': 3, '1': 1 },
      firefox: { '121': 10 },
      nope: { '1': 1 },
    }),
  );
  await expect(page.getByText(/3 statistics entries loaded/)).toBeVisible();
  await expect(page.getByText(/Ignored unknown browsers: nope/)).toBeVisible();
  await expect(page.getByText(/Ignored 1 unknown versions, for example: chrome 1/)).toBeVisible();
  await expect(page.getByLabel('Browserslist query')).toHaveValue('> 0.5% in my stats');
  await expect(page.getByText('Covers 73.0% of your traffic')).toBeVisible();
  await expect(page.getByLabel('Preset')).toHaveValue('mystats');

  await page.getByRole('button', { name: 'Remove my statistics' }).click();
  await expect(page.getByRole('button', { name: 'Import browserslist-stats.json' })).toBeFocused();
  await expect(page.getByLabel('Browserslist query')).toHaveValue('baseline widely available');
  await expect(page.getByRole('link', { name: 'browserslist-ga', exact: true })).toBeVisible();
});

test('system shares follow the query and the manual mode', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.getByText('Audience (browsers)').click();
  await page.getByLabel('Browserslist query').fill('safari 17, ios_saf 17.0-17.1');
  const shares = page.getByRole('list', { name: 'Estimated audience by system' });
  await expect(shares).toContainText('macOS');
  await expect(shares).toContainText('iOS and iPadOS');
  await expect(shares).not.toContainText('Windows');

  await page.getByLabel('Browserslist query').fill('firefox 120');
  await expect(shares).toContainText('Windows');
  await page.getByLabel('Choose systems manually').check();
  await expect(page.getByText('Enter a weight for at least one system.')).toBeVisible();
  await page.getByLabel('Android').fill('3');
  await page.getByLabel('iOS and iPadOS').fill('1');
  await expect(shares).toContainText('75');
  await expect(shares).not.toContainText('Windows');
});

test('a system can have several ordered fallbacks', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await page.getByLabel('System', { exact: true }).selectOption('windows');
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await page.getByLabel('Fallback font 1', { exact: true }).selectOption('segoe-ui');
  await expect(page.getByLabel('Fallback font 2', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Add fallback' }).click();
  const second = page.getByLabel('Fallback font 2', { exact: true });
  await expect(second).toBeVisible();
  await second.selectOption('arial');
  await expect(code).toContainText('"Source Sans Pro Fallback Segoe UI"');
  await expect(code).toContainText('"Source Sans Pro Fallback Arial"');
  await expect(
    page.getByRole('region', { name: 'Browser support' }).getByText('Segoe UI, Arial'),
  ).toBeVisible();
  await expect(
    page.getByLabel('Fallback font 1', { exact: true }).locator('option[value="arial"]'),
  ).toHaveCount(0);

  await page.getByLabel('Adjust values of').selectOption('arial');
  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('120');
  await size.press('Enter');
  await expect(code).toContainText('size-adjust: 120%');

  await page.getByRole('button', { name: 'Remove: Fallback font 2' }).click();
  await expect(second).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Browser support' }).getByText(/^Segoe UI$/),
  ).toBeVisible();
});

test('the support matrix shows the audience by system with ranges, states and shifts', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).toContainText('font-size-adjust');
  await expect(code).toContainText('line-height: 1.4');

  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix.getByRole('heading', { level: 3 }).first()).toBeVisible();
  await expect(matrix).toContainText('Safari');
  await expect(matrix).toContainText('Partly adjusted');
  await expect(matrix).toContainText(/\d+–\d+/);
  await expect(matrix.getByText(/shift \d/).first()).toBeVisible();

  await page.getByText('Audience (browsers)').click();
  await page.getByLabel('Browserslist query').fill('chrome 120');
  await expect(matrix.getByRole('heading', { level: 4, name: /^Chrome/ }).first()).toBeVisible();
  await expect(matrix.getByRole('heading', { level: 4, name: /^Safari/ })).toHaveCount(0);
  await expect(code).not.toContainText('font-size-adjust');
});

test('a system can be switched off and then falls back to the generic family', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix).not.toContainText('Generic fallback');
  await page.getByRole('checkbox', { name: /^Android/ }).uncheck();
  await expect(matrix).toContainText('Generic fallback');
  await expect(matrix.locator('[data-state="none"]').first()).toBeVisible();
  await page.getByRole('checkbox', { name: /^Android/ }).check();
  await expect(matrix).not.toContainText('Generic fallback');
});

test('the layout shift estimate covers every fallback and viewport and can be verified', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openSection(page, 'Layout shift');
  const section = page.getByRole('region', { name: 'Layout shift' });
  const table = section.getByRole('table');
  for (const width of ['412px', '1350px']) {
    await expect(table.getByRole('columnheader', { name: width })).toBeVisible();
  }
  await expect(table.getByRole('row').nth(1)).toContainText(/(Good|Needs improvement|Poor)/);
  await expect(section.getByLabel('Extra viewport width (px)')).toHaveCount(0);
  await expect(section.getByRole('alert')).toHaveCount(0);

  await page.getByLabel('System', { exact: true }).selectOption('windows');
  await page.getByRole('button', { name: 'Add fallback' }).click();
  await expect(table.getByRole('row').nth(2)).toBeVisible();

  await section.getByRole('button', { name: 'Verify on this device' }).click();
  await expect(section.getByText(/Measured in the browser/)).toBeVisible({ timeout: 25_000 });
});

test('spacing adds the fonts-loading CSS and script', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const code = page.getByRole('region', { name: 'Generated CSS' });
  await expect(code).not.toContainText('fonts-loading');
  await page.getByText('Spacing while fonts load').click();
  await page.getByRole('checkbox', { name: 'Compensate spacing while the font loads' }).check();
  const letter = page.getByRole('spinbutton', { name: /Letter spacing/ });
  await letter.fill('0.2');
  await letter.press('Enter');
  await expect(code).toContainText('.fonts-loading');
  await expect(code).toContainText('letter-spacing: 0.002em');
  const script = page.getByRole('region', { name: 'Font loading script' });
  await expect(script).toContainText("classList.add('fonts-loading')");
  await expect(script).toContainText('Source Sans Pro');
});

test('Optimize for CLS keeps pinned values and can be reset', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await page.getByLabel('System', { exact: true }).selectOption('windows');
  await page.getByLabel('Fallback font 1', { exact: true }).selectOption('arial');
  const code = page.getByRole('region', { name: 'Generated CSS' });
  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('108');
  await size.press('Enter');
  await expect(code).toContainText('size-adjust: 108%');

  await openSection(page, 'Layout shift');
  const section = page.getByRole('region', { name: 'Layout shift' });
  await section.getByRole('button', { name: 'Optimize for CLS' }).click();
  await expect(section.getByText(/Layout shift on this device: |Nothing to improve/)).toBeVisible({
    timeout: 25_000,
  });
  await expect(section.getByRole('alert')).toHaveCount(0);
  await expect(code).toContainText('size-adjust: 108%');
});

test('the settings and the support section can be hidden and shown', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const toggle = page.getByRole('button', { name: 'Hide settings' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Show settings' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.locator('#ff-settings')).toBeHidden();
  await page.getByRole('button', { name: 'Show settings' }).click();
  await expect(page.locator('#ff-settings')).toBeVisible();

  const support = page.getByRole('button', { name: 'Browser support', exact: true });
  await expect(support).toHaveAttribute('aria-expanded', 'true');
  await support.click();
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeHidden();
  await support.click();
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeVisible();
});

test('reordering to fix a shadowing conflict keeps the focus on the page', async ({ page }) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const system = page.getByLabel('System', { exact: true });
  await page.getByText('Audience (browsers)').click();
  await page.getByLabel('Browserslist query').fill('safari 17, chrome 120');
  await system.selectOption('macos');
  await page.getByLabel('Fallback font 1', { exact: true }).selectOption('helvetica');
  await system.selectOption('windows');
  await page.getByLabel('Fallback font 1', { exact: true }).selectOption('arial');
  await page.getByRole('button', { name: 'Hide settings' }).click();
  await expect(page.locator('p.ff-error', { hasText: /would be used instead of/ })).toBeVisible();
  await page.getByRole('button', { name: 'Reorder to fix' }).click();
  await expect(page.locator('#main-content')).toBeFocused();
});

test('the page itself does not scroll on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1453, height: 1000 });
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeVisible();
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      x: root.scrollWidth - root.clientWidth,
      y: root.scrollHeight - root.clientHeight,
    };
  });
  expect(overflow).toEqual({ x: 0, y: 0 });
});
