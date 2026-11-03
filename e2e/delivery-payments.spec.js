import {
  addFromProductPage,
  checkOut,
  expect,
  logInAs,
  logOut,
  payByTestCard,
  registerNewStudent,
  test,
  tokenOf,
  walletBalance,
} from './support.js';

test('campus pickup paid by scanning the UPI QR code on a phone, then tracked publicly', async ({ page, browser, baseURL, request }) => {
  const email = await registerNewStudent(page);
  await addFromProductPage(page, 'gel-pen-set-10-pack');
  await page.goto('/checkout');

  // Each delivery method updates the summary with its own fee.
  await page.getByRole('radio', { name: /Express delivery/ }).check();
  await expect(page.locator('.summary-rows > div', { hasText: 'Express delivery' })).toContainText('₹99');
  await page.getByRole('radio', { name: /Campus pickup/ }).check();
  await expect(page.locator('.summary-rows > div', { hasText: 'Campus pickup' })).toContainText('Free');
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  await page.getByRole('radio', { name: /Central Library entrance/ }).check();
  await page.getByText('2 PM to 4 PM').click();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.getByText('UPI (demo)', { exact: true }).click();
  await page.getByRole('button', { name: 'Review order' }).click();
  await expect(page.getByText('Central Library entrance, 2 PM to 4 PM')).toBeVisible();

  const opened = page.waitForResponse((response) => response.url().endsWith('/api/payments') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /^Pay ₹/ }).click();
  const { data: payment } = await (await opened).json();
  await expect(page.getByRole('img', { name: 'QR code for this demo payment' })).toBeVisible();

  // The phone has no CampusCart login. The token inside the QR code is enough.
  const phone = await browser.newContext({ baseURL, viewport: { width: 390, height: 780 } });
  const phonePage = await phone.newPage();
  await phonePage.goto(`/pay/${payment._id}?token=${payment.approvalToken}`);
  await phonePage.getByRole('button', { name: /^Approve ₹/ }).click();
  await expect(phonePage.getByRole('heading', { name: 'Payment approved' })).toBeVisible();

  // The laptop notices by itself and places the order.
  await expect(page.getByRole('heading', { name: 'Your order is placed' })).toBeVisible();
  await expect(page.getByText(/Ready to collect at Central Library entrance/)).toBeVisible();
  const orderNumber = await page.locator('.success p.mono').first().innerText();
  await logOut(page);

  await logInAs(page, 'Admin');
  await page.goto('/admin/orders');
  await page.getByLabel('Search orders').fill(orderNumber);
  await page.getByRole('link', { name: orderNumber }).click();
  await page.getByRole('button', { name: 'Mark as Confirmed' }).click();
  await expect(page.getByText('Marked as Confirmed')).toBeVisible();
  await page.getByRole('button', { name: 'Mark as Shipped' }).click();
  await expect(page.getByText('Marked as Shipped')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark as ready for pickup' })).toBeVisible();
  const trackingNumber = await page.getByText(/^CCT\d{10}$/).innerText();

  // Anyone with the number can follow it, without logging in, and sees no personal details.
  await phonePage.goto('/track');
  await phonePage.getByLabel('Tracking number').fill(trackingNumber.toLowerCase());
  await phonePage.getByRole('button', { name: 'Track' }).click();
  await expect(phonePage.getByRole('heading', { name: trackingNumber })).toBeVisible();
  await expect(phonePage.getByText('On its way to the pickup point').first()).toBeVisible();
  await expect(phonePage.getByText('Central Library entrance').first()).toBeVisible();
  await expect(phonePage.getByText(email)).toHaveCount(0);
  const overflow = await phonePage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'sideways scroll on the phone tracking page').toBeLessThanOrEqual(0);
  await phone.close();

  const missing = await request.get('/api/track/CCT0000000000');
  expect(missing.status()).toBe(404);
});

test('a declined card fails cleanly, a real card is refused, and a wrong OTP is explained', async ({ page }) => {
  const email = await registerNewStudent(page);
  await addFromProductPage(page, 'null-pointer-coffee-mug');
  await page.goto('/checkout');
  await page.getByLabel('Address line 1').fill('Room 9, East Hostel');
  await page.getByLabel('City').fill('Chennai');
  await page.getByLabel('State').fill('Tamil Nadu');
  await page.getByLabel('Pincode').fill('600025');
  await page.getByRole('button', { name: 'Save address' }).click();
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  await page.getByText('Card (demo)', { exact: true }).click();
  await page.getByRole('button', { name: 'Review order' }).click();
  await page.getByRole('button', { name: /^Pay ₹/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Pay by card' });
  await dialog.locator('li', { hasText: 'declined by the bank' }).getByRole('button', { name: 'Use' }).click();
  await dialog.getByRole('button', { name: /^Pay ₹/ }).click();
  await expect(dialog.getByText('Payment failed')).toBeVisible();
  await expect(dialog.getByText('Declined by the bank. No money was taken.')).toBeVisible();

  await dialog.getByRole('button', { name: 'Try again' }).click();
  // A real-looking card never leaves the browser.
  await dialog.getByLabel('Card number').fill('4012 8888 8888 1881');
  await dialog.getByLabel('Expiry (MM/YY)').fill('1230');
  await dialog.getByLabel('CVV').fill('123');
  await dialog.getByRole('button', { name: /^Pay ₹/ }).click();
  await expect(dialog.getByText('Use one of the test cards below. Never enter a real card here.')).toBeVisible();

  await dialog.getByRole('button', { name: 'Use' }).first().click();
  await expect(dialog.getByText('Visa', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: /^Pay ₹/ }).click();
  await dialog.getByLabel('One-time password (OTP)').fill('000000');
  await dialog.getByRole('button', { name: 'Verify and pay' }).click();
  await expect(dialog.getByText('That OTP is wrong. 2 tries left.')).toBeVisible();
  await dialog.getByLabel('One-time password (OTP)').fill('123456');
  await dialog.getByRole('button', { name: 'Verify and pay' }).click();
  await expect(page.getByRole('heading', { name: 'Your order is placed' })).toBeVisible();
  await expect(page.getByText(/paid by Card \(demo\) \(Visa ending 1111\)/)).toBeVisible();
  await logOut(page);

  // The admin sees the failed attempt next to the one that went through.
  await logInAs(page, 'Admin');
  await page.goto('/admin/payments');
  await page.getByLabel('Search payments').fill(email);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: 'Succeeded' })).toContainText('Visa ending 1111');
  await expect(rows.filter({ hasText: 'Failed' })).toContainText('Declined by the bank');
});

