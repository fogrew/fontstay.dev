import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import type { BrowserContext, Page } from '@playwright/test';
import { buildCollection, buildFont } from '../../src/modules/font-metrics/lib/forged.test-util';
import {
  choose,
  closePanels,
  expect,
  fillQuery,
  listed,
  openExport,
  openPopover,
  openStep,
  openSupport,
  queryField,
  selectSystem,
  test,
  waitForGenerator,
} from './fixtures';

const fonts = new URL('../fixtures/fonts/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const sourceSans = `${fonts}SourceSansPro-Regular.woff2`;

test('uploading a font produces per-system fallbacks, editable values and CSS', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);

  const fallback = page.getByLabel('Fallback font 1', { exact: true });
  await expect(fallback).toBeVisible();
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  await expect(code).toContainText('@font-face');
  await expect(code).toContainText('size-adjust');
  await expect(code).toContainText('"Source Sans Pro Fallback');
  await expect(code).not.toContainText('font-family: font-family');

  await selectSystem(page, 'windows');
  const before = await code.textContent();
  await choose(fallback, { index: 2 });
  await expect(code).not.toHaveText(before ?? '');
  const picked = (await fallback.getAttribute('data-value')) ?? '';

  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('110');
  await size.press('Enter');
  await expect(code).toContainText('size-adjust: 110%');
  await expect(page.getByRole('checkbox', { name: 'Auto' }).first()).not.toBeChecked();

  await choose(fallback, { index: 0 });
  await expect(code).not.toContainText('size-adjust: 110%');
  await choose(fallback, picked);
  await expect(code).toContainText('size-adjust: 110%');
});

test('serif and monospace fallbacks are available by font type', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'windows');
  await choose(page.getByLabel('Font type'), 'serif');
  expect(await listed(page.getByLabel('Fallback font 1', { exact: true }))).toContain(
    'Times New Roman',
  );
  await expect(
    page.getByRole('region', { name: 'Generated CSS', includeHidden: true }),
  ).toContainText('serif;');
});

test('the fallback list follows the selected system and reports shadowing with a fix', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const fallback = page.getByLabel('Fallback font 1', { exact: true });

  await selectSystem(page, 'android');
  expect(await listed(fallback)).toContain('Roboto');
  expect(await listed(fallback)).not.toContain('Segoe UI');
  await selectSystem(page, 'windows');
  expect(await listed(fallback)).toContain('Segoe UI');
  expect(await listed(fallback)).not.toContain('Roboto');

  await openStep(page, 'audience');
  await fillQuery(page, 'safari 17, chrome 120');
  await selectSystem(page, 'macos');
  await choose(fallback, 'helvetica');
  await selectSystem(page, 'windows');
  await choose(fallback, 'arial');
  await openStep(page, 'results');
  await expect(page.getByText('The fallback order was changed automatically')).toBeVisible();
  await expect(page.locator('p.ff-error', { hasText: /would be used instead of/ })).toHaveCount(0);
});

test('the fit follows the page language for a font with Cyrillic', async ({ page }) => {
  await page.goto('/ru/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'macos');
  const fallback = page.getByLabel('Запасной шрифт 1', { exact: true });
  await expect(fallback).toBeVisible();
  await expect(fallback).not.toContainText('Только латиница');
});

test('an invalid file is rejected with an announced error', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles({
    name: 'broken.woff2',
    mimeType: 'font/woff2',
    buffer: Buffer.from('not a font at all, just text'),
  });
  await openStep(page, 'inputs');
  await expect(page.getByRole('alert')).toContainText('broken.woff2');
});

