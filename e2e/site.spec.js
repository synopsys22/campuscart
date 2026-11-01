import { expect, logInAs, registerNewStudent, test } from './support.js';

test('the home page shows the board, kits and products', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Everything your CS degree runs on.' })).toBeVisible();
  await expect(page.locator('.board-part')).toHaveCount(6);
  await expect(page.locator('.board-core-count')).not.toHaveText('...');
  await expect(page.getByRole('heading', { name: 'Popular with students' })).toBeVisible();
  await page.locator('.board-part').filter({ hasText: 'CS Textbooks' }).click();
  await expect(page).toHaveURL(/category=cs-textbooks/);
});

test('the theme choice is remembered', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const start = await html.getAttribute('data-theme');
  const other = start === 'dark' ? 'light' : 'dark';
  await page.getByRole('button', { name: `Switch to ${other} theme` }).click();
  await expect(html).toHaveAttribute('data-theme', other);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', other);
});

test('a guest is sent to log in, then returned to the same page', async ({ page }) => {
  await page.goto('/products/clean-code');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Log in as Student' }).click();
  await expect(page).toHaveURL(/\/products\/clean-code$/);

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/account/orders');
  await expect(page).toHaveURL(/\/login$/);
});

test('a wrong password shows a clear message', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('student@campuscart.dev');
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
});

test('registration explains invalid fields', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('A Student');
  await page.getByLabel('Email').fill('student@campuscart.dev');
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Use at least 8 characters.').last()).toBeVisible();
  await page.getByLabel('Password').fill('LongEnough@1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('An account with that email already exists.')).toBeVisible();
});

test('a student cannot open the admin area', async ({ page }) => {
  await registerNewStudent(page);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'This page is for admins' })).toBeVisible();
  await page.goto('/admin/users');
  await expect(page.getByRole('heading', { name: 'This page is for admins' })).toBeVisible();
});

test('the demo student has an order in every status', async ({ page }) => {
  await logInAs(page, 'Student');
  await page.goto('/account/orders');
  for (const status of ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled']) {
    await page.getByRole('button', { name: status, exact: true }).click();
    await expect(page.locator('.order-row').first()).toContainText(status);
  }
});

test('unknown pages and products show a helpful message', async ({ page }) => {
  await page.goto('/no-such-page');
  await expect(page.getByRole('heading', { name: 'Nothing connected here' })).toBeVisible();
  await page.goto('/products/no-such-product');
  await expect(page.getByText('This product is not available.')).toBeVisible();
});

test('the phone layout has no sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const url of ['/', '/products', '/products/raspberry-pi-5-8-gb', '/kits', '/setup-builder', '/categories', '/login']) {
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `sideways scroll on ${url}`).toBeLessThanOrEqual(0);
  }
  await page.goto('/products');
  await page.getByRole('button', { name: /Filters/ }).click();
  await expect(page.getByRole('checkbox', { name: /Laptops/ })).toBeVisible();
  await page.getByRole('button', { name: 'Close filters' }).click();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Project Kits' })).toBeVisible();
});
