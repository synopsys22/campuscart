import { expect, logInAs, test } from './support.js';

const fillOf = (locator) => locator.evaluate((element) => getComputedStyle(element).backgroundColor);

test('a guest sees no role markings', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.role-pill')).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Admin mode' })).toHaveCount(0);
});

test('the login page says what each demo account is for', async ({ page }) => {
  await page.goto('/login');
  const demo = page.getByRole('region', { name: 'Try a demo account' });
  await expect(demo).toContainText('Shop, check out and track your own orders');
  await expect(demo).toContainText('Manage products, stock, orders and users');
});

test.describe('logged in as a student', () => {
  test.beforeEach(async ({ page }) => {
    await logInAs(page, 'Student');
  });

  test('the header shows the student role and no admin markings', async ({ page }) => {
    await expect(page.locator('.site-header .role-pill')).toHaveText('Student');
    await expect(page.getByRole('complementary', { name: 'Admin mode' })).toHaveCount(0);
  });

  test('the account area is personal and limited to their own records', async ({ page }) => {
    await page.goto('/account/orders');
    await expect(page.locator('.side-head')).toContainText('Student account');
    await expect(page.locator('.role-banner')).toHaveText(/Only your own orders/);
    await expect(page.locator('.admin-area')).toHaveCount(0);
  });

  test('a product page does not show stock management', async ({ page }) => {
    await page.goto('/products/raspberry-pi-5-8-gb');
    await expect(page.locator('.buy-box')).toBeVisible();
    await expect(page.locator('.admin-note')).toHaveCount(0);
  });
});

test.describe('logged in as an admin', () => {
  test.beforeEach(async ({ page }) => {
    await logInAs(page, 'Admin');
  });

  test('the header shows the admin role, and the strip moves between store and dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-header .role-pill')).toHaveText('Admin');
    const strip = page.getByRole('complementary', { name: 'Admin mode' });
    await strip.getByRole('link', { name: 'Go to dashboard' }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await strip.getByRole('link', { name: 'View the store' }).click();
    await expect(page).toHaveURL(/localhost:\d+\/$/);
  });

  test('each admin page says what it manages', async ({ page }) => {
    const pages = [
      ['/admin', /whole store/],
      ['/admin/orders', /Every customer's orders/],
      ['/admin/products', /what the store sells/],
      ['/admin/inventory', /low-stock alerts/],
      ['/admin/categories', /categories/],
      ['/admin/kits', /Project Kits/],
      ['/admin/coupons', /discount codes/],
      ['/admin/users', /change roles/],
      ['/admin/reviews', /Remove reviews/],
    ];
    for (const [url, text] of pages) {
      await page.goto(url);
      await expect(page.locator('.role-banner')).toHaveText(text);
    }
    await expect(page.locator('.side-head')).toContainText('Admin panel');
  });

  test('the admin area has its own colour, different from the store', async ({ page }) => {
    await page.goto('/admin');
    const adminFill = await fillOf(page.locator('.admin-area .chip-on').first());
    await page.goto('/products');
    const storeFill = await fillOf(page.getByRole('button', { name: 'Grid view' }));
    expect(adminFill).not.toBe(storeFill);
  });

  test('a product page shows the exact stock with a link to manage it', async ({ page }) => {
    await page.goto('/products/raspberry-pi-5-8-gb');
    const note = page.locator('.admin-note');
    await expect(note).toHaveText(/\d+ in stock/);
    await note.getByRole('link', { name: 'Manage inventory' }).click();
    await expect(page).toHaveURL(/\/admin\/inventory$/);
  });
});
