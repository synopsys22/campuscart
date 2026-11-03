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

/** Pays in the demo gateway window with the first successful test card and the demo OTP. */
export async function payByTestCard(page) {
  const dialog = page.getByRole('dialog', { name: 'Pay by card' });
  await dialog.getByRole('button', { name: 'Use' }).first().click();
  await dialog.getByRole('button', { name: /^Pay ₹/ }).click();
  await dialog.getByLabel('One-time password (OTP)').fill('123456');
  await dialog.getByRole('button', { name: 'Verify and pay' }).click();
}

/** Pays in the demo gateway window by approving the UPI QR code on the same device. */
export async function payByUpiQr(page) {
  const dialog = page.getByRole('dialog', { name: 'Pay by UPI' });
  await dialog.getByRole('button', { name: 'No phone handy? Approve on this device' }).click();
}

/**
 * Completes checkout from the cart. Adds an address if the account has none, then pays
 * the way a student would: through the gateway window for card and UPI.
 */
export async function checkOut(page, paymentLabel = 'Cash on Delivery', { delivery = 'Standard delivery' } = {}) {
  await page.goto('/cart');
  await page.getByRole('button', { name: 'Go to checkout' }).click();
  await expect(page.getByRole('heading', { name: 'How should we get it to you?' })).toBeVisible();
  await page.getByRole('radio', { name: new RegExp(delivery) }).check();

  if (delivery === 'Campus pickup') {
    await page.getByRole('radio', { name: /Central Library entrance/ }).check();
    await page.getByText('2 PM to 4 PM').click();
  } else {
    const line1 = page.getByLabel('Address line 1');
    if (await line1.isVisible()) {
      await line1.fill('Room 101, North Hostel');
      await page.getByLabel('City').fill('Chennai');
      await page.getByLabel('State').fill('Tamil Nadu');
      await page.getByLabel('Pincode').fill('600001');
      await page.getByRole('button', { name: 'Save address' }).click();
    }
  }
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.getByText(paymentLabel, { exact: true }).click();
  await page.getByRole('button', { name: 'Review order' }).click();

  if (paymentLabel === 'Card (demo)') {
    await page.getByRole('button', { name: /^Pay ₹/ }).click();
    await payByTestCard(page);
  } else if (paymentLabel === 'UPI (demo)') {
    await page.getByRole('button', { name: /^Pay ₹/ }).click();
    await payByUpiQr(page);
  } else {
    await page.getByRole('button', { name: /^Place order/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your order is placed' })).toBeVisible();
  return page.locator('.success p.mono').first().innerText();
}

/** Reads the delivery code the way the customer would, from their own order page data. */
export async function deliveryCodeFor(request, token, orderNumber) {
  const headers = { Authorization: `Bearer ${token}` };
  const mine = await (await request.get('/api/orders/my?limit=50', { headers })).json();
  const order = mine.data.find((entry) => entry.orderNumber === orderNumber);
  const detail = await (await request.get(`/api/orders/${order._id}`, { headers })).json();
  return detail.data.delivery.code;
}

export async function walletBalance(request, token) {
  const response = await request.get('/api/wallet', { headers: { Authorization: `Bearer ${token}` } });
  return (await response.json()).summary.balance;
}

export const tokenOf = (page) => page.evaluate(() => localStorage.getItem('campuscart-token'));

export async function stockOf(request, slug) {
  const response = await request.get(`/api/products/${slug}`);
  return (await response.json()).data.stock;
}
