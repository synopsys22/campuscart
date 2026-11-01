import { test as base, expect } from '@playwright/test';

/** Fails any test where the page throws, or logs an error that isn't an expected HTTP rejection. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', (error) => problems.push(`Page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      // The browser logs every 4xx response. Tests provoke those on purpose, and assert the result.
      if (message.text().startsWith('Failed to load resource')) return;
      problems.push(`Console error: ${message.text()}`);
    });
    await use(page);
    expect(problems, 'the browser reported errors').toEqual([]);
  },
});

export { expect };

export async function logInAs(page, role) {
  await page.goto('/login');
  await page.getByRole('button', { name: `Log in as ${role}` }).click();
  await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible();
}

export async function logOut(page) {
  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
}

let counter = 0;

export async function registerNewStudent(page) {
  counter += 1;
  const email = `e2e${Date.now()}${counter}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Test Student');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Password@1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('button', { name: /Account menu/ })).toBeVisible();
  return email;
}

export async function addFromProductPage(page, slug) {
  await page.goto(`/products/${slug}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText(/^Added .* to your cart$/).first()).toBeVisible();
}

/** Completes checkout from the cart. Adds an address if the account has none. */
export async function checkOut(page, paymentLabel = 'Cash on Delivery') {
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Go to checkout' }).click();
  await expect(page.getByRole('heading', { name: 'Where should we deliver?' })).toBeVisible();

  const line1 = page.getByLabel('Address line 1');
  if (await line1.isVisible()) {
    await line1.fill('Room 101, North Hostel');
    await page.getByLabel('City').fill('Chennai');
    await page.getByLabel('State').fill('Tamil Nadu');
    await page.getByLabel('Pincode').fill('600001');
    await page.getByRole('button', { name: 'Save address' }).click();
  }
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.getByText(paymentLabel, { exact: true }).click();
  await page.getByRole('button', { name: 'Review order' }).click();
  await page.getByRole('button', { name: /^Place order/ }).click();
  await expect(page.getByRole('heading', { name: 'Your order is placed' })).toBeVisible();
  return page.locator('.success p.mono').first().innerText();
}

export async function stockOf(request, slug) {
  const response = await request.get(`/api/products/${slug}`);
  return (await response.json()).data.stock;
}
