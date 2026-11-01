import path from 'node:path';
import { expect, logInAs, stockOf, test } from './support.js';

const IMAGE = path.resolve('client/public/favicon.svg');
const PNG = {
  name: 'photo.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/7yMK/gAAAABJRU5ErkJggg==',
    'base64',
  ),
};

test.beforeEach(async ({ page }) => {
  await logInAs(page, 'Admin');
});

test('the dashboard shows real figures and charts', async ({ page }) => {
  await page.goto('/admin');
  const revenue = page.locator('.kpi').filter({ hasText: 'Revenue' }).locator('dd');
  await expect(revenue).toHaveText(/^₹[\d,]+$/);
  await expect(page.locator('.recharts-area-curve')).toBeVisible();
  await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
  await page.getByRole('button', { name: '7 days' }).click();
  await expect(page.getByText(/^In the last 7 days/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Low-stock alerts' })).toBeVisible();
  await expect(page.locator('.status-bars li')).toHaveCount(5);
});

test('an admin creates a product with an image, and it appears in the store', async ({ page }) => {
  const name = `Test Logic Analyzer ${Date.now()}`;
  await page.goto('/admin/products');
  await page.getByRole('button', { name: 'Add product' }).click();
  const dialog = page.getByRole('dialog');

  // A clear error appears when the price is above the MRP.
  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('Brand').fill('Saleae');
  await dialog.getByLabel('SKU').fill(`TLA-${Date.now()}`);
  await dialog.getByLabel('Price (₹)').fill('2000');
  await dialog.getByLabel('MRP (₹)').fill('1500');
  await dialog.getByLabel('Stock', { exact: true }).fill('3');
  await dialog.getByLabel('Description').fill('An eight-channel logic analyzer for debugging digital circuits.');
  await dialog.getByRole('button', { name: 'Create product' }).click();
  await expect(dialog.getByText('The selling price cannot be above the MRP.').first()).toBeVisible();
  await dialog.getByLabel('MRP (₹)').fill('2500');

  await dialog.getByTestId('product-image-input').setInputFiles(PNG);
  await expect(dialog.locator('.image-item img')).toHaveCount(1);

  await dialog.getByRole('button', { name: 'Add spec' }).click();
  await dialog.getByLabel('Spec 1 name').fill('Channels');
  await dialog.getByLabel('Spec 1 value').fill('8');
  await dialog.getByRole('button', { name: 'Create product' }).click();
  await expect(page.getByText('Product created')).toBeVisible();

  const slug = name.toLowerCase().replace(/\s+/g, '-');
  await page.goto(`/products/${slug}`);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.getByText('Channels')).toBeVisible();
  await expect(page.getByText('Only 3 left')).toBeVisible();
  const image = page.locator('.detail-image');
  await expect(image).toHaveAttribute('src', /^\/uploads\//);
});

test('rejects an image type that is not allowed', async ({ page }) => {
  await page.goto('/admin/products');
  await page.getByRole('button', { name: 'Add product' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByTestId('product-image-input').setInputFiles(IMAGE);
  await expect(dialog.getByText('Images must be JPG, PNG or WebP.')).toBeVisible();
});

test('changing stock updates the store and the low-stock alert', async ({ page, request }) => {
  await page.goto('/admin/inventory');
  await page.getByLabel('Search inventory').fill('Laptop Stand');
  const row = page.getByRole('row', { name: /Aluminium Laptop Stand/ });
  await expect(row.getByText('OK')).toBeVisible();

  await row.getByLabel('Stock for Aluminium Laptop Stand').fill('2');
  await row.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Updated stock for Aluminium Laptop Stand')).toBeVisible();
  await expect(row.getByText('Low')).toBeVisible();
  expect(await stockOf(request, 'aluminium-laptop-stand')).toBe(2);

  await page.goto('/admin');
  await expect(page.getByRole('row', { name: /Aluminium Laptop Stand/ })).toBeVisible();
});

test('hiding a product removes it from the store', async ({ page, request }) => {
  await page.goto('/admin/products');
  await page.getByLabel('Search products').fill('HDMI 2.0');
  await page.getByRole('button', { name: 'Hide HDMI 2.0 Cable (1.5 m)' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Hide product' }).click();
  await expect(page.getByText('Product hidden from the store')).toBeVisible();
  const response = await request.get('/api/products/hdmi-2-0-cable-1-5-m');
  expect(response.status()).toBe(404);
});

test('an admin manages categories, coupons, kits, users and reviews', async ({ page }) => {
  // Categories
  await page.goto('/admin/categories');
  await page.getByRole('button', { name: 'Add category' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Robotics');
  await page.getByRole('dialog').getByRole('button', { name: 'Create category' }).click();
  await expect(page.getByRole('cell', { name: 'Robotics', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete Dev Hardware' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete category' }).click();
  await expect(page.getByText(/still has \d+ products/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Keep it as is' }).click();
  await page.getByRole('button', { name: 'Delete Robotics' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete category' }).click();
  await expect(page.getByRole('cell', { name: 'Robotics', exact: true })).toHaveCount(0);

  // Coupons
  await page.goto('/admin/coupons');
  await expect(page.getByRole('row', { name: /EXPIRED20/ }).getByText('Expired', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add coupon' }).click();
  const couponDialog = page.getByRole('dialog');
  await couponDialog.getByLabel('Code').fill('LABWEEK');
  await couponDialog.getByLabel('Value').fill('150');
  await couponDialog.getByRole('button', { name: 'Create coupon' }).click();
  await expect(couponDialog.getByText('A percent discount cannot be above 100.')).toBeVisible();
  await couponDialog.getByLabel('Value').fill('15');
  await couponDialog.getByRole('button', { name: 'Create coupon' }).click();
  await expect(page.getByRole('row', { name: /LABWEEK/ }).getByText('Live')).toBeVisible();

  // Kits
  await page.goto('/admin/kits');
  await expect(page.getByRole('row', { name: /IoT Starter Kit/ })).toBeVisible();
  await page.getByRole('button', { name: 'Add kit' }).click();
  const kitDialog = page.getByRole('dialog');
  await kitDialog.getByLabel('Name').fill('Exam Week Kit');
  await kitDialog.getByLabel('Description').fill('Pens and notebooks for exam week.');
  await kitDialog.getByRole('button', { name: 'Add product' }).click();
  await kitDialog.getByRole('button', { name: 'Create kit' }).click();
  await expect(page.getByRole('row', { name: /Exam Week Kit/ })).toBeVisible();

  // Users: deactivating blocks login, and the admin can't change their own account.
  await page.goto('/admin/users');
  await page.getByLabel('Search users').fill('Campus Admin');
  await expect(page.getByRole('row', { name: /Campus Admin/ }).getByRole('button')).toHaveCount(0);
  await page.getByLabel('Search users').fill('diya.sharma');
  const diya = page.getByRole('row', { name: /Diya Sharma/ });
  await diya.getByRole('button', { name: 'Deactivate' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Deactivate account' }).click();
  await expect(diya.getByText('Deactivated')).toBeVisible();
  await diya.getByRole('button', { name: 'Reactivate' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reactivate account' }).click();
  await expect(diya.getByText('Active', { exact: true })).toBeVisible();

  // Reviews
  await page.goto('/admin/reviews');
  await expect(page.getByRole('heading', { name: 'Reviews' })).toBeVisible();
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible();
  const firstTitle = await rows.first().locator('strong').innerText();
  await rows.first().getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete review' }).click();
  await expect(page.getByText('Review deleted')).toBeVisible();
  expect(firstTitle.length).toBeGreaterThan(0);
});
