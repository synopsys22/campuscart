import { addFromProductPage, checkOut, expect, logInAs, logOut, registerNewStudent, stockOf, test } from './support.js';

test('a new student searches, filters, uses a coupon and places an order', async ({ page, request }) => {
  await registerNewStudent(page);

  // Quick search finds a product from a partial word.
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Search products and pages' }).fill('raspb');
  await page.getByRole('option', { name: /Raspberry Pi 5/ }).click();
  await expect(page.getByRole('heading', { name: 'Raspberry Pi 5 (8 GB)' })).toBeVisible();

  // Filters narrow the catalog and stay in the URL.
  await page.goto('/products');
  await page.getByRole('checkbox', { name: /CS Textbooks/ }).click();
  await expect(page).toHaveURL(/category=cs-textbooks/);
  await expect(page.getByRole('checkbox', { name: /CS Textbooks/ })).toBeChecked();
  await expect(page.getByRole('heading', { name: 'CS Textbooks' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(8);
  await page.getByLabel('Sort by').selectOption('price_asc');
  await expect(page.getByRole('article').first()).toContainText('Clean Code');

  const stockBefore = await stockOf(request, 'clean-code');
  await page.getByRole('link', { name: 'Clean Code' }).click();
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('link', { name: 'Cart, 2 items' })).toBeVisible();

  // ₹649 × 2 = ₹1,298, with free shipping.
  await page.goto('/cart');
  await expect(page.getByTestId('order-total')).toHaveText('₹1,298');

  // An expired coupon explains why, and a good one reduces the total.
  await page.getByLabel('Coupon code').fill('EXPIRED20');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByText('This coupon has expired.')).toBeVisible();
  await page.getByLabel('Coupon code').fill('student10');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByTestId('order-total')).toHaveText('₹1,169');

  const orderNumber = await checkOut(page, 'UPI (demo)');
  expect(orderNumber).toMatch(/^CC-\d{4}-\d{6}$/);
  expect(await stockOf(request, 'clean-code')).toBe(stockBefore - 2);
  await expect(page.getByRole('link', { name: 'Cart, 0 items' })).toBeVisible();

  await page.getByRole('link', { name: 'Track this order' }).click();
  await expect(page.getByRole('heading', { name: orderNumber })).toBeVisible();
  await expect(page.getByText('Paid').first()).toBeVisible();
});

test('an order moves through admin updates to a verified review', async ({ page }) => {
  await registerNewStudent(page);
  await addFromProductPage(page, 'gel-pen-set-10-pack');
  const orderNumber = await checkOut(page);

  // A review isn't allowed before delivery.
  await page.goto('/products/gel-pen-set-10-pack');
  await expect(page.getByText('You can review this after your order is delivered.')).toBeVisible();

  const studentToken = await page.evaluate(() => localStorage.getItem('campuscart-token'));
  await logOut(page);

  await logInAs(page, 'Admin');
  await page.goto('/admin/orders');
  await page.getByLabel('Search orders').fill(orderNumber);
  await page.getByRole('link', { name: orderNumber }).click();
  for (const status of ['Confirmed', 'Shipped', 'Delivered']) {
    await page.getByRole('button', { name: `Mark as ${status}` }).click();
    await expect(page.getByText(`Marked as ${status}`)).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /Mark as/ })).toHaveCount(0);
  await logOut(page);

  // Back as the student, through the same session token.
  await page.evaluate((token) => localStorage.setItem('campuscart-token', token), studentToken);
  await page.goto('/account/orders');
  await page.getByRole('link', { name: new RegExp(orderNumber) }).click();
  await expect(page.locator('.timeline .timeline-done')).toHaveCount(4);

  await page.getByRole('link', { name: 'Review this product' }).click();
  await expect(page.getByRole('heading', { name: 'Write a review' })).toBeVisible();
  await page.getByText('4', { exact: true }).filter({ visible: true }).first().click();
  await page.getByLabel('Title').fill('Smooth writing pens');
  await page.getByLabel('Your review').fill('These lasted through all of my end-semester exams.');
  await page.getByRole('button', { name: 'Post review' }).click();
  await expect(page.getByText('Review posted')).toBeVisible();

  const posted = page.getByRole('article').filter({ hasText: 'Smooth writing pens' });
  await expect(posted).toBeVisible();
  await expect(posted.getByText('Verified purchase')).toBeVisible();
  await expect(page.getByText('You have reviewed this product.')).toBeVisible();
});

