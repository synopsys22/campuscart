import AxeBuilder from '@axe-core/playwright';
import { expect, logInAs, test, tokenOf } from './support.js';

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

const PUBLIC_PAGES = ['/', '/products', '/products/raspberry-pi-5-8-gb', '/categories', '/kits', '/kits/iot-starter-kit', '/setup-builder', '/compare', '/track', '/login', '/register', '/no-such-page'];
const STUDENT_PAGES = ['/cart', '/wishlist', '/account', '/account/orders', '/account/wallet', '/account/addresses', '/account/reviews', '/account/setups', '/account/password'];
const ADMIN_PAGES = ['/admin', '/admin/orders', '/admin/payments', '/admin/payments?tab=wallet', '/admin/products', '/admin/inventory', '/admin/categories', '/admin/kits', '/admin/coupons', '/admin/users', '/admin/reviews'];

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

    test('checkout, the payment window, tracking and the delivery code meet WCAG AA', async ({ page }) => {
      await logInAs(page, 'Student');
      await page.goto('/products/gel-pen-set-10-pack');
      await page.getByRole('button', { name: 'Add to cart' }).click();
      await expect(page.getByText(/^Added .* to your cart$/).first()).toBeVisible();

      await page.goto('/checkout');
      await page.getByRole('radio', { name: /Campus pickup/ }).check();
      await audit(page, 'checkout delivery step');
      await page.getByRole('radio', { name: /Central Library entrance/ }).check();
      await page.getByText('2 PM to 4 PM').click();
      await page.getByRole('button', { name: 'Continue to payment' }).click();
      await audit(page, 'checkout payment step');
      await page.getByText('Card (demo)', { exact: true }).click();
      await page.getByRole('button', { name: 'Review order' }).click();
      await page.getByRole('button', { name: /^Pay ₹/ }).click();
      await expect(page.getByRole('button', { name: /^Pay ₹/ }).last()).toBeVisible();
      await audit(page, 'card payment window');
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();

      await page.goto('/account/orders');
      await page.getByRole('button', { name: 'Out for Delivery', exact: true }).click();
      await page.locator('.order-row').first().click();
      await expect(page.getByRole('heading', { name: 'Your delivery code' })).toBeVisible();
      await audit(page, 'order with a delivery code');
      await page.getByRole('link', { name: 'Tracking page' }).click();
      await expect(page.getByRole('heading', { name: 'Journey' })).toBeVisible();
      await audit(page, 'public tracking page');

      // Leaves the shared demo account's cart as it was.
      await page.request.delete('/api/cart', { headers: { Authorization: `Bearer ${await tokenOf(page)}` } });
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
