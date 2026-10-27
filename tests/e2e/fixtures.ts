import { test as base, expect, type Locator, type Page } from '@playwright/test';

export const LOCALES = ['en', 'ru', 'ar', 'es', 'pt'] as const;
export const RTL_LOCALES: readonly string[] = ['ar'];

export const test = base.extend({
  page: async ({ page }, use) => {
    const violations: string[] = [];
    await page.exposeFunction('__reportCsp', (violation: string) => violations.push(violation));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        (window as unknown as { __reportCsp: (value: string) => void }).__reportCsp(
          `${event.violatedDirective}: ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`,
        );
      });
    });
    await page.addInitScript(() => {
      const key = 'fontstay:layout:dock';
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify({ opened: ['tuning'] }));
      }
    });
    await use(page);
    expect(violations).toEqual([]);
  },
});

export { expect };

export async function waitForGenerator(page: Page) {
  await page
    .locator('astro-island[component-export="GeneratorApp"]:not([ssr])')
    .waitFor({ state: 'attached' });
}

const SYSTEM_NAMES: Record<string, RegExp> = {
  windows: /^Windows/,
  macos: /^macOS/,
  ios: /^iOS/,
  android: /^Android/,
  linux: /^Linux/,
  chromeos: /^Chrome ?OS/,
};

export const STEPS = {
  inputs: '1. Inputs',
  audience: '2. Audience',
  tuning: '3. Fine-tuning',
  results: '4. Results',
} as const;

const stepButton = (page: Page, step: keyof typeof STEPS) =>
  page.locator(`.ff-dock__column[data-id="${step}"] .ff-dock__heading button`);

export async function openStep(page: Page, step: keyof typeof STEPS) {
  const button = stepButton(page, step);
  await expect(async () => {
    if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass();
}

export async function selectSystem(page: Page, os: string) {
  await openStep(page, 'tuning');
  const button = page.getByRole('button', { name: SYSTEM_NAMES[os] ?? os });
  if ((await button.getAttribute('aria-expanded')) === 'false') await button.click();
}

export async function openSupport(page: Page) {
  await closePanels(page);
  const button = page.getByRole('button', { name: 'Browser support', exact: true });
  if ((await button.getAttribute('aria-expanded')) === 'false') await button.click();
}

export async function openExport(page: Page) {
  await openStep(page, 'results');
  const button = page.getByRole('button', { name: 'Export', exact: true });
  if ((await button.getAttribute('aria-expanded')) === 'false') await button.click();
}

export async function choose(
  box: Locator,
  option: string | { label: string | RegExp } | { index: number },
) {
  const button = box.first();
  const list = box.page().getByRole('listbox');
  const item =
    typeof option === 'string'
      ? list.locator(`[role="option"][data-value="${option}"]`)
      : 'label' in option
        ? list.getByRole('option', { name: option.label })
        : list.getByRole('option').nth(option.index);
  await expect(async () => {
    if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
    await item.click({ timeout: 2000 });
  }).toPass();
}

export async function listed(box: Locator): Promise<string> {
  await box.click();
  const texts = await box.page().getByRole('listbox').getByRole('option').allInnerTexts();
  await box.page().keyboard.press('Escape');
  return texts.join(' | ');
}

export async function closePanels(page: Page) {
  for (const step of Object.keys(STEPS) as (keyof typeof STEPS)[]) {
    const button = stepButton(page, step);
    if ((await button.getAttribute('aria-expanded')) === 'true') await button.click();
  }
}

export async function openPopover(scope: Locator | Page, name: string) {
  const button = scope.getByRole('button', { name: new RegExp(`^${name}`) }).first();
  await expect(async () => {
    if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
  }).toPass();
}

export async function fillQuery(page: Page, text: string) {
  await page.evaluate(
    (detail) => window.dispatchEvent(new CustomEvent('ff-audience-set', { detail })),
    text,
  );
}

export const queryField = (page: Page) => page.locator('.ff-tags__field');
