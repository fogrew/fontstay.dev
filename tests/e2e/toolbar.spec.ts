import { expect, LOCALES, test, waitForGenerator } from './fixtures';

const fonts = new URL('../fixtures/fonts/', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const sourceSans = `${fonts}SourceSansPro-Regular.woff2`;
const WIDTHS = [320, 390, 768, 1024, 1440];

for (const locale of LOCALES) {
  test(`the preview toolbar stays on one row at every width in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/${locale}/`);
    await waitForGenerator(page);
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
    const toolbar = page.locator('.ff-article-view__controls');
    await expect(toolbar).toBeVisible({ timeout: 20_000 });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expect(async () => {
        const rows = await toolbar.evaluate((element) => {
          const tops = new Set<number>();
          const controls = element.querySelectorAll('button, [role="combobox"], .ff-shift');
          for (const control of Array.from(controls)) {
            const box = control.getBoundingClientRect();
            if (box.width > 0) tops.add(Math.round(box.top + box.height / 2));
          }
          return { tops: [...tops], overflow: element.scrollWidth - element.clientWidth };
        });
        expect(rows.tops.length, `${width}px`).toBe(1);
        expect(rows.overflow, `${width}px`).toBeLessThanOrEqual(0);
      }).toPass({ timeout: 5000 });
    }
  });
}

test('toolbar icon buttons have names, 24 px targets and a centred arrange group', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const toolbar = page.locator('.ff-article-view__controls');
  await expect(toolbar).toBeVisible({ timeout: 20_000 });
  for (const name of ['Emulation', 'Settings', 'Share', 'Forget']) {
    const button = toolbar.getByRole(name === 'Emulation' ? 'combobox' : 'button', {
      name,
      exact: true,
    });
    await expect(button).toHaveAttribute('title', name);
    const box = await button.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(24);
    expect(box?.height).toBeGreaterThanOrEqual(24);
  }
  const arrange = toolbar.locator('.ff-preview__arrange-button');
  const [first, second] = await arrange.evaluateAll((buttons) =>
    buttons.map((button) => {
      const icon = button.querySelector('.ff-arrange-icon')?.getBoundingClientRect();
      const box = button.getBoundingClientRect();
      return icon ? Math.abs(icon.top + icon.height / 2 - (box.top + box.height / 2)) : 99;
    }),
  );
  expect(first).toBeLessThanOrEqual(1);
  expect(second).toBeLessThanOrEqual(1);
});

for (const locale of ['en', 'ar']) {
  test(`toolbar icon controls share a size and stay centred in ${locale}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto(`/${locale}/`);
    await waitForGenerator(page);
    await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
    const toolbar = page.locator('.ff-article-view__controls');
    await expect(toolbar).toBeVisible({ timeout: 20_000 });

    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      for (const width of [1600, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const more = toolbar.locator('.ff-toolbar__more-toggle');
        if (width === 390 && (await more.getAttribute('aria-expanded')) === 'false') {
          await more.click();
        }
        const controls = await toolbar.evaluate((element) => {
          const measure = (selector: string) => {
            const button = element.querySelector(selector);
            const icon = button?.querySelector('svg');
            if (!button || !icon) throw new Error(`Missing ${selector}`);
            const box = button.getBoundingClientRect();
            const image = icon.getBoundingClientRect();
            return {
              width: box.width,
              height: box.height,
              offset: Math.abs(box.left + box.width / 2 - (image.left + image.width / 2)),
            };
          };
          return {
            preset: measure('.ff-toolbar__modes .ff-tool-button'),
            lens: measure('.ff-toolbar__xray .ff-tool-button'),
            device: measure('.ff-select[data-glyph] .ff-select__button'),
            share: measure('.ff-share__trigger'),
          };
        });
        for (const control of [controls.lens, controls.device, controls.share]) {
          expect(control.width).toBeCloseTo(controls.preset.width, 0);
          expect(control.height).toBeCloseTo(controls.preset.height, 0);
          expect(control.offset).toBeLessThan(1);
        }
        await toolbar.screenshot({
          path: testInfo.outputPath(`${locale}-${colorScheme}-${width}.png`),
        });
      }
    }

    const labels = await toolbar.evaluate((element) => {
      const button = element.querySelector('.ff-share__trigger')?.cloneNode(true) as HTMLElement;
      const icon = button.querySelector('.ff-icon');
      if (!icon) throw new Error('Missing share icon');
      element.append(button);
      const measure = () => ({
        width: button.getBoundingClientRect().width,
        offset: Math.abs(
          button.getBoundingClientRect().left +
            button.getBoundingClientRect().width / 2 -
            (icon.getBoundingClientRect().left + icon.getBoundingClientRect().width / 2),
        ),
      });
      const bare = measure();
      const label = document.createElement('span');
      label.className = 'ff-button__label ff-sr-only';
      label.textContent = 'Copy';
      button.append(label);
      const screenReader = measure();
      label.classList.remove('ff-sr-only');
      label.hidden = true;
      const hidden = measure();
      label.hidden = false;
      const visible = measure();
      const gap = Number.parseFloat(getComputedStyle(label).marginInlineStart);
      button.remove();
      return { bare, screenReader, hidden, visible, gap };
    });
    expect(labels.screenReader).toEqual(labels.bare);
    expect(labels.hidden).toEqual(labels.bare);
    expect(labels.bare.offset).toBeLessThan(1);
    expect(labels.visible.width).toBeGreaterThan(labels.bare.width);
    expect(labels.gap).toBeGreaterThan(0);
  });
}

test('the split-direction icons stay distinct in forced colors', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const icon = page.locator('.ff-article-view__controls .ff-arrange-icon[data-kind="stacked"]');
  await expect(page.locator('.ff-preview__arrange-button').nth(1)).toBeEnabled({ timeout: 20_000 });
  const stacked = await icon.screenshot();
  // Same button for both shapes, so its pressed colours cannot make them differ
  await icon.evaluate((element) => element.setAttribute('data-kind', 'horizontal'));
  const horizontal = await page
    .locator('.ff-preview__arrange-button')
    .nth(1)
    .locator('span')
    .screenshot();
  expect(horizontal.equals(stacked)).toBe(false);
});

test('the view tools move into the More tools menu on a narrow toolbar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/en/');
  await waitForGenerator(page);
  await page.locator('input[type="file"][accept*="woff2"]').setInputFiles(sourceSans);
  const toolbar = page.locator('.ff-article-view__controls');
  await expect(toolbar).toBeVisible({ timeout: 20_000 });
  const more = toolbar.getByRole('button', { name: 'More tools' });
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(toolbar.getByRole('button', { name: 'Overlay' })).toBeVisible();
  await expect(toolbar.getByRole('combobox', { name: 'Emulation' })).toBeVisible();
  const list = toolbar.locator('.ff-toolbar__tool-list');
  const box = await list.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  for (const control of await toolbar.locator('.ff-toolbar__tool-list button:visible').all()) {
    const size = await control.boundingBox();
    expect(size?.width).toBeGreaterThanOrEqual(24);
    expect(size?.height).toBeGreaterThanOrEqual(24);
  }
  await page.keyboard.press('Escape');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(more).toBeFocused();
});
