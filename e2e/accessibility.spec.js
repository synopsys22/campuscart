import AxeBuilder from '@axe-core/playwright';
import { expect, logInAs, test } from './support.js';

const WCAG_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function audit(page, label) {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  const summary = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join(' | ')}`,
  );
  expect(summary, `accessibility problems on ${label}`).toEqual([]);
}

const PUBLIC_PAGES = ['/', '/products', '/products/raspberry-pi-5-8-gb', '/categories', '/kits', '/kits/iot-starter-kit', '/setup-builder', '/compare', '/login', '/register', '/no-such-page'];
const STUDENT_PAGES = ['/cart', '/wishlist', '/account', '/account/orders', '/account/addresses', '/account/reviews', '/account/setups', '/account/password'];
const ADMIN_PAGES = ['/admin', '/admin/orders', '/admin/products', '/admin/inventory', '/admin/categories', '/admin/kits', '/admin/coupons', '/admin/users', '/admin/reviews'];

for (const colorScheme of ['dark', 'light']) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme, reducedMotion: 'reduce' });

    test('public pages meet WCAG AA', async ({ page }) => {
      for (const url of PUBLIC_PAGES) {
        await page.goto(url);
        await audit(page, url);
      }
    });

    test('student pages meet WCAG AA', async ({ page }) => {
      await logInAs(page, 'Student');
      for (const url of STUDENT_PAGES) {
        await page.goto(url);
        await audit(page, url);
      }
    });

    test('admin pages meet WCAG AA', async ({ page }) => {
      await logInAs(page, 'Admin');
      for (const url of ADMIN_PAGES) {
        await page.goto(url);
        await audit(page, url);
      }
    });
  });
}

test('the hero traces finish drawing, and are still there after a resize', async ({ page }) => {
  const offsets = () =>
    page.evaluate(() => [...document.querySelectorAll('.trace path')].map((path) => getComputedStyle(path).strokeDashoffset));
  await page.goto('/');
  await expect.poll(offsets).toEqual(Array(6).fill('0px'));
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect.poll(offsets).toEqual(Array(6).fill('0px'));
});

test('the keyboard can reach and operate quick search', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const input = page.getByRole('combobox', { name: 'Search products and pages' });
  await expect(input).toBeFocused();
  await input.fill('arduino');
  await expect(page.getByRole('option', { name: /Arduino Uno R3/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Arduino Uno R3' })).toBeVisible();
});

test('Escape closes a dialog and returns focus', async ({ page }) => {
  await logInAs(page, 'Admin');
  await page.goto('/admin/categories');
  const trigger = page.getByRole('button', { name: 'Add category' });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
