// Captures the screenshots used in the README, report and slides.
// With the app running: node e2e/screenshots.js [base URL] [output folder]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const baseURL = process.argv[2] ?? 'http://localhost:5000';
const outDir = path.resolve(process.argv[3] ?? 'docs/screenshots');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function open(theme, width = 1440, height = 900) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme,
    // The hero traces appear straight away, rather than being caught mid-draw.
    reducedMotion: 'reduce',
  });
  return context.newPage();
}

async function shot(page, name, url) {
  if (url) await page.goto(baseURL + url);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
}

async function logIn(page, role) {
  await page.goto(`${baseURL}/login`);
  await page.getByRole('button', { name: `Log in as ${role}` }).click();
  await page.getByRole('button', { name: /Account menu/ }).waitFor();
}

const dark = await open('dark');
await shot(dark, 'home-dark', '/');
await shot(dark, 'product-dark', '/products/raspberry-pi-5-8-gb');
await shot(dark, 'kit-detail-dark', '/kits/iot-starter-kit');
await shot(dark, 'setup-builder-dark', '/setup-builder');

await logIn(dark, 'Student');
await dark.goto(`${baseURL}/kits/hackathon-survival-kit`);
await dark.getByRole('button', { name: 'Add all to cart' }).click();
await dark.getByRole('link', { name: 'Cart, 5 items' }).waitFor();
await shot(dark, 'cart-dark', '/cart');

await dark.goto(`${baseURL}/account/orders`);
await dark.getByRole('button', { name: 'Shipped', exact: true }).click();
await dark.locator('.order-row').first().click();
await dark.locator('.timeline').waitFor();
await shot(dark, 'order-tracking-dark');

await dark.getByRole('button', { name: /Account menu/ }).click();
await dark.getByRole('button', { name: 'Log out' }).click();
await logIn(dark, 'Admin');
await shot(dark, 'admin-dashboard-dark', '/admin');

const light = await open('light');
await shot(light, 'catalog-light', '/products');
await logIn(light, 'Admin');
await shot(light, 'admin-orders-light', '/admin/orders');

const phone = await open('dark', 390, 844);
await shot(phone, 'home-phone', '/');

await browser.close();
console.log(`Saved screenshots to ${outDir}`);
