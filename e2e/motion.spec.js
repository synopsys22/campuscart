import { addFromProductPage, expect, logInAs, registerNewStudent, test } from './support.js';

const opacityOf = (locator) => locator.evaluate((element) => getComputedStyle(element).opacity);

test.describe('with animation on', () => {
  test('content further down the page appears when scrolled to', async ({ page }) => {
    await page.goto('/');
    const kit = page.locator('.kit').first();
    await kit.scrollIntoViewIfNeeded();
    await expect.poll(() => opacityOf(page.locator('.reveal').filter({ has: kit }).first())).toBe('1');
    await page.locator('.setup-band').scrollIntoViewIfNeeded();
    await expect.poll(() => opacityOf(page.locator('.reveal').filter({ has: page.locator('.setup-band') }).first())).toBe('1');
  });

  test('the navigation highlight follows the current page', async ({ page }) => {
    await page.goto('/kits');
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Project Kits' }).locator('.nav-pill')).toHaveCount(1);
    await nav.getByRole('link', { name: 'Categories' }).click();
    await expect(nav.getByRole('link', { name: 'Categories' }).locator('.nav-pill')).toHaveCount(1);
    await expect(nav.locator('.nav-pill')).toHaveCount(1);
  });

  test('adding to the cart confirms on the button, then returns to normal', async ({ page }) => {
    await registerNewStudent(page);
    await page.goto('/products');
    const card = page.locator('.bin-cell').first();
    await card.getByRole('button', { name: /^Add .* to cart$/ }).click();
    await expect(card.locator('.added-mark')).toBeVisible();
    await expect(card.locator('.added-mark')).toHaveCount(0, { timeout: 4000 });
  });

  test('a removed cart line leaves the list and the total settles on the exact figure', async ({ page }) => {
    await registerNewStudent(page);
    await addFromProductPage(page, 'clean-code');
    await addFromProductPage(page, 'arduino-uno-r3');
    await page.goto('/cart');
    await expect(page.locator('.line')).toHaveCount(2);
    await page.getByRole('button', { name: 'Remove Arduino Uno R3' }).click();
    await expect(page.locator('.line')).toHaveCount(1);
    await expect(page.getByTestId('order-total')).toHaveText('₹698');
  });

  test('dashboard figures count up to their exact value', async ({ page }) => {
    await logInAs(page, 'Admin');
    await page.goto('/admin');
    const orders = page.locator('.kpi').filter({ hasText: 'Orders' }).locator('dd');
    await expect(orders).toHaveText(/^[1-9]\d*$/);
    const settled = await orders.innerText();
    await page.waitForTimeout(1200);
    await expect(orders).toHaveText(settled);
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('nothing waits to be revealed', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.bin-cell').first()).toBeVisible();
    await expect(page.locator('.kit').first()).toBeVisible();
    for (const reveal of await page.locator('.reveal').all()) {
      expect(await opacityOf(reveal)).toBe('1');
    }
    expect(await page.locator('.hero animateMotion').count()).toBe(0);
  });
});

test('moving to a new page puts keyboard focus on the page content', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Project Kits' }).click();
  await expect(page).toHaveURL(/\/kits$/);
  await expect(page.locator('main')).toBeFocused();
});

test('applied filters are listed and can be removed one at a time', async ({ page }) => {
  await page.goto('/products?category=laptops&rating=4');
  const applied = page.getByRole('list', { name: 'Applied filters' });
  await applied.getByRole('button', { name: 'Remove filter: Laptops' }).click();
  await expect(page).toHaveURL(/rating=4/);
  await expect(page).not.toHaveURL(/category=/);
  await applied.getByRole('button', { name: 'Remove filter: 4 stars and up' }).click();
  await expect(page).not.toHaveURL(/rating=/);
  await expect(page.getByRole('list', { name: 'Applied filters' })).toHaveCount(0);
});

test('touch screens get buttons large enough to tap', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  await page.goto('http://localhost:5055/products');
  const wishlist = page.locator('.bin-tools .icon-btn').first();
  await expect(wishlist).toBeVisible();
  const box = await wishlist.boundingBox();
  // A phone's fractional scaling can report a 44px button as 43.99997px.
  expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
  await context.close();
});