for (const locale of ['en', 'ru']) {
  test(`${locale}: generator page has no detectable accessibility violations with a font loaded`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/`);
    await waitForGenerator(page);
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
  test(`${width}x${height}: the panels are docked at the top and the article spans the width`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/en/');
    await waitForGenerator(page);
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
    const article = page.locator('.ff-article:not([data-probe])').first();
    await expect(article).toBeVisible();
    await expect
      .poll(async () => (await page.locator('.ff-dock').boundingBox())?.y ?? 999)
      .toBeLessThan(150);
    await expect
      .poll(async () => (await article.boundingBox())?.width ?? 0)
      .toBeGreaterThan(width * 0.85);
    for (const name of ['1. Inputs', '2. Audience', '3. Fine-tuning', '4. Results']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
    }
  });
}

test('the article switches between overlay, side by side, web font and fallback views', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  const mode = (name: string) => view.getByRole('button', { name, exact: true });
  await expect(mode('Overlay')).toHaveAttribute('aria-pressed', 'true');
  await expect(view.locator('.ff-article-view__overlay > .ff-article')).toHaveCount(2);
  await expect(view.locator('.ff-article--ghost')).toHaveAttribute('aria-hidden', 'true');

  await mode('Side by side').click();
  await expect(mode('Side by side')).toHaveAttribute('aria-pressed', 'true');
  await expect(view.locator('.ff-article-view__side > figure')).toHaveCount(2);

  await mode('Web font').click();
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCount(1);
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCSS(
    'font-family',
    /ff-web-source-sans-pro/,
  );
  await mode('Adjusted fallback').click();
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCSS('font-family', /Fallback/);
  await mode('Plain fallback').click();
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCSS(
    'font-family',
    /sans-serif/,
  );

  await openPopover(view, 'Content');
  await view.getByLabel(/Text size/).fill('24');
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCSS('font-size', '24px');
  await view.getByLabel(/Line height/).fill('2');
  await expect(view.locator('.ff-article:not([data-probe])')).toHaveCSS('line-height', '48px');
});

test('the inspect tools draw, fade and compare the web font and the fallback', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  const inspect = view.getByRole('button', { name: /^Inspect/ });
  const openInspect = async () => {
    if ((await inspect.getAttribute('aria-expanded')) !== 'true') await inspect.click();
  };
  const layer = (name: string) => view.getByRole('group', { name, exact: true });
  const ghost = view.locator('.ff-article--ghost');
  await expect(ghost).toHaveAttribute('data-render', 'outline');

  await openInspect();
  await choose(layer('Adjusted fallback').getByLabel('Drawing'), 'fill');
  await expect(ghost).toHaveAttribute('data-render', 'fill');
  await choose(layer('Adjusted fallback').getByLabel('Drawing'), 'outline');
  await layer('Adjusted fallback').getByLabel('Opacity').fill('40');
  await expect(ghost).toHaveCSS('opacity', '0.4');
  await layer('Adjusted fallback').getByLabel('Width').fill('3');
  await expect(ghost).toHaveCSS('--ff-layer-stroke', '3px');
  await choose(layer('Adjusted fallback').getByLabel('Colour'), 'red');
  await expect(ghost).toHaveCSS('-webkit-text-stroke-color', /^rgb/);

  await page.keyboard.press('Escape');
  await expect(inspect).toHaveAttribute('aria-expanded', 'false');
  await view.getByRole('button', { name: 'Glyph boxes' }).click();
  await expect(view.getByRole('button', { name: 'Glyph boxes' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(view.locator('.ff-article:not([data-probe]) canvas.ff-article__boxes')).toHaveCount(
    2,
  );

  await view.getByRole('button', { name: 'Side by side', exact: true }).click();
  const side = view.locator('.ff-article-view__side');
  const rows = () =>
    side.evaluate(
      (node) => new Set([...node.children].map((child) => child.getBoundingClientRect().top)).size,
    );
  await expect.poll(rows).toBe(1);
  await view.getByRole('button', { name: 'Top and bottom', exact: true }).click();
  await expect.poll(rows).toBe(2);
  const body = view.locator('.ff-article:not([data-probe])').first();
  const guides = () => body.evaluate((node) => node.style.getPropertyValue('--ff-guides'));
  await expect.poll(guides).toBe('');
  await view.getByRole('button', { name: 'Baseline', exact: true }).click();
  await expect.poll(guides).toContain('--ff-guide-baseline');
  expect(await guides()).not.toContain('--ff-guide-cap');
  await view.getByRole('button', { name: 'Cap height', exact: true }).click();
  await expect.poll(guides).toContain('--ff-guide-cap');
});

test('WebMCP tools drive the generator when the browser offers modelContext', async ({ page }) => {
  await page.addInitScript(() => {
    const tools: Record<
      string,
      { execute: (input: object) => Promise<{ content: { text: string }[] }> }
    > = {};
    (window as unknown as { __tools: typeof tools }).__tools = tools;
    (document as unknown as { modelContext: unknown }).modelContext = {
      registerTool: (tool: { name: string; execute: never }) => {
        tools[tool.name] = tool;
      },
    };
  });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const call = (name: string, input: object = {}) =>
    page.evaluate(
      async ([toolName, toolInput]) => {
        const tools = (
          window as unknown as {
            __tools: Record<
              string,
              { execute: (i: object) => Promise<{ content: { text: string }[] }> }
            >;
          }
        ).__tools;
        return (
          (await tools[toolName as string]?.execute(toolInput as object))?.content[0]?.text ?? ''
        );
      },
      [name, input] as const,
    );
  await expect.poll(() => call('list-fonts')).toContain('Source Sans Pro');
  const fontsList = JSON.parse(await call('list-fonts'));
  expect(fontsList[0].scripts).toContain('latin');
  await expect.poll(() => call('get-css')).toContain('@font-face');
  expect(await call('get-export', { format: 'tailwind' })).toContain('@theme');
  expect(await call('explain-setting', { topic: 'layout-shift' })).toContain('CLS');
  expect(
    await call('set-fallbacks', {
      fontId: fontsList[0].id,
      system: 'windows',
      fonts: 'arial,segoe-ui',
    }),
  ).toContain('were set');
  await expect.poll(() => call('get-css')).toContain('Source Sans Pro Fallback Segoe UI');
  expect(
    await call('set-fallbacks', {
      fontId: fontsList[0].id,
      system: 'windows',
      fonts: 'not-a-font',
    }),
  ).toContain('Unknown');
  await call('set-audience', { query: 'chrome 120' });
  await openStep(page, 'audience');
  await expect(queryField(page)).toHaveAttribute('data-query', 'chrome 120');
});

test('a step panel that scrolls shows an edge shadow only on the side with more content', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openStep(page, 'tuning');
  const shadow = page.locator('.ff-dock__panel:not([hidden]) .ff-shadow');
  await expect(shadow).toHaveAttribute('data-bottom', 'true');
  await expect(shadow).toHaveAttribute('data-top', 'false');
  await shadow.locator('.ff-shadow__scroll').evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  await expect(shadow).toHaveAttribute('data-top', 'true');
  await expect(shadow).toHaveAttribute('data-bottom', 'false');
  await expect(shadow.locator('.ff-shadow__edge[data-edge="top"]')).toHaveCSS(
    'pointer-events',
    'none',
  );
});

test('the loupe shows the comparison only under the lens', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  await view.getByRole('button', { name: 'X-ray', exact: true }).click();
  const loupe = view.getByRole('application', { name: /^X-ray:/ });
  await expect(loupe).toBeVisible();
  await loupe.evaluate((node) => node.scrollIntoView({ block: 'start' }));
  const radius = () =>
    loupe.evaluate((node) => Number.parseFloat(node.style.getPropertyValue('--ff-lens-r') || '0'));
  expect(await radius()).toBe(0);
  const box = await loupe.boundingBox();
  if (!box) throw new Error('no loupe');
  await page.mouse.move(box.x + 200, box.y + 150);
  await expect.poll(radius).toBe(100);
  await expect(loupe.locator('.ff-article-view__lens')).toHaveCSS('pointer-events', 'none');
  await page.mouse.move(1, 1);
  await expect.poll(radius).toBe(0);
  await loupe.focus();
  await expect.poll(radius).toBe(100);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');
  await expect.poll(radius).toBe(0);

  await page.mouse.move(box.x + 200, box.y + 150);
  await expect.poll(radius).toBe(100);
  await page.keyboard.down('Shift');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Shift');
  await expect.poll(radius).toBe(110);
  await page.mouse.move(1, 1);
  await expect(loupe.locator('.ff-article-view__ring')).toBeHidden();
});

test('the x-ray lens follows the pointer in every layout and covers the divider', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  await view.getByRole('button', { name: 'X-ray', exact: true }).click();
  await expect(view.getByRole('button', { name: 'X-ray', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const loupe = view.getByRole('application', { name: /^X-ray:/ });
  const radius = () =>
    loupe.evaluate((node) => Number.parseFloat(node.style.getPropertyValue('--ff-lens-r') || '0'));
  for (const layout of ['Overlay', 'Side by side', 'Slider', 'Web font', 'Plain fallback']) {
    await view.getByRole('button', { name: layout, exact: true }).click();
    await loupe.evaluate((node) => node.scrollIntoView({ block: 'start' }));
    const box = await loupe.boundingBox();
    if (!box) throw new Error(`no stage in ${layout}`);
    await page.mouse.move(1, 1);
    await expect.poll(radius, layout).toBe(0);
    const x = layout === 'Side by side' ? box.x + box.width * 0.75 : box.x + box.width / 2;
    await page.mouse.move(x, box.y + 200);
    await expect.poll(radius, layout).toBe(100);
    const pane = await loupe.locator('.ff-article-view__lens-pane').boundingBox();
    expect(pane?.width, layout).toBeGreaterThan(300);
    if (layout === 'Side by side') {
      const under = await loupe.locator('[data-pane] > .ff-article').nth(1).boundingBox();
      expect(Math.abs((pane?.y ?? 0) - (under?.y ?? 99))).toBeLessThan(1);
    }
  }
});

test('the dock mirrors step and disclosure glyphs in RTL at both breakpoints', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  const buttons = page.locator('.ff-dock__heading button');
  const first = buttons.first();
  const last = buttons.last();
  for (const width of [1500, 800]) {
    await page.setViewportSize({ width, height: 900 });
    for (const button of [first, last]) {
      if ((await button.getAttribute('aria-expanded')) === 'true') await button.click();
      for (const open of [false, true]) {
        if (open) await button.click();
        const glyph = await button.evaluate((node) => getComputedStyle(node, '::before').content);
        if (width >= 1024) {
          if (button === first) expect(glyph).toContain('‹');
          else expect(glyph).toBe('none');
        } else {
          expect(glyph).toContain(open ? '▾' : '◂');
        }
      }
      await button.click();
    }
  }
});

test('the slider and the x-ray lens are mirrored in a right-to-left page', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  await page.evaluate(() => {
    document.documentElement.dir = 'rtl';
  });
  const view = page.getByRole('region', { name: 'Article' });
  await view.getByRole('button', { name: 'Slider', exact: true }).click();
  const divider = view.getByRole('slider', { name: /^Divider/ });
  const stage = view.locator('.ff-article-view__slider');
  await divider.evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await divider.focus();
  await page.keyboard.press('Home');
  const edge = await divider.boundingBox();
  const bounds = await stage.boundingBox();
  expect((edge?.x ?? 0) + (edge?.width ?? 0) / 2).toBeGreaterThan(
    (bounds?.x ?? 0) + (bounds?.width ?? 0) - 20,
  );
  await page.keyboard.press('ArrowLeft');
  await expect(divider).toHaveAttribute('aria-valuenow', '2');

  await view.getByRole('button', { name: 'X-ray', exact: true }).click();
  await view.getByRole('button', { name: 'Side by side', exact: true }).click();
  const loupe = view.getByRole('application', { name: /^X-ray:/ });
  const box = await loupe.boundingBox();
  if (!box) throw new Error('no stage');
  await page.mouse.move(box.x + box.width * 0.25, box.y + 200);
  const pane = await loupe.locator('.ff-article-view__lens-pane').boundingBox();
  const under = await loupe.locator('[data-pane] > .ff-article').nth(1).boundingBox();
  expect(Math.abs((pane?.x ?? 0) - (under?.x ?? 99999))).toBeLessThan(1);
});

test('the preview width is resized by drag and keys to simulate narrower screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  const handle = view.getByRole('slider', { name: /^Preview width/ });
  const frame = view.locator('.ff-article-view__frame');
  await frame.evaluate((node) =>
    window.scrollTo(0, node.getBoundingClientRect().top + window.scrollY + 200),
  );
  const full = (await frame.boundingBox())?.width ?? 0;
  expect(full).toBeGreaterThan(1000);
  await expect(frame).not.toHaveAttribute('data-constrained', '');

  const box = await handle.boundingBox();
  if (!box) throw new Error('no handle');
  await page.mouse.move(box.x + box.width / 2, 450);
  await page.mouse.down();
  await page.mouse.move(box.x - 600, 450);
  await page.mouse.up();
  await expect(frame).toHaveAttribute('data-constrained', '');
  const narrowed = (await frame.boundingBox())?.width ?? 0;
  expect(narrowed).toBeGreaterThan(320);
  expect(narrowed).toBeLessThan(full - 400);

  await handle.focus();
  await page.keyboard.press('Home');
  await expect(handle).toHaveAttribute('aria-valuenow', '320');
  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '336');
  await page.keyboard.press('End');
  await expect(frame).not.toHaveAttribute('data-constrained', '');
});

test('the slider moves the divider by drag and keys, vertically or horizontally', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  await view.getByRole('button', { name: 'Slider', exact: true }).click();
  const divider = view.getByRole('slider', { name: /^Divider/ });
  await divider.evaluate((node) => node.scrollIntoView({ block: 'start' }));
  await expect(divider).toHaveAttribute('aria-valuenow', '50');
  await divider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '52');
  await page.keyboard.press('End');
  await expect(divider).toHaveAttribute('aria-valuenow', '100');

  const box = await divider.boundingBox();
  if (!box) throw new Error('no divider');
  const wrap = await view.locator('.ff-article-view__slider').boundingBox();
  if (!wrap) throw new Error('no slider');
  await page.mouse.move(box.x + box.width / 2, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(wrap.x + wrap.width * 0.25, box.y + 40);
  await page.mouse.up();
  const value = Number(await divider.getAttribute('aria-valuenow'));
  expect(value).toBeGreaterThan(20);
  expect(value).toBeLessThan(30);

  await view.getByRole('button', { name: 'Top and bottom' }).click();
  await expect(divider).toHaveAttribute('aria-orientation', 'vertical');
  await divider.focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await expect(divider).toHaveAttribute('aria-valuenow', '2');
});

test('dropdowns and their options show a hover state', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  await openPopover(view, 'Content');
  const trigger = view.getByLabel('Text wrapping');
  const background = (locator: typeof trigger) =>
    locator.evaluate((node) => getComputedStyle(node).backgroundColor);
  await expect(view.locator('.ff-article:not([data-probe])').first()).toBeVisible();
  await page.mouse.move(1, 1);
  const idle = await background(trigger);
  await expect(async () => {
    await trigger.hover();
    expect(await background(trigger)).not.toBe(idle);
  }).toPass();
  await expect(async () => {
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
    const option = page.getByRole('option').nth(2);
    const box = await option.boundingBox();
    if (!box) throw new Error('the list is not open');
    await page.mouse.move(1, 1);
    const optionIdle = await background(option);
    await page.mouse.move(box.x + 10, box.y + box.height / 2);
    expect(await background(option)).not.toBe(optionIdle);
  }).toPass();
});

test('the text wrapping and sample text controls change the article', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  const article = view.locator('.ff-article:not([data-probe])').first();
  await openPopover(view, 'Content');
  await choose(view.getByLabel('Text wrapping'), 'balance');
  await expect(article).toHaveCSS('text-wrap-mode', 'wrap');
  await expect(article).toHaveCSS('text-wrap-style', 'balance');
  await choose(view.getByLabel('Sample text'), 'ar');
  await expect(article).toHaveAttribute('dir', 'rtl');
  await expect(article).toHaveAttribute('lang', 'ar');
  await choose(view.getByLabel('Sample text'), 'ja');
  await expect(article).toHaveAttribute('lang', 'ja');
  await expect(view.getByRole('heading', { name: /フォントの読み込み/ })).toBeVisible();
});

test('the article can be shown in many scripts and loads each text on demand', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  const article = view.locator('.ff-article:not([data-probe])').first();
  await openPopover(view, 'Content');
  for (const [id, direction] of [
    ['he', 'rtl'],
    ['th', 'ltr'],
    ['zh-Hans', 'ltr'],
    ['ko', 'ltr'],
    ['hi', 'ltr'],
  ] as const) {
    await choose(view.getByLabel('Sample text'), id);
    await expect(article).toHaveAttribute('lang', id);
    await expect(article).toHaveAttribute('dir', direction);
    await expect(article.locator('.ff-article__title')).not.toBeEmpty();
  }
});

test('the CSS stays reachable while the article is large', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openStep(page, 'results');
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  await expect(code).toBeInViewport();
  const box = await code.boundingBox();
  expect(box?.height).toBeGreaterThan(40);
});

test('a font with few Latin glyphs warns about coverage and previews its own glyphs', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
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
  await closePanels(page);
  await expect(page.locator('.ff-article__missing').first()).toBeVisible();
});

test('the audience editor resolves presets and reports invalid queries', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'audience');
  const list = page.getByRole('list', { name: 'Resolved browsers' });
  await expect(list).toContainText('Chrome');
  await expect(page.getByRole('heading', { name: /^Browsers \(\d+\)$/ })).toBeVisible();
  await expect(page.getByText(/Browser data up to/)).toBeVisible();

  const query = page.getByLabel('Add a query');
  await fillQuery(page, 'chrome 120');
  await expect(list.getByRole('listitem')).toHaveCount(1);

  await fillQuery(page, 'not a query');
  await expect(page.getByRole('status').filter({ hasText: 'not valid' })).toBeVisible();
  await expect(query).toHaveAttribute('aria-invalid', 'true');

  await page.getByRole('button', { name: 'defaults', exact: true }).click();
  await expect(queryField(page)).toHaveAttribute('data-query', 'not a query, defaults');
  await page.getByRole('button', { name: 'Remove: not a query' }).click();
  await expect(queryField(page)).toHaveAttribute('data-query', 'defaults');
  await expect(list).toBeVisible();
});

test('the audience editor passes axe when open', async ({ page }) => {
  await page.goto('/ru/');
  await waitForGenerator(page);
  await openStep(page, 'audience');
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
  await waitForGenerator(page);
  await openStep(page, 'audience');
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
  await expect(queryField(page)).toHaveAttribute('data-query', '> 0.5% in my stats');
  await expect(page.getByText('Covers 73.0% of your traffic')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove: > 0.5% in my stats' })).toBeVisible();

  await page.getByRole('button', { name: 'Remove my statistics' }).click();
  await expect(page.getByRole('button', { name: 'Import browserslist-stats.json' })).toBeFocused();
  await expect(queryField(page)).toHaveAttribute('data-query', 'baseline widely available');
  await expect(page.getByRole('link', { name: 'browserslist-ga', exact: true })).toBeVisible();
});

test('system shares follow the query and the tag controls edit it', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'audience');
  await fillQuery(page, 'safari 17, ios_saf 17.0-17.1');
  const shares = page.getByRole('list', { name: 'Estimated audience by system' });
  await expect(shares).toContainText('macOS');
  await expect(shares).toContainText('iOS and iPadOS');
  await expect(shares).not.toContainText('Windows');

  await fillQuery(page, 'firefox 120');
  await expect(shares).toContainText('Windows');

  await page.getByRole('button', { name: 'firefox', exact: true }).hover();
  await page.getByRole('button', { name: 'Exclude firefox', exact: true }).click();
  await expect(queryField(page)).toHaveAttribute('data-query', 'firefox 120, not firefox > 0');
  await page.getByRole('button', { name: 'Remove: not firefox > 0' }).click();
  await expect(queryField(page)).toHaveAttribute('data-query', 'firefox 120');
  await page.getByRole('button', { name: '> 1%', exact: true }).click();
  await expect(queryField(page)).toHaveAttribute('data-query', 'firefox 120, > 1%');
});

test('operating system tags drop a system from the audience', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'audience');
  const shares = page.getByRole('list', { name: 'Estimated audience by system' });
  await expect(shares).toContainText('Linux');
  await page.getByRole('button', { name: 'Linux', exact: true }).hover();
  await page.getByRole('button', { name: 'Exclude Linux', exact: true }).click();
  await expect(queryField(page)).toHaveAttribute(
    'data-query',
    'baseline widely available, not os linux',
  );
  await expect(shares).not.toContainText('Linux');
  await expect(page.getByRole('heading', { name: /^Operating systems \(\d+\)$/ })).toBeVisible();
});

test('typing, pasting and dropping a .browserslist file turn into tags', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'audience');
  const query = queryField(page);
  const input = page.getByLabel('Add a query');
  await input.fill('chrome 120');
  await input.press('Enter');
  await expect(query).toHaveAttribute('data-query', 'baseline widely available, chrome 120');

  await input.fill('');
  await input.evaluate((element) => {
    const data = new DataTransfer();
    data.setData('text', '# targets\nsafari 17\nlast 2 firefox versions');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, cancelable: true }));
  });
  await expect(query).toHaveAttribute(
    'data-query',
    'baseline widely available, chrome 120, safari 17, last 2 firefox versions',
  );

  await page.evaluate(async () => {
    const file = new File(['> 1%\nnot dead\n'], '.browserslistrc');
    const data = new DataTransfer();
    data.items.add(file);
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: data, bubbles: true }));
    window.dispatchEvent(
      new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
    );
  });
  await expect(query).toHaveAttribute('data-query', '> 1%, not dead');
  await expect(page.getByText('Loaded 2 queries from .browserslistrc.')).toBeAttached();
});

test('dropping several browserslist files merges their queries', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'audience');
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.items.add(new File(['> 1%\nnot dead\n'], '.browserslistrc'));
    data.items.add(new File(['not dead\nsafari 17\n'], '.browserslist'));
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: data, bubbles: true }));
    window.dispatchEvent(
      new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
    );
  });
  await expect(queryField(page)).toHaveAttribute('data-query', '> 1%, not dead, safari 17');
  await expect(
    page.getByText('Loaded 3 queries from .browserslistrc, .browserslist.'),
  ).toBeAttached();
});

test('the audience file buttons and drops fill the query and the statistics', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'audience');
  const query = queryField(page);

  await page
    .locator('input[type="file"]:not([accept])')
    .last()
    .setInputFiles({
      name: '.browserslistrc',
      mimeType: 'text/plain',
      buffer: Buffer.from('> 2%'),
    });
  await expect(query).toHaveAttribute('data-query', '> 2%');
  await expect(page.getByText('Loaded 1 queries from .browserslistrc.')).toBeVisible();

  await page.evaluate(() => {
    const file = new File([JSON.stringify({ chrome: { '120': 60 } })], 'browserslist-stats.json');
    const data = new DataTransfer();
    data.items.add(file);
    window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: data, bubbles: true }));
    window.dispatchEvent(
      new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
    );
  });
  await expect(query).toHaveAttribute('data-query', '> 0.5% in my stats');
  await expect(page.getByText(/1 statistics entries loaded/)).toBeVisible();

  const filters = page.locator('.ff-audience__filters');
  const results = page.locator('.ff-audience__results');
  const filtersBox = await filters.boundingBox();
  const resultsBox = await results.boundingBox();
  expect(filtersBox?.x).toBeLessThan(resultsBox?.x ?? 0);
});

test('a system can have several ordered fallbacks', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'windows');
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  await choose(page.getByLabel('Fallback font 1', { exact: true }), 'segoe-ui');
  await expect(page.getByLabel('Fallback font 2', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Add fallback' }).click();
  const second = page.getByLabel('Fallback font 2', { exact: true });
  await expect(second).toBeVisible();
  await choose(second, 'arial');
  await expect(code).toContainText('"Source Sans Pro Fallback Segoe UI"');
  await expect(code).toContainText('"Source Sans Pro Fallback Arial"');
  await openSupport(page);
  await expect(
    page.getByRole('region', { name: 'Browser support' }).getByText('Segoe UI, Arial'),
  ).toBeVisible();
  await selectSystem(page, 'windows');
  await expect(
    page.getByLabel('Fallback font 1', { exact: true }).locator('option[value="arial"]'),
  ).toHaveCount(0);

  await choose(page.getByLabel('Adjust values of'), 'arial');
  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('120');
  await size.press('Enter');
  await expect(code).toContainText('size-adjust: 120%');

  await page.getByRole('button', { name: 'Remove: Fallback font 2' }).click();
  await expect(second).toHaveCount(0);
  await openSupport(page);
  await expect(
    page.getByRole('region', { name: 'Browser support' }).getByText(/^Segoe UI$/),
  ).toBeVisible();
});

test('the support matrix shows the audience by system with ranges, states and shifts', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openSupport(page);
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  await expect(code).toContainText('font-size-adjust');
  await expect(code).toContainText('line-height: 1.4');

  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix.getByRole('heading', { level: 3 }).first()).toBeVisible();
  await expect(matrix).toContainText('Safari');
  await expect(matrix).toContainText('Partly adjusted');
  await expect(matrix).toContainText(/\d+–\d+/);
  await expect(matrix.getByText(/CLS \d/).first()).toBeVisible();

  await openStep(page, 'audience');
  await fillQuery(page, 'chrome 120');
  await openSupport(page);
  await expect(matrix.getByRole('heading', { level: 4, name: /^Chrome/ }).first()).toBeVisible();
  await expect(matrix.getByRole('heading', { level: 4, name: /^Safari/ })).toHaveCount(0);
  await expect(code).not.toContainText('font-size-adjust');
});

test('a system can be switched off and then falls back to the generic family', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const matrix = page.getByRole('region', { name: 'Browser support' });
  await openSupport(page);
  await expect(matrix).not.toContainText('Generic fallback');
  await openStep(page, 'tuning');
  await page.getByRole('checkbox', { name: 'Include Android in the stack' }).uncheck();
  await openSupport(page);
  await expect(matrix).toContainText('Generic fallback');
  await expect(matrix.locator('[data-state="none"]').first()).toBeVisible();
  await openStep(page, 'tuning');
  await page.getByRole('checkbox', { name: 'Include Android in the stack' }).check();
  await openSupport(page);
  await expect(matrix).not.toContainText('Generic fallback');
});

test('the support matrix shows the shift with and without the CSS and the result can be verified', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openSupport(page);
  const matrix = page.getByRole('region', { name: 'Browser support' });
  await expect(matrix.locator('[data-rating]').first()).toBeVisible();
  await expect(matrix.getByText(/was \d/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Layout shift', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Verify on this device' }).click();
  await expect(page.getByText(/Measured in the browser/)).toBeVisible({ timeout: 25_000 });
});

test('spacing adds the fonts-loading CSS and script', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  await expect(code).not.toContainText('fonts-loading');
  await page.getByText('Spacing while fonts load').click();
  await page.getByRole('checkbox', { name: 'Compensate spacing while the font loads' }).check();
  const letter = page.getByRole('spinbutton', { name: /Letter spacing/ });
  await letter.fill('0.2');
  await letter.press('Enter');
  await expect(code).toContainText('.fonts-loading');
  await expect(code).toContainText('letter-spacing: 0.002em');
  await openExport(page);
  await choose(page.getByLabel('Format'), { label: 'Font Loading API script' });
  const script = page.getByRole('region', { name: 'font-loading.js' });
  await expect(script).toContainText("classList.add('fonts-loading')");
  await expect(script).toContainText(`'1em "Source Sans Pro"'`);
});

test('values are optimized automatically and pinned values stay', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'windows');
  await choose(page.getByLabel('Fallback font 1', { exact: true }), 'arial');
  await expect(page.getByRole('button', { name: 'Optimize for CLS' })).toHaveCount(0);
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  const size = page.getByRole('spinbutton', { name: /Size adjust/ });
  await size.fill('108');
  await size.press('Enter');
  await expect(code).toContainText('size-adjust: 108%');
  await page.waitForTimeout(1500);
  await expect(code).toContainText('size-adjust: 108%');
  await expect(page.getByRole('checkbox', { name: 'Auto' }).nth(1)).toBeChecked();
});

test('opening and closing a step does not move the page content', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await closePanels(page);
  const article = page.locator('.ff-article:not([data-probe])').first();
  await expect(article).toBeVisible();
  const top = async () => Math.round((await article.boundingBox())?.y ?? -1);
  const closed = await top();
  await openStep(page, 'audience');
  expect(await top()).toBe(closed);
  await closePanels(page);
  expect(await top()).toBe(closed);
});

test('the open step and the support section are collapsible and remembered', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  const inputs = page.getByRole('button', { name: '1. Inputs' });
  await openStep(page, 'inputs');
  await expect(page.locator('#ff-settings')).toBeVisible();
  await inputs.click();
  await expect(inputs).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#ff-settings')).toBeHidden();
  await page.reload();
  await waitForGenerator(page);
  await expect(page.getByRole('button', { name: '1. Inputs' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await openStep(page, 'inputs');
  await expect(page.locator('#ff-settings')).toBeVisible();
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);

  await closePanels(page);
  const support = page.getByRole('button', { name: 'Browser support', exact: true });
  await expect(support).toHaveAttribute('aria-expanded', 'false');
  await support.click();
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeVisible();
  await support.click();
  await expect(page.getByRole('region', { name: 'Browser support' })).toBeHidden();
});

test('the dock stays pinned to the top while the article scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 1453, height: 800 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  await expect(page.locator('.ff-article:not([data-probe])').first()).toBeVisible();
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  const dock = await page.locator('.ff-dock').boundingBox();
  expect(dock?.y).toBeLessThan(2);
  await expect(page.getByRole('button', { name: '4. Results', exact: true })).toBeInViewport();
});

test('a system with a single known font explains why no fallback can be added', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'android');
  await expect(page.getByRole('button', { name: 'Add fallback' })).toBeDisabled();
  await expect(page.getByText(/no other fonts of this type are known yet/)).toBeVisible();
});

test('the unicode-range toggle limits the fallbacks to the covered characters', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  await expect(code).toContainText('size-adjust');
  await page.getByRole('checkbox', { name: 'Fit each script separately' }).uncheck();
  await expect(code).not.toContainText('unicode-range');
  await page.getByRole('checkbox', { name: /Limit the fallbacks to the characters/ }).check();
  await expect(code).toContainText('unicode-range: U+');
  await page.getByRole('checkbox', { name: /Limit the fallbacks to the characters/ }).uncheck();
  await expect(code).not.toContainText('unicode-range');
});

test('the coverage section shows a Unicode map and a per-block table', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  await page.getByRole('button', { name: 'Glyph coverage', exact: true }).click();
  await expect(page.getByText(/code points in \d+ Unicode blocks/)).toBeVisible();
  const table = page.getByRole('table', { name: 'Glyph coverage per Unicode block' });
  await expect(table.getByRole('row', { name: /Basic Latin/ })).toBeVisible();
  const map = page.getByRole('group', { name: 'Unicode map of Basic Latin' });
  const status = page.locator('.ff-map__readout');
  await map.locator('[data-cp="65"]').hover();
  await expect(status).toContainText('U+0041 · A');
  await expect(status).toContainText('covered');
  await map.focus();
  await page.keyboard.press('ArrowRight');
  await expect(status).toContainText('U+0042 · B');
  await page.keyboard.press('ArrowUp');
  await expect(status).toContainText('U+0032');
});

test('the style select switches a system to the bold face and adds the descriptors', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await selectSystem(page, 'windows');
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  await expect(code).not.toContainText('font-weight');
  await choose(page.getByLabel('Font style'), 'bold');
  await expect(code).toContainText('font-weight: 700;');
  await expect(code).toContainText('Bold');
  await choose(page.getByLabel('Font style'), 'italic');
  await expect(code).toContainText('font-style: italic;');
  await expect(code).not.toContainText('font-weight');
});

test('a font collection is split into separate fonts', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  const collection = buildCollection([buildFont([[0x41, 0x5a, 1]]), buildFont([[0x61, 0x7a, 1]])]);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles({
    name: 'pair.ttc',
    mimeType: 'font/collection',
    buffer: Buffer.from(collection),
  });
  await expect(page.getByRole('button', { name: 'Remove: pair.ttc #1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove: pair.ttc #2' })).toBeVisible();
});

test('characters missing from the font are highlighted and explained on focus', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  await openPopover(view, 'Content');
  await choose(view.getByLabel('Sample text'), 'ja');
  const mark = view.locator('.ff-article:not(.ff-article--ghost) .ff-article__missing').first();
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute(
    'aria-description',
    /is not supported by the font and is drawn with the .+ fallback/,
  );
  const overflow = () =>
    page.evaluate(() => ({
      page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      article: Math.max(
        ...[...document.querySelectorAll('.ff-article:not([data-probe])')].map(
          (node) => node.scrollWidth - node.clientWidth,
        ),
      ),
    }));
  const before = await overflow();
  await mark.focus();
  await expect(mark).toBeFocused();
  expect(await overflow()).toEqual(before);
  await openPopover(view, 'Inspect');
  await choose(view.getByLabel('Missing characters'), 'serif');
  await expect(mark).toHaveAttribute('aria-description', /Serif/);
});

test('the article shows the layout shift measured on this device and ellipsizes without wrapping', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  await expect(view.getByRole('status').filter({ hasText: /CLS.*\d\.\d{3}/ })).toBeVisible({
    timeout: 20_000,
  });
  await openPopover(view, 'Content');
  await choose(view.getByLabel('Text wrapping'), 'nowrap');
  await expect(view.locator('.ff-article__lead').first()).toHaveCSS('text-overflow', 'ellipsis');
  await expect(view.locator('.ff-article__lead').first()).toHaveCSS('overflow', 'hidden');
});

test('a font embedded in pasted CSS can be added and other sources are only linked', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  const encoded = readFileSync(sourceSans).toString('base64');
  const css = `@font-face { font-family: "Embedded"; font-weight: 700; src: url(data:font/woff2;base64,${encoded}) format("woff2"); }
@font-face { font-family: "Remote"; src: url(https://example.com/remote.woff2) format("woff2"); }
@font-face { font-family: "Script"; src: url(javascript:alert(1)); }`;
  await page.getByLabel('Font name, CSS or copied site data').fill(css);
  const list = page.getByRole('list', { name: 'Fonts found in the CSS' });
  await expect(list.getByRole('link', { name: 'Download the file' })).toHaveAttribute(
    'href',
    'https://example.com/remote.woff2',
  );
  await expect(list.getByText('Source not supported')).toBeVisible();
  await list.getByRole('button', { name: 'Add to the fonts' }).click();
  await openStep(page, 'tuning');
  await expect(page.getByRole('button', { name: /^Remove: Embedded/ })).toBeVisible();
});

test('CSS files can be chosen and their font declarations are found automatically', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles({
    name: 'fonts.css',
    mimeType: 'text/css',
    buffer: Buffer.from(
      '@font-face { font-family: "Remote"; src: url(https://example.com/remote.woff2) format("woff2"); }',
    ),
  });
  const list = page.getByRole('list', { name: 'Fonts found in the CSS' });
  await expect(list.getByRole('link', { name: 'Download the file' })).toHaveAttribute(
    'href',
    'https://example.com/remote.woff2',
  );
});

test('a Google Fonts family can be searched and downloaded through the two allowed origins', async ({
  page,
}) => {
  const cors = { 'access-control-allow-origin': '*' };
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'text/css' },
      body: '/* latin */\n@font-face { font-family: "Open Sans"; src: url(https://fonts.gstatic.com/s/opensans/latin.woff2) format("woff2"); }',
    }),
  );
  await page.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'font/woff2' },
      body: readFileSync(sourceSans),
    }),
  );
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  await page.getByLabel('Font name, CSS or copied site data').fill('open sans');
  await page
    .getByRole('list', { name: 'Matching families' })
    .getByRole('button', { name: /^Open Sans.*Google Fonts/ })
    .click();
  await expect(page.getByRole('button', { name: 'latin', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Add to the fonts' }).click();
  await expect(page.getByText('Downloaded Open Sans.')).toBeVisible();
  await openStep(page, 'tuning');
  await expect(page.getByRole('button', { name: /^Remove: Open-Sans-400-latin/ })).toBeVisible();
});

test('several styles of a catalog family are added with one click', async ({ page }) => {
  const cors = { 'access-control-allow-origin': '*' };
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'text/css' },
      body: '/* latin */\n@font-face { font-family: "Open Sans"; src: url(https://fonts.gstatic.com/s/opensans/latin.woff2) format("woff2"); }',
    }),
  );
  await page.route('https://fonts.gstatic.com/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { ...cors, 'content-type': 'font/woff2' },
      body: readFileSync(sourceSans),
    }),
  );
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  await page.getByLabel('Font name, CSS or copied site data').fill('open sans');
  await page
    .getByRole('list', { name: 'Matching families' })
    .getByRole('button', { name: /^Open Sans.*Google Fonts/ })
    .click();
  await page.getByRole('button', { name: '700', exact: true }).click();
  await page.getByRole('button', { name: '400 Italic', exact: true }).click();
  await page.getByRole('button', { name: 'Add to the fonts (3)' }).click();
  await expect(page.getByText('Downloaded Open Sans.')).toBeVisible();
  await openStep(page, 'tuning');
  for (const name of ['Open-Sans-400-latin', 'Open-Sans-700-latin', 'Open-Sans-400i-latin']) {
    await expect(page.getByRole('button', { name: new RegExp(`^Remove: ${name}`) })).toBeVisible();
  }
});

test('a share link carries Google Fonts choices and downloads them again', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const cors = { 'access-control-allow-origin': '*' };
  const mockGoogle = async (target: Pick<BrowserContext, 'route'>) => {
    await target.route('https://fonts.googleapis.com/**', (route) =>
      route.fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'text/css' },
        body: '/* latin */\n@font-face { font-family: "Open Sans"; src: url(https://fonts.gstatic.com/s/opensans/latin.woff2) format("woff2"); }',
      }),
    );
    await target.route('https://fonts.gstatic.com/**', (route) =>
      route.fulfill({
        status: 200,
        headers: { ...cors, 'content-type': 'font/woff2' },
        body: readFileSync(sourceSans),
      }),
    );
  };
  await mockGoogle(context);
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  await page.getByLabel('Font name, CSS or copied site data').fill('open sans');
  await page
    .getByRole('list', { name: 'Matching families' })
    .getByRole('button', { name: /^Open Sans.*Google Fonts/ })
    .click();
  await page.getByRole('button', { name: 'Add to the fonts' }).click();
  await expect(page.getByText('Downloaded Open Sans.')).toBeVisible();
  await closePanels(page);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'The link was copied.' })).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  const fresh = await context.browser()?.newContext();
  if (!fresh) throw new Error('no browser');
  await mockGoogle(fresh);
  const other = await fresh.newPage();
  await other.goto(link);
  await waitForGenerator(other);
  await openStep(other, 'inputs');
  await expect(other.getByText(/This link uses 1 fonts/)).toBeVisible();
  await other.getByRole('button', { name: 'Download the fonts' }).click();
  await openStep(other, 'tuning');
  await expect(other.getByRole('button', { name: /^Remove: Open-Sans-400-latin/ })).toBeVisible();
  await fresh.close();
});

test('a Fontsource family is downloaded from jsDelivr', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/fontsource/fonts/**', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'font/woff2' },
      body: readFileSync(sourceSans),
    }),
  );
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  await page.getByLabel('Font name, CSS or copied site data').fill('aileron');
  await page
    .getByRole('list', { name: 'Matching families' })
    .getByRole('button', { name: /^Aileron.*Fontsource/ })
    .click();
  await page.getByRole('button', { name: 'Add to the fonts' }).click();
  await expect(page.getByText('Downloaded Aileron.')).toBeVisible();
  await openStep(page, 'tuning');
  await expect(page.getByRole('button', { name: /^Remove: Aileron-400-latin/ })).toBeVisible();
});

test('a failed Google Fonts download is explained', async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  await page.getByLabel('Font name, CSS or copied site data').fill('lora');
  await page
    .getByRole('list', { name: 'Matching families' })
    .getByRole('button', { name: /^Lora.*Google Fonts/ })
    .click();
  await page.getByRole('button', { name: 'Add to the fonts' }).click();
  await expect(page.getByText(/Could not download the font/)).toBeVisible();
});

test('every export format can be shown, copied and downloaded', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openExport(page);
  const format = page.getByLabel('Format');
  const expected: [string, string, RegExp][] = [
    ['CSS custom properties', 'fallback-fonts.css', /--font-body:/],
    ['Tailwind CSS v4 (@theme)', 'app.css', /@theme \{\s+--font-sans:/],
    ['Next.js (next/font/local)', 'font.ts', /localFont\(/],
    ['Nuxt Fonts', 'nuxt.config.ts', /@nuxt\/fonts/],
    ['Astro fonts config', 'astro.config.mjs', /provider: 'local'/],
    ['Preload tag', 'preload.html', /rel="preload"/],
    ['Font Loading API script', 'font-loading.js', /document\.fonts\.load/],
  ];
  for (const [label, fileName, pattern] of expected) {
    await choose(format, { label });
    await expect(page.getByRole('region', { name: fileName })).toContainText(pattern);
  }
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download: font-loading.js/ }).click();
  expect((await download).suggestedFilename()).toBe('font-loading.js');
});

test('the impact report is built from the same state as the matrix and can be downloaded', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openExport(page);
  await choose(page.getByLabel('Format'), { label: 'Impact report (Markdown)' });
  const report = page.getByRole('region', { name: 'impact-report.md' });
  await expect(report).toContainText('# Impact report: Source Sans Pro');
  await expect(report).toContainText('## Layout shift');
  await expect(report).toContainText('| Android |');
  await expect(report).toContainText('`size-adjust`');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Download: impact-report.md/ }).click();
  expect((await download).suggestedFilename()).toBe('impact-report.md');
});

test('fonts and settings survive a reload and the share link restores the settings', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await expect(page.getByRole('button', { name: /^Remove: SourceSansPro-Regular/ })).toBeVisible();
  const android = page.getByRole('checkbox', { name: 'Include Android in the stack' });
  await android.uncheck();
  await openExport(page);
  await page.waitForTimeout(800);

  await page.reload();
  await waitForGenerator(page);
  await openStep(page, 'tuning');
  await expect(page.getByRole('button', { name: /^Remove: SourceSansPro-Regular/ })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Include Android in the stack' }),
  ).not.toBeChecked();

  await closePanels(page);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(
    page.getByRole('status').filter({
      hasText: /The link was copied, but it does not include these files: SourceSansPro-Regular/,
    }),
  ).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/#s=[A-Za-z0-9_-]+$/);

  const fresh = await context.browser()?.newContext();
  if (!fresh) throw new Error('no browser');
  const other = await fresh.newPage();
  await other.goto(link);
  await waitForGenerator(other);
  await other.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openStep(other, 'tuning');
  await expect(
    other.getByRole('checkbox', { name: 'Include Android in the stack' }),
  ).not.toBeChecked();
  await fresh.close();

  await page.getByRole('button', { name: 'Forget', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: /were removed from this browser/ }),
  ).toBeVisible();
  await page.reload();
  await waitForGenerator(page);
  await expect(page.getByRole('button', { name: /^Remove: .*\.(woff2|ttf)/ })).toHaveCount(0);
});

test('a corrupt share link is ignored', async ({ page }) => {
  await page.goto('/en/#s=!!!not-a-state');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  await expect(page.getByRole('region', { name: 'Fonts to adapt' })).toHaveCount(0);
  await expect(page.getByText('Add a font', { exact: true })).toBeVisible();
});

test('the dropdown works from the keyboard, with typeahead, and has no axe violations while open', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openExport(page);
  const format = page.getByRole('combobox', { name: 'Format' });
  await format.focus();
  await page.keyboard.press('ArrowDown');
  await expect(format).toHaveAttribute('aria-expanded', 'true');
  const results = await new AxeBuilder({ page }).include('[role="listbox"]').analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(format).toHaveAttribute('data-value', 'variables');
  await expect(format).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.type('nuxt');
  await page.keyboard.press('Enter');
  await expect(format).toHaveAttribute('data-value', 'nuxt');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(format).toHaveAttribute('aria-expanded', 'false');
  await expect(format).toHaveAttribute('data-value', 'nuxt');
});

test('the steps are equal columns and only one is open at a time', async ({ page }) => {
  await page.setViewportSize({ width: 1453, height: 1000 });
  await page.goto('/en/');
  await waitForGenerator(page);
  const widths = await page
    .locator('.ff-dock__column')
    .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().width)));
  expect(widths).toHaveLength(4);
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
  await expect(page.locator('.ff-dock__separator')).toHaveCount(0);

  await openStep(page, 'inputs');
  await openStep(page, 'results');
  await expect(page.getByRole('button', { name: '1. Inputs', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  const dock = await page.locator('.ff-dock').boundingBox();
  const panel = await page.locator('.ff-dock__panel:not([hidden])').boundingBox();
  expect(Math.abs((panel?.width ?? 0) - (dock?.width ?? 1))).toBeLessThanOrEqual(1);
  await expect(page.locator('.ff-dock__panel:not([hidden])')).toHaveCount(1);
});

test('several fonts share the article and the export and are tuned one by one', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page
    .locator('input[type="file"][accept*="woff2"]')
    .setInputFiles([sourceSans, `${fonts}FiraSans-Regular.ttf`]);
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  await expect(code).toContainText('Source Sans Pro Fallback');
  await expect(code).toContainText('Fira Sans Fallback');
  await expect(code).toContainText('.source-sans-pro {');
  await expect(page.getByLabel('Fallback font 1', { exact: true })).toHaveCount(0);
  await openExport(page);
  await choose(page.getByLabel('Format'), { label: 'Next.js (next/font/local)' });
  const next = page.getByRole('region', { name: 'font.ts' });
  await expect(next).toContainText('export const sourceSansPro = localFont');
  await expect(next).toContainText('export const firaSans = localFont');
  await expect(next).toContainText('SourceSansPro-Regular.woff2');
  await expect(next).toContainText('FiraSans-Regular.ttf');
  await choose(page.getByLabel('Format'), 'css');

  await openStep(page, 'tuning');
  const fira = page.getByRole('button', { name: /^Fira Sans/ }).first();
  await fira.click();
  await expect(fira).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Fallback font 1', { exact: true })).toBeVisible();
  await expect(code).not.toContainText('Source Sans Pro Fallback');
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  await openPopover(view, 'Inspect');
  await expect(view.getByLabel('Headings font')).toBeVisible();
  await expect(view.getByLabel('Text font')).toBeVisible();
  await expect(view.locator('.ff-article:not([data-probe])').first()).toBeVisible();
});

test('each font keeps its own style across a reload', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page
    .locator('input[type="file"][accept*="woff2"]')
    .setInputFiles([sourceSans, `${fonts}FiraSans-Regular.ttf`]);
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  const open = async (name: RegExp) => {
    const header = page.getByRole('button', { name }).first();
    await header.click();
    await expect(header).toHaveAttribute('aria-expanded', 'true');
  };
  await open(/^Source Sans/);
  await choose(page.getByLabel('Font style').nth(0), 'bold');
  await open(/^Fira Sans/);
  await choose(page.getByLabel('Font style').nth(1), 'italic');
  await page.waitForTimeout(800);

  await page.reload();
  await waitForGenerator(page);
  await open(/^Source Sans/);
  await expect(code).toContainText('font-weight: 700;');
  await open(/^Fira Sans/);
  await expect(code).toContainText('font-style: italic;');
  await expect(code).not.toContainText('font-weight: 700;');
});

test('scripts with different widths get their own fallback faces', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page
    .locator('input[type="file"][accept*="woff2"]')
    .setInputFiles(`${fonts}FiraSans-Regular.ttf`);
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  await expect(code).toContainText('unicode-range: U+400-52F');
  await page.getByRole('checkbox', { name: 'Fit each script separately' }).uncheck();
  await expect(code).not.toContainText('unicode-range: U+400-52F');
});

const DEMO_SITE = `<!doctype html><title>Demo site</title>
<style>
@font-face { font-family: "Demo Sans"; src: url(/font.woff2) format("woff2"); font-weight: 400; }
body { font-family: "Demo Sans", sans-serif; font-size: 17px; line-height: 1.6; }
h1 { font-family: "Demo Sans", sans-serif; font-size: 34px; }
</style>
<main>
<h1>Hello from the demo site</h1>
<p>This paragraph is long enough to be taken as the body text sample of the page and it keeps going so the preview has real copy to wrap. This paragraph is long enough to be taken as the body text sample of the page and it keeps going so the preview has real copy to wrap. </p>
<h2>Second section</h2>
<p>This paragraph is long enough to be taken as the body text sample of the page and it keeps going so the preview has real copy to wrap. This paragraph is long enough to be taken as the body text sample of the page and it keeps going so the preview has real copy to wrap. </p>
<ul><li>First item of the list</li><li>Second item of the list</li></ul>
</main>`;

test('the bookmarklet hands the fonts and text of a page to the generator after a confirmation', async ({
  page,
  context,
}) => {
  await context.route('https://site.test/**', (route) => {
    const font = new URL(route.request().url()).pathname === '/font.woff2';
    return route.fulfill({
      status: 200,
      headers: { 'content-type': font ? 'font/woff2' : 'text/html' },
      body: font ? readFileSync(sourceSans) : DEMO_SITE,
    });
  });
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  await page.getByRole('button', { name: 'Import from a website…' }).click();
  const link = page.getByRole('link', { name: 'Send to fontstay' });
  const href = (await link.getAttribute('href')) ?? '';
  expect(href).toMatch(/^javascript:/);
  expect(href.length).toBeLessThan(16000);

  const site = await context.newPage();
  await site.goto('https://site.test/');
  const popup = site.waitForEvent('popup');
  await site.evaluate(decodeURIComponent(href.slice('javascript:'.length)));
  const generator = await popup;
  await generator.waitForURL(/\/en\/(#.*)?$/);
  const confirm = generator.getByRole('region', { name: 'Import from https://site.test?' });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('1 font files');
  await expect(confirm).toContainText('The browser confirmed where the data came from.');
  await confirm.getByRole('button', { name: 'Import' }).click();
  await openStep(generator, 'tuning');
  await expect(generator.getByRole('button', { name: /^Remove: font\.woff2/ })).toBeVisible();
  await expect(
    generator
      .locator('.ff-article:not([data-probe])')
      .getByText('Hello from the demo site')
      .first(),
  ).toBeVisible();
  expect(generator.url()).not.toContain('#');
});

test('an import page without a valid handshake explains that nothing was received', async ({
  page,
}) => {
  await page.goto('/en/import/');
  await expect(page.getByText(/Nothing was received/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the generator' })).toBeVisible();
});

test('panels animate with view transitions unless reduced motion is requested', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript(() => {
    const original = document.startViewTransition?.bind(document);
    (window as unknown as { transitions: number }).transitions = 0;
    if (original) {
      document.startViewTransition = ((update: () => Promise<void>) => {
        (window as unknown as { transitions: number }).transitions++;
        return original(update);
      }) as typeof document.startViewTransition;
    }
  });
  await page.goto('/en/');
  await waitForGenerator(page);
  const inputs = page.getByRole('button', { name: '3. Fine-tuning' });
  await inputs.click();
  await expect(inputs).toHaveAttribute('aria-expanded', 'false');
  expect(
    await page.evaluate(() => (window as unknown as { transitions: number }).transitions),
  ).toBe(1);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await inputs.click();
  await expect(inputs).toHaveAttribute('aria-expanded', 'true');
  expect(
    await page.evaluate(() => (window as unknown as { transitions: number }).transitions),
  ).toBe(1);
});

test('the export code is syntax highlighted without inline styles', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openExport(page);
  const code = page.getByRole('region', { name: 'Generated CSS', includeHidden: true });
  await expect(code.locator('code span[class^="ff-tok-"]').first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(code.locator('code [style]')).toHaveCount(0);
  await expect(code).toContainText('@font-face');
  await choose(page.getByLabel('Format'), { label: 'Next.js (next/font/local)' });
  const next = page.getByRole('region', { name: 'font.ts' });
  await expect(next.locator('code span[class^="ff-tok-"]').first()).toBeVisible({
    timeout: 15_000,
  });
});

test('the article uses the system font stack until a font is added', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await closePanels(page);
  await expect(page.getByText(/Choose a web font or drop it anywhere/)).toBeVisible();
  await expect(page.locator('.ff-article:not([data-probe])')).toHaveCSS('font-family', /system-ui/);
});

test('fonts and CSS files can be dropped anywhere on the page', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await closePanels(page);
  const bytes = [...readFileSync(sourceSans)];
  const drop = (name: string, type: string, content: number[] | string) =>
    page.evaluate(
      ([fileName, mime, data]) => {
        const transfer = new DataTransfer();
        const part = typeof data === 'string' ? data : new Uint8Array(data as number[]);
        transfer.items.add(new File([part], fileName as string, { type: mime as string }));
        for (const kind of ['dragenter', 'dragover', 'drop']) {
          window.dispatchEvent(
            new DragEvent(kind, { dataTransfer: transfer, bubbles: true, cancelable: true }),
          );
        }
      },
      [name, type, content],
    );
  await drop('SourceSansPro-Regular.woff2', 'font/woff2', bytes);
  await expect(page.locator('.ff-article-view__overlay')).toBeVisible({ timeout: 15_000 });
  await drop(
    'fonts.css',
    'text/css',
    '@font-face { font-family: "Remote"; src: url(https://example.com/remote.woff2) format("woff2"); }',
  );
  await expect(page.getByRole('button', { name: '1. Inputs', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await expect(
    page
      .getByRole('list', { name: 'Fonts found in the CSS' })
      .getByRole('link', { name: 'Download the file' }),
  ).toBeVisible();
  await drop('notes.txt', 'text/plain', 'hello');
  await expect(page.getByRole('alert')).toContainText('Only font files');
});

test('the generator page itself does not shift while it loads', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.addInitScript(() => {
    (window as unknown as { shifts: number }).shifts = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as {
        value: number;
        hadRecentInput: boolean;
      }[]) {
        if (!entry.hadRecentInput) (window as unknown as { shifts: number }).shifts += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.waitForTimeout(1500);
  const total = await page.evaluate(() => (window as unknown as { shifts: number }).shifts);
  expect(total).toBeLessThan(0.02);
});

test('the header keeps its size and position on every page', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const boxes: unknown[] = [];
  for (const path of ['/en/', '/en/fonts/', '/en/presets/', '/en/guide/', '/en/credits/']) {
    await page.goto(path);
    boxes.push(
      await page.evaluate(() => {
        const rect = (selector: string) => {
          const { y, height } = document.querySelector(selector)?.getBoundingClientRect() ?? {};
          return [y, height];
        };
        return { header: rect('.ff-header'), brand: rect('.ff-brand') };
      }),
    );
  }
  for (const box of boxes) expect(box).toEqual(boxes[0]);
});

test('the intro guide has the same height in every article layer', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  const heights = () =>
    view
      .locator('.ff-intro')
      .evaluateAll((guides) =>
        guides.map((guide) => Math.round(guide.getBoundingClientRect().height)),
      );
  const collapsed = await heights();
  expect(new Set(collapsed).size).toBe(1);
  await view.getByRole('button', { name: 'Show the guide' }).click();
  await expect.poll(async () => new Set(await heights()).size).toBe(1);
});

test('an open panel fills the screen down to its bottom edge', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'audience');
  const box = await page.locator('.ff-dock__panel:not([hidden])').boundingBox();
  const bottom = (box?.y ?? 0) + (box?.height ?? 0);
  expect(bottom).toBeGreaterThan(895);
  expect(bottom).toBeLessThanOrEqual(900);
});

test('the next button moves to the following panel and the last one has none', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  await page.getByRole('button', { name: 'Next: 2. Audience' }).click();
  await expect(page.getByRole('button', { name: '2. Audience', exact: true })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await openStep(page, 'results');
  await expect(page.getByRole('button', { name: /^Next:/ })).toHaveCount(0);
});

test('a click outside an open panel closes it', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'tuning');
  await page.locator('.ff-header').click({ position: { x: 700, y: 5 } });
  await expect(page.locator('.ff-dock__panel:not([hidden])')).toHaveCount(0);
});

test('the layout shift score shows the value before and after in rating colours', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const scores = page.locator('.ff-shift .ff-shift__score');
  await expect(scores).toHaveCount(2);
  await expect(scores.first()).toHaveAttribute('data-rating', /.+/);
  await expect(scores.last()).toHaveAttribute('data-rating', 'good');
  await expect(page.locator('.ff-shift__arrow')).toBeVisible();
});

test('share sits next to download and copy in the code block and spacing is on by default', async ({
  page,
}) => {
  await page.goto('/en/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openStep(page, 'results');
  const header = page.locator('.ff-dock__panel:not([hidden]) .ff-code__header');
  await expect(header.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
  await expect(header.getByRole('button', { name: /^Download/ })).toBeVisible();
  await expect(header.getByRole('button', { name: /^Copy code/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy share link' })).toHaveCount(0);

  await openStep(page, 'tuning');
  await page.getByText('Spacing while fonts load', { exact: false }).first().click();
  await expect(
    page.getByRole('checkbox', { name: 'Compensate spacing while the font loads' }),
  ).toBeChecked();
});

test('the generated code stays left to right and queries stay readable on an Arabic page', async ({
  page,
}) => {
  await page.goto('/ar/');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await openStep(page, 'results');
  await expect(page.locator('.ff-dock__panel:not([hidden]) .ff-code pre').first()).toHaveAttribute(
    'dir',
    'ltr',
  );
  await openStep(page, 'audience');
  const tag = page.locator('.ff-tags__list .ff-tag', { hasText: '0.5%' }).first();
  await expect(tag).toHaveAttribute('dir', 'auto');
});

test('an import link without a pending import explains that it expired', async ({ page }) => {
  await page.goto('/en/#import');
  await page.waitForFunction(() => document.querySelector('astro-island:not([ssr])'));
  await expect(page.getByRole('alert').filter({ hasText: 'no longer available' })).toBeVisible();
});

test('the intro guide explains the jump and opens each step', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await closePanels(page);
  const guide = page.getByRole('region', { name: /Stop the page from jumping/ });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('layout shift');
  await guide.getByRole('button', { name: /Choose the audience/ }).click();
  await expect(page.getByLabel('Audience').first()).toBeVisible();
});

test('the intro guide folds into a strip once a font is loaded and can be reopened', async ({
  page,
}) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  await closePanels(page);
  const view = page.getByRole('region', { name: 'Article' });
  const show = view.getByRole('button', { name: 'Show the guide' });
  await expect(show).toBeVisible();
  await expect(view.getByRole('button', { name: /Add your font/ })).toHaveCount(0);
  await show.click();
  await expect(view.getByRole('button', { name: /Add your font/ })).toBeVisible();
  await view.getByRole('button', { name: 'Hide the guide' }).click();
  await expect(show).toBeVisible();
});

test.describe('the single input field', () => {
  const open = async (page: Page) => {
    await page.goto('/en/');
    await waitForGenerator(page);
    await openStep(page, 'inputs');
    return page.getByLabel('Font name, CSS or copied site data');
  };

  test('a font name lists families of both catalogs with their source', async ({ page }) => {
    const field = await open(page);
    await field.fill('roboto');
    const list = page.getByRole('list', { name: 'Matching families' });
    await expect(list).toBeVisible();
    await expect(
      list.getByRole('button', { name: /^Roboto\b.*Google Fonts/ }).first(),
    ).toBeVisible();
    await field.fill('a');
    await expect(list.getByText('Fontsource').first()).toBeVisible();
    await expect(list.getByText('Google Fonts').first()).toBeVisible();
  });

  test('a name that matches nothing says so', async ({ page }) => {
    const field = await open(page);
    await field.fill('zzzzqqqq');
    await expect(page.getByText('No family matches this name.')).toBeVisible();
  });

  test('pasted CSS lists its faces and drops the name search', async ({ page }) => {
    const field = await open(page);
    await field.fill(
      '@font-face { font-family: "Demo Sans"; font-weight: 700; src: url(https://fonts.test/demo.woff2) format("woff2"); }',
    );
    const faces = page.getByRole('list', { name: 'Fonts found in the CSS' });
    await expect(faces).toContainText('Demo Sans');
    await expect(faces.getByRole('link', { name: 'Download the file' })).toBeVisible();
    await expect(page.getByRole('list', { name: 'Matching families' })).toHaveCount(0);
  });

  test('pasted CSS split into subsets lists one row per weight and style', async ({ page }) => {
    const field = await open(page);
    const face = (weight: number, range: string, name: string) =>
      `@font-face { font-family: "Split"; font-weight: ${weight}; src: url(https://fonts.test/${name}.woff2) format("woff2"); unicode-range: ${range}; }`;
    await field.fill(
      [400, 700]
        .flatMap((weight) => [
          face(weight, 'U+0400-045F', `cyr-${weight}`),
          face(weight, 'U+0000-00FF', `latin-${weight}`),
        ])
        .join('\n'),
    );
    const faces = page.getByRole('list', { name: 'Fonts found in the CSS' });
    await expect(faces.getByRole('listitem')).toHaveCount(2);
    await expect(faces).toContainText('Other subsets skipped: 1');
    await expect(faces.getByRole('link', { name: 'Download the file' }).first()).toHaveAttribute(
      'href',
      'https://fonts.test/latin-400.woff2',
    );
  });

  test('text that looks like CSS but has no fonts reports it', async ({ page }) => {
    const field = await open(page);
    await field.fill('@import url("x.css");');
    await expect(
      page.getByText('No @font-face rules or Google Fonts links were found.'),
    ).toBeVisible();
  });

  test('pasted site data opens the import confirmation and clears the field', async ({ page }) => {
    const field = await open(page);
    await field.fill(
      JSON.stringify({ v: 1, origin: 'https://site.test', faces: [{ family: 'Inter' }] }),
    );
    await expect(
      page.getByRole('region', { name: 'Import from https://site.test?' }),
    ).toBeVisible();
    await expect(field).toHaveValue('');
  });

  test('broken site data is rejected', async ({ page }) => {
    const field = await open(page);
    await field.fill('{"v":1');
    await expect(page.getByText('The pasted text is not valid import data.')).toBeVisible();
  });

  test('a CSS file chosen through the field is read into it', async ({ page }) => {
    const field = await open(page);
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles({
      name: 'fonts.css',
      mimeType: 'text/css',
      buffer: Buffer.from(
        '@font-face { font-family: "From File"; src: url(https://f.test/a.woff2); }',
      ),
    });
    await expect(field).toHaveValue(/From File/);
    await expect(page.getByRole('list', { name: 'Fonts found in the CSS' })).toContainText(
      'From File',
    );
  });

  test('the import instructions open from the link under the field', async ({ page }) => {
    await open(page);
    const toggle = page.getByRole('button', { name: 'Import from a website…' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('heading', { name: 'Bookmarklet' })).toBeVisible();
  });
});

test('the input field with suggestions and CSS results has no axe violations', async ({ page }) => {
  await page.goto('/en/');
  await waitForGenerator(page);
  await openStep(page, 'inputs');
  const field = page.getByLabel('Font name, CSS or copied site data');
  await field.fill('roboto');
  await page.getByRole('list', { name: 'Matching families' }).getByRole('button').first().click();
  await page.getByRole('button', { name: 'Import from a website…' }).click();
  const names = await new AxeBuilder({ page }).analyze();
  expect(names.violations).toEqual([]);
  await field.fill('@font-face { font-family: A; src: url(https://f.test/a.woff2); }');
  const css = await new AxeBuilder({ page }).analyze();
  expect(css.violations).toEqual([]);
});
