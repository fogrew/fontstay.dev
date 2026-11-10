import { expect, LOCALES, test } from './fixtures';

test.describe('mobile header menu', () => {
  test.use({ viewport: { width: 375, height: 700 } });

  test('collapses the navigation behind a toggle, closes on Escape and resets on resize', async ({
    page,
  }) => {
    await page.goto('/en/fonts/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAttribute('aria-controls', 'ff-nav');
    await expect(nav).toBeHidden();
    await expect(page.locator('[data-locale-menu] > summary')).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav.getByRole('link')).toHaveCount(9);
    await expect(nav.locator('a[aria-current="page"]')).toHaveText('System fonts');

    await nav.getByRole('link').first().focus();
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();

    await toggle.click();
    await page.setViewportSize({ width: 1024, height: 700 });
    await expect(nav).toBeVisible();
    await expect(toggle).toBeHidden();
    await page.setViewportSize({ width: 375, height: 700 });
    await expect(nav).toBeHidden();
  });

  test('lists the secondary pages flat in the mobile menu', async ({ page }) => {
    await page.goto('/en/credits/');
    await page.getByRole('button', { name: 'Menu' }).click();
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const name of ['CLI', 'MCP server', 'Extensions', 'Credits', 'Changelog']) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }
    await expect(nav.locator('a[aria-current="page"]')).toHaveText('Credits');
  });

  test('keeps a single dropdown open at a time', async ({ page }) => {
    await page.goto('/en/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    const language = page.locator('[data-locale-menu]');
    await toggle.click();
    await language.locator('summary').click();
    await expect(language).toHaveJSProperty('open', true);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(language).toHaveJSProperty('open', false);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('opening with the keyboard focuses the first link', async ({ page }) => {
    await page.goto('/en/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ff-nav a').first()).toBeFocused();
  });

  test('closes when clicking outside the header', async ({ page }) => {
    await page.goto('/en/');
    const toggle = page.getByRole('button', { name: 'Menu' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.mouse.click(10, 600);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  for (const locale of LOCALES) {
    test(`${locale}: the open header does not overflow horizontally`, async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await page.goto(`/${locale}/`);
      await page.locator('[data-nav-toggle]').click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('desktop header menu', () => {
  test.use({ viewport: { width: 1024, height: 700 } });

  test('groups the secondary pages under More and keeps one dropdown open', async ({ page }) => {
    await page.goto('/en/changelog/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const more = page.locator('[data-more-menu]');
    const language = page.locator('[data-locale-menu]');
    await expect(nav.getByRole('link', { name: 'Changelog' })).toBeHidden();
    await more.locator('summary').click();
    await expect(more).toHaveJSProperty('open', true);
    await expect(nav.getByRole('link', { name: 'Changelog' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    for (const name of ['CLI', 'MCP server', 'Extensions', 'Credits']) {
      await expect(nav.getByRole('link', { name })).toBeVisible();
    }
    await language.locator('summary').click();
    await expect(more).toHaveJSProperty('open', false);
    await more.locator('summary').click();
    await expect(language).toHaveJSProperty('open', false);
    await page.keyboard.press('Escape');
    await expect(more).toHaveJSProperty('open', false);
  });

  for (const locale of LOCALES) {
    test(`${locale}: the open More list does not overflow at 768px`, async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 700 });
      await page.goto(`/${locale}/credits/`);
      await page.locator('[data-more-menu] > summary').click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('header navigation fit', () => {
  const visibleLinks = (page: import('@playwright/test').Page) =>
    page.locator('.ff-header__nav > li[data-nav-item]:visible > a').count();

  const settled = (page: import('@playwright/test').Page) =>
    expect(page.locator('#ff-nav')).toHaveAttribute('data-ready', '');

  test('shows every item directly when the width allows and hides More', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto('/en/');
    await settled(page);
    await expect(page.locator('[data-more]')).toBeHidden();
    expect(await visibleLinks(page)).toBe(9);
  });

  test('collapses only the items that do not fit into More as the width shrinks', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.goto('/en/');
    await settled(page);
    let previous = 9;
    for (const width of [1200, 1024, 768]) {
      await page.setViewportSize({ width, height: 700 });
      await expect
        .poll(async () => {
          const direct = await visibleLinks(page);
          const inMore = await page.locator('[data-more-list] > li').count();
          const fits = await page.evaluate(() => {
            const list = document.querySelector('.ff-header__nav') as HTMLElement;
            return list.scrollWidth <= list.clientWidth;
          });
          const moreShown = await page.locator('[data-more]').isVisible();
          return direct + inMore === 9 && fits && moreShown === inMore > 0;
        })
        .toBe(true);
      const direct = await visibleLinks(page);
      expect(direct).toBeLessThanOrEqual(previous);
      previous = direct;
    }
    expect(previous).toBeLessThan(9);
  });

  for (const width of [768, 1024, 1440]) {
    test(`${width}px: More is aligned with the other items`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 });
      await page.goto('/en/');
      await settled(page);
      const box = async (selector: string) => {
        const rect = await page.locator(selector).first().boundingBox();
        if (!rect) throw new Error(`${selector} has no box`);
        return rect;
      };
      if (await page.locator('[data-more]').isVisible()) {
        const link = await box('[data-nav-item]:visible > a');
        const summary = await box('[data-more-menu] > summary');
        expect(summary.y).toBeCloseTo(link.y, 0);
        expect(summary.height).toBeCloseTo(link.height, 0);
      }
    });
  }

  test('320px: the menu lists every page flat without a More group', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto('/en/');
    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('[data-more]')).toBeHidden();
    await expect(page.locator('#ff-nav').getByRole('link')).toHaveCount(9);
  });
  test('keeps the navigation visible while navigating between pages', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 700 });
    await page.addInitScript(() => {
      const hiddenFrames = () => {
        const nav = document.querySelector('#ff-nav');
        if (!nav) return false;
        const link = nav.querySelector('a');
        return (
          getComputedStyle(nav).visibility === 'hidden' ||
          !link ||
          link.getBoundingClientRect().width === 0
        );
      };
      let frames = 0;
      const tick = () => {
        if (hiddenFrames()) sessionStorage.setItem('ff-nav-blink', 'yes');
        if (frames++ < 60) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto('/en/');
    await settled(page);
    await page.evaluate(() => sessionStorage.removeItem('ff-nav-blink'));
    const nav = page.getByRole('navigation', { name: 'Main' });
    for (const name of ['System fonts', 'Presets', 'Guide']) {
      await nav.getByRole('link', { name }).click();
      await expect(nav.locator('a[aria-current="page"]')).toHaveText(name);
      await page.waitForTimeout(500);
    }
    expect(await page.evaluate(() => sessionStorage.getItem('ff-nav-blink'))).toBeNull();
  });
});