test('the wallet: add money by card, pay with it, cancel, and get the money back', async ({ page, request }) => {
  await registerNewStudent(page);
  const token = await tokenOf(page);
  await page.goto('/account/wallet');
  await expect(page.getByTestId('wallet-balance')).toHaveText('₹0');
  await page.getByRole('button', { name: '₹2,000' }).click();
  await page.getByRole('group', { name: 'Pay with' }).getByRole('button', { name: 'Card' }).click();
  await page.getByRole('button', { name: 'Add ₹2,000' }).click();
  await payByTestCard(page);
  await expect(page.getByText('Added ₹2,000 to your wallet')).toBeVisible();
  await expect(page.getByTestId('wallet-balance')).toHaveText('₹2,000');
  await expect(page.getByRole('cell', { name: /Added money by card/ })).toBeVisible();

  await addFromProductPage(page, 'null-pointer-coffee-mug');
  const orderNumber = await checkOut(page, 'CampusCart Wallet');
  expect(orderNumber).toMatch(/^CC-\d{4}-\d{6}$/);
  const afterPaying = await walletBalance(request, token);
  expect(afterPaying).toBeLessThan(2000);

  await page.getByRole('link', { name: 'Track this order' }).click();
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await expect(page.getByRole('dialog').getByText(/goes back to your CampusCart wallet/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();
  await expect(page.getByText('refunded to your CampusCart wallet', { exact: false })).toBeVisible();
  expect(await walletBalance(request, token)).toBe(2000);

  await page.goto('/account/wallet');
  await expect(page.getByRole('link', { name: `Refund for order ${orderNumber}` })).toBeVisible();
  await expect(page.getByRole('link', { name: `Paid for order ${orderNumber}` })).toBeVisible();
});

test('the demo student returns a recent order and the admin refunds it to the wallet', async ({ page, request }) => {
  await logInAs(page, 'Student');
  const token = await tokenOf(page);
  const headers = { Authorization: `Bearer ${token}` };
  const mine = await (await request.get('/api/orders/my?status=Delivered&limit=50', { headers })).json();
  const order = mine.data.find((entry) => entry.items.some((item) => item.name === 'Logitech K380 Wireless Keyboard'));
  const before = await walletBalance(request, token);

  await page.goto(`/account/orders/${order._id}`);
  await page.getByRole('button', { name: 'Return this order' }).click();
  const dialog = page.getByRole('dialog', { name: 'Return this order' });
  await expect(dialog.getByRole('button', { name: 'Request return' })).toBeDisabled();
  await dialog.getByLabel('Why are you returning it?').selectOption('Damaged or not working');
  await dialog.getByLabel('Anything else? (optional)').fill('Two keys stopped working.');
  await dialog.getByRole('button', { name: 'Request return' }).click();
  await expect(page.locator('#main').getByText('Return requested', { exact: true })).toBeVisible();
  await expect(page.getByText('We have your return request and will reply soon.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return this order' })).toHaveCount(0);
  await logOut(page);

  await logInAs(page, 'Admin');
  await page.goto('/admin');
  await page.getByRole('link', { name: /Returns to review/ }).click();
  await expect(page).toHaveURL(/return=Requested/);
  await page.getByRole('link', { name: order.orderNumber }).click();
  await expect(page.getByText('Two keys stopped working.')).toBeVisible();
  await page.getByRole('button', { name: 'Approve and refund' }).click();
  await expect(page.getByText('Return approved and refunded')).toBeVisible();
  await expect(page.locator('.row').getByText('Returned', { exact: true }).first()).toBeVisible();

  expect(await walletBalance(request, token)).toBe(before + order.total);
});

test('the product page checks delivery dates for a pincode', async ({ page }) => {
  await page.goto('/products/arduino-uno-r3');
  const pincode = page.getByLabel('Delivery pincode');
  await pincode.fill('900001');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText("We don't deliver to 900001 yet. Campus pickup is still available.")).toBeVisible();
  await pincode.fill('600001');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  const dates = page.getByRole('list', { name: 'Delivery to 600001' });
  await expect(dates).toContainText('Standard by');
  await expect(dates).toContainText('Express by');
  await expect(dates).toContainText('Campus pickup from');
});
