/**
 * Captures the screenshots used in the README and the PDF documentation.
 *
 * Prerequisites:
 *   - PostgreSQL + Redis running (docker compose up -d db redis)
 *   - API running on :4000 (npm run dev:server)
 *   - Vite running on :5173 (npm run dev:client)
 *
 * Run: npm run screenshots
 * Uses the locally installed Microsoft Edge through playwright-core.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BASE_URL = 'http://localhost:5173';
const OUT_DIR = path.resolve('docs/screenshots');

async function waitForServer(url, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Server did not become ready: ${url}`);
}

async function shot(page, name, { fullPage = false } = {}) {
  await page.waitForTimeout(450);
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(`saved ${path.relative(process.cwd(), file)}`);
}

async function loginAsDemoPatient(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Demo patient' }).click();
  await page.waitForURL(`${BASE_URL}/`);
  await page.waitForSelector('.slot-card');
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await waitForServer(BASE_URL);

  const browser = await chromium.launch({
    executablePath: EDGE_PATH,
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 920 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  // Auth screens
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await shot(page, '01-login');

  await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });
  await shot(page, '02-register');

  // Dashboard
  await loginAsDemoPatient(page);
  await shot(page, '03-dashboard');

  // Add-reading modal, first with a validation error
  const emptySlot = page.locator('.slot-card.is-empty').first();
  if ((await page.locator('.slot-card.is-empty').count()) > 0) {
    await emptySlot.getByRole('button', { name: /add reading/i }).click();
  } else {
    await page.getByRole('button', { name: /edit/i }).first().click();
  }

  await page.locator('#reading-value').fill('30');
  await page.locator('form.reading-form button[type="submit"]').click();
  await page.getByRole('alert').waitFor();
  await shot(page, '04-reading-validation');

  await page.locator('#reading-value').fill('136');
  await page.locator('form.reading-form button[type="submit"]').click();
  await page.getByRole('status').waitFor({ state: 'visible' }).catch(() => {});
  await page.locator('.modal').waitFor({ state: 'detached' });
  await shot(page, '05-dashboard-after-add');

  // Reports
  await page.getByRole('link', { name: /reports/i }).click();
  await page.waitForSelector('.report-range');
  await shot(page, '06-reports-daily', { fullPage: true });

  await page.getByRole('tab', { name: 'Month to date' }).click();
  await page.waitForTimeout(1000);
  await shot(page, '07-reports-month-to-date', { fullPage: true });

  await page.getByRole('tab', { name: 'Monthly' }).click();
  await page.waitForTimeout(1000);
  await shot(page, '08-reports-monthly', { fullPage: true });

  // Doctor workspace
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Demo doctor' }).click();
  await page.waitForURL(`${BASE_URL}/patients`);
  await page.waitForSelector('.patient-button');
  await shot(page, '09-doctor-patients', { fullPage: true });

  // Mobile dashboard
  await page.evaluate(() => localStorage.clear());
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mobilePage = await mobile.newPage();
  await loginAsDemoPatient(mobilePage);
  await shot(mobilePage, '10-dashboard-mobile');

  await mobile.close();
  await context.close();
  await browser.close();
  console.log('\nAll screenshots captured.');
}

main().catch((error) => {
  console.error('Screenshot capture failed:', error);
  process.exitCode = 1;
});
