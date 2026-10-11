import { test as base, expect, type Page } from '@playwright/test';

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
    await use(page);
    expect(violations).toEqual([]);
  },
});

export { expect };

export async function openSection(page: Page, name: string) {
  const button = page.getByRole('button', { name, exact: true });
  if ((await button.getAttribute('aria-expanded')) === 'false') await button.click();
}
