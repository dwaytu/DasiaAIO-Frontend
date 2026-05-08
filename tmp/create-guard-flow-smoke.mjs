import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173';
const outputDir = path.resolve('output/playwright/create-guard-flow');
fs.mkdirSync(outputDir, { recursive: true });

const roles = [
  { role: 'superadmin', email: 'superadmin.smoke@sentinel.dev', password: 'Sentinel!234', shouldCreate: true },
  { role: 'admin', email: 'admin.smoke@sentinel.dev', password: 'Sentinel!234', shouldCreate: true },
  { role: 'supervisor', email: 'supervisor.smoke@sentinel.dev', password: 'Sentinel!234', shouldCreate: true },
  { role: 'guard', email: 'guard.smoke@sentinel.dev', password: 'Sentinel!234', shouldCreate: false }
];

async function login(page, creds) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('#identifier', creds.email);
  await page.fill('#password', creds.password);
  await page.click('button:has-text("Login")');
  await page.waitForTimeout(1500);

  const err = await page.locator('.soc-auth-alert-error').first().textContent().catch(() => null);
  if (err && err.trim()) throw new Error(`login failed: ${err.trim()}`);

  const terms = page.locator('label:has-text("I have read and agree to the Terms of Agreement.")').first();
  if (await terms.count()) await terms.click({ timeout: 3000 });
  const location = page.locator('label:has-text("I consent to location processing for live guard and mission tracking.")').first();
  if (await location.count()) await location.click({ timeout: 3000 });
  const agree = page.locator('button:has-text("Agree and Continue")').first();
  if (await agree.count()) {
    await agree.click({ timeout: 5000 });
    await page.waitForTimeout(1300);
  }
}

async function runRole(browser, roleCfg) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });
  const page = await context.newPage();
  const apiCalls = [];
  page.on('response', (resp) => {
    const url = resp.url();
    if (url.includes('/api/users')) apiCalls.push({ url, status: resp.status(), method: resp.request().method() });
  });

  const result = { role: roleCfg.role, loginOk: false, buttonVisible: false, createAttempted: false, createStatus: null, passed: false, apiCalls: [] };

  try {
    await login(page, roleCfg);
    result.loginOk = true;

    const createBtn = page.locator('button:has-text("Create Guard Account")').first();
    result.buttonVisible = await createBtn.isVisible().catch(() => false);

    if (roleCfg.shouldCreate) {
      if (!result.buttonVisible) throw new Error('Create Guard Account button not visible');
      await createBtn.click({ timeout: 5000 });
      await page.waitForTimeout(400);

      const form = page.locator('form:has-text("Use MDR roster details to create a login-ready guard account")').first();
      if (!(await form.isVisible())) throw new Error('Create Guard Account modal form not visible');

      const uniq = `${roleCfg.role}_${Date.now()}`;
      await form.locator('input[type="text"]').nth(0).fill(`Smoke Guard ${uniq}`);
      await form.locator('input[type="text"]').nth(1).fill(`G-${Date.now()}`);
      await form.locator('input[type="text"]').nth(2).fill(`guard_${uniq}`);
      await form.locator('input[type="email"]').first().fill(`${uniq}@sentinel.local`);
      await form.locator('input[type="password"]').first().fill('Passw0rd!234');
      await form.locator('input[type="text"]').nth(3).fill('09171234567');
      await form.locator('input[type="text"]').nth(4).fill(`LIC-${Date.now()}`);
      await form.locator('input[type="date"]').nth(0).fill('2024-01-01');
      await form.locator('input[type="date"]').nth(1).fill('2030-01-01');
      await form.locator('input[type="text"]').nth(5).fill('Davao City');

      result.createAttempted = true;
      await form.locator('button[type="submit"]:has-text("Create Guard Account")').click({ timeout: 5000 });
      await page.waitForTimeout(1800);

      const postCall = [...apiCalls].reverse().find((c) => c.method === 'POST' && c.url.includes('/api/users'));
      result.createStatus = postCall ? postCall.status : null;
      result.passed = result.createStatus === 201;
    } else {
      result.passed = result.buttonVisible === false;
    }

    await page.screenshot({ path: path.join(outputDir, `${roleCfg.role}.png`), fullPage: true });
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
  }

  result.apiCalls = apiCalls;
  await context.close();
  return result;
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const role of roles) results.push(await runRole(browser, role));
await browser.close();

const report = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, results };
const reportPath = path.join(outputDir, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Wrote ${reportPath}`);
console.log(JSON.stringify(report, null, 2));

if (results.some((r) => !r.passed)) process.exitCode = 1;