test('cancelling an order gives the stock back', async ({ page, request }) => {
  await registerNewStudent(page);
  const before = await stockOf(request, 'null-pointer-coffee-mug');
  await addFromProductPage(page, 'null-pointer-coffee-mug');
  const orderNumber = await checkOut(page, 'Card (demo)');
  expect(await stockOf(request, 'null-pointer-coffee-mug')).toBe(before - 1);

  await page.goto('/account/orders');
  await page.getByRole('link', { name: new RegExp(orderNumber) }).click();
  await page.getByRole('button', { name: 'Cancel order' }).click();
  await page.getByRole('dialog').getByLabel('Reason (optional)').fill('Ordered by mistake');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();

  await expect(page.getByText(`Cancelled ${orderNumber}`)).toBeVisible();
  await expect(page.getByText('Ordered by mistake').first()).toBeVisible();
  await expect(page.getByText('Refunded')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
  expect(await stockOf(request, 'null-pointer-coffee-mug')).toBe(before);
});

test('kits, the setup builder and compare all work', async ({ page }) => {
  await registerNewStudent(page);

  await page.goto('/kits/hackathon-survival-kit');
  await page.getByRole('button', { name: 'Add all to cart' }).click();
  await expect(page.getByText('Added 5 items to your cart')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Cart, 5 items' })).toBeVisible();

  await page.goto('/setup-builder');
  await page.getByLabel('Budget (₹, optional)').fill('2000');
  await page.getByRole('radio', { name: /Logitech M331 Silent Mouse/ }).click();
  await expect(page.getByTestId('setup-total')).toHaveText('₹899');
  await expect(page.getByText('₹1,101 left in your budget')).toBeVisible();
  await page.getByRole('radio', { name: /Logitech K380 Wireless Keyboard/ }).click();
  await expect(page.getByTestId('setup-total')).toHaveText('₹3,394');
  await expect(page.getByText('₹1,394 over budget')).toBeVisible();
  await page.getByLabel('Build name').fill('Library kit');
  await page.getByRole('button', { name: 'Save build' }).click();
  await expect(page.getByText('Saved Library kit')).toBeVisible();

  await page.goto('/account/setups');
  await expect(page.getByText('Library kit')).toBeVisible();
  await page.getByRole('link', { name: 'Open' }).click();
  await expect(page.getByTestId('setup-total')).toHaveText('₹3,394');
  await page.getByRole('button', { name: 'Add all to cart' }).click();
  await expect(page.getByRole('link', { name: 'Cart, 7 items' })).toBeVisible();

  await page.goto('/products?category=dev-hardware&sort=price_asc');
  await page.getByRole('button', { name: 'Add to compare: ESP32 Dev Board' }).click();
  await page.getByRole('button', { name: 'Add to compare: Arduino Uno R3' }).click();
  await page.getByRole('complementary', { name: 'Products to compare' }).getByRole('link', { name: 'Compare' }).click();
  const table = page.getByRole('table');
  await expect(table.getByText('ESP32 Dev Board')).toBeVisible();
  await expect(table.getByText('Arduino Uno R3')).toBeVisible();
  await expect(table.getByText('Lowest price')).toBeVisible();
  await page.getByLabel('Show differences only').check();
  await expect(table.getByRole('rowheader', { name: 'CPU' })).toBeVisible();
  await page.getByRole('button', { name: 'Remove ESP32 Dev Board' }).click();
  await expect(table.getByText('ESP32 Dev Board')).toHaveCount(0);
});

test('wishlist, addresses and profile save correctly', async ({ page }) => {
  await registerNewStudent(page);

  await page.goto('/products/arduino-uno-r3');
  await page.getByRole('button', { name: 'Save to wishlist' }).click();
  await expect(page.getByText('Saved Arduino Uno R3 to your wishlist')).toBeVisible();
  await page.goto('/wishlist');
  await expect(page.getByRole('heading', { name: 'Arduino Uno R3' })).toBeVisible();

  await page.goto('/account');
  await page.getByLabel('College').fill('Anna University');
  await page.getByLabel('Semester').selectOption('5');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.getByText('Profile saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('College')).toHaveValue('Anna University');

  await page.goto('/account/addresses');
  await page.getByRole('button', { name: 'Add address' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Address line 1').fill('12 Main Road');
  await dialog.getByLabel('City').fill('Madurai');
  await dialog.getByLabel('State').fill('Tamil Nadu');
  await dialog.getByLabel('Pincode').fill('12');
  await dialog.getByRole('button', { name: 'Save address' }).click();
  await expect(dialog.getByText('Enter a 6-digit pincode.')).toBeVisible();
  await dialog.getByLabel('Pincode').fill('625001');
  await dialog.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByText('Address saved')).toBeVisible();
  await expect(page.getByText(/12 Main Road/)).toBeVisible();
  await expect(page.getByText('Default', { exact: true })).toBeVisible();
});
