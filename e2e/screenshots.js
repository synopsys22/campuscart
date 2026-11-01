// Captures the app for review and for the project documents.
// Usage: node e2e/screenshots.js <output folder> [base URL]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const outDir = path.resolve(process.argv[2] ?? 'docs/screenshots');
const baseURL = process.argv[3] ?? 'http://localhost:5000';
fs.mkdirSync(outDir, { recursive: true });

const PUBLIC_PAGES = [
  ['home', '/'],
  ['catalog', '/products'],
  ['product', '/products/raspberry-pi-5-8-gb'],
  ['textbook', '/products/introduction-to-algorithms-clrs'],
  ['kits', '/kits'],
  ['kit-detail', '/kits/iot-starter-kit'],
  ['setup-builder', '/setup-builder?demo=1'],
  ['categories', '/categories'],
  ['login', '/login'],
];
const STUDENT_PAGES = [
  ['orders', '/account/orders'],
  ['wishlist', '/wishlist'],
  ['saved-builds', '/account/setups'],
];
const ADMIN_PAGES = [
  ['admin-dashboard', '/admin'],
  ['admin-orders', '/admin/orders'],
  ['admin-products', '/admin/products'],
  ['admin-inventory', '/admin/inventory?lowStock=true'],
  ['admin-coupons', '/admin/coupons'],
  ['admin-users', '/admin/users'],
];

async function login(page, role) {
  await page.goto(`${baseURL}/login`);
  await page.getByRole('button', { name: `Log in as ${role}` }).click();
  await page.getByRole('button', { name: /Account menu/ }).waitFor();
}

async function capture(page, name, url, { theme, width, fullPage = true }) {
  await page.goto(baseURL + url);
  await page.waitForLoadState('networkidle');
  const file = path.join(outDir, `${name}-${theme}-${width}.png`);
  await page.screenshot({ path: file, fullPage });
}

const browser = await chromium.launch();

for (const [theme, width] of [['dark', 1440], ['light', 1440], ['dark', 390]]) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: theme,
    // Full-page capture restarts CSS animations, which would hide the hero traces mid-draw.
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  for (const [name, url] of PUBLIC_PAGES) await capture(page, name, url, { theme, width });

  await login(page, 'Student');

  // A cart with real contents, then the demo student's order in transit.
  await page.goto(`${baseURL}/kits/hackathon-survival-kit`);
  await page.getByRole('button', { name: 'Add all to cart' }).click();
  await page.getByText(/Added \d+ items/).first().waitFor();
  await capture(page, 'cart', '/cart', { theme, width });
  await page.goto(`${baseURL}/cart`);
  await page.getByRole('button', { name: 'Clear cart' }).click();

  for (const [name, url] of STUDENT_PAGES) await capture(page, name, url, { theme, width });

  await page.goto(`${baseURL}/account/orders`);
  await page.getByRole('button', { name: 'Shipped', exact: true }).click();
  await page.locator('.order-row').first().click();
  await page.locator('.timeline').waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, `order-tracking-${theme}-${width}.png`), fullPage: true });

  await page.getByRole('button', { name: /Account menu/ }).click();
  await page.getByRole('button', { name: 'Log out' }).click();
  await login(page, 'Admin');
  for (const [name, url] of ADMIN_PAGES) await capture(page, name, url, { theme, width });

  await context.close();
  if (errors.length) console.error(`Page errors in ${theme} ${width}:`, errors);
}

await browser.close();
console.log(`Saved screenshots to ${outDir}`);
