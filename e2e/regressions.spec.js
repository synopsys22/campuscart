import { addFromProductPage, expect, logInAs, logOut, registerNewStudent, test } from './support.js';

test('logging out of the admin area leads home, and the next login is not sent back there', async ({ page }) => {
  await logInAs(page, 'Admin');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await logOut(page);
  await expect(page).toHaveURL(/localhost:\d+\/$/);

  await page.getByRole('link', { name: 'Log in' }).click();
  await page.getByRole('button', { name: 'Log in as Student' }).click();
  await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This page is for admins' })).toHaveCount(0);
});

test('a student is never returned to an admin page after logging in', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Log in as Student' }).click();
  await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'This page is for admins' })).toHaveCount(0);
});

test('a session that stops being valid sends the student to log in', async ({ page }) => {
  await registerNewStudent(page);
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('campuscart-token', 'no-longer-valid'));
  await page.getByRole('link', { name: 'Orders', exact: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText('Your session has ended. Please log in again.')).toBeVisible();
});

test('opening the login page while logged in goes home', async ({ page }) => {
  await logInAs(page, 'Student');
  await page.goto('/login');
  await expect(page).toHaveURL(/localhost:\d+\/$/);
});

test('an invalid coupon explains itself and blocks checkout until it is removed', async ({ page }) => {
  await registerNewStudent(page);
  // ₹649 × 2 qualifies for WELCOME100. One copy (₹649) doesn't.
  await addFromProductPage(page, 'clean-code');
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.getByTestId('order-total')).toHaveText('₹1,298');
  await page.getByLabel('Coupon code').fill('WELCOME100');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByTestId('order-total')).toHaveText('₹1,198');

  await page.getByRole('button', { name: 'Decrease quantity' }).click();
  await expect(page.getByText('This coupon needs a minimum order of ₹999.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Go to checkout' })).toBeDisabled();
  await expect(page.getByText('Remove the coupon', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Remove coupon' }).click();
  await expect(page.getByRole('button', { name: 'Go to checkout' })).toBeEnabled();
});

test('the compare page clears products that no longer exist', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'campuscart-compare',
      JSON.stringify([{ _id: '507f1f77bcf86cd799439011', name: 'Gone', slug: 'gone', image: '' }]),
    ),
  );
  await page.goto('/compare');
  await expect(page.getByRole('heading', { name: 'Nothing to compare yet' })).toBeVisible();
});

test('moving to a related product resets the quantity', async ({ page }) => {
  await page.goto('/products/raspberry-pi-5-8-gb');
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.getByRole('group', { name: 'Quantity' }).locator('output')).toHaveText('2');
  await page.locator('.detail-section .bin-name a').first().click();
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('Raspberry Pi 5 (8 GB)');
  await expect(page.getByRole('group', { name: 'Quantity' }).locator('output')).toHaveText('1');
});

test('a coupon that expires today is still live', async ({ page }) => {
  await logInAs(page, 'Admin');
  await page.goto('/admin/coupons');
  await page.getByRole('button', { name: 'Add coupon' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Code').fill('TODAYONLY');
  await dialog.getByLabel('Value').fill('10');
  const today = await page.evaluate(() => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });
  await dialog.getByLabel('Expires (optional)').fill(today);
  await dialog.getByRole('button', { name: 'Create coupon' }).click();
  await expect(page.getByRole('row', { name: /TODAYONLY/ }).getByText('Live')).toBeVisible();
});

test('the kit form explains a blank quantity', async ({ page }) => {
  await logInAs(page, 'Admin');
  await page.goto('/admin/kits');
  await page.getByRole('button', { name: 'Add kit' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill('Blank Quantity Kit');
  await dialog.getByLabel('Description').fill('A kit to check the form errors.');
  await dialog.getByRole('button', { name: 'Add product' }).click();
  await dialog.getByLabel('Quantity of product 1').fill('');
  await dialog.getByRole('button', { name: 'Create kit' }).click();
  await expect(dialog.getByText('Enter a quantity for every product.')).toBeVisible();
});
