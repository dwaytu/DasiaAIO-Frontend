import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE_URL = "http://localhost:5173";
const OUTPUT_DIR = path.resolve("output/playwright/local-smoke-fast");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const creds = { identifier: "superadmin.smoke@sentinel.dev", password: "Sentinel!234" };

async function loginAndConsent(page, evidence) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill("#identifier", creds.identifier);
  await page.fill("#password", creds.password);
  await page.click('button:has-text("Login")');
  await page.waitForTimeout(1600);

  const err = await page.locator('.soc-auth-alert-error').first().textContent().catch(() => null);
  if (err && err.trim()) throw new Error(`login failed: ${err.trim()}`);

  const termsLabel = page.locator('label:has-text("I have read and agree to the Terms of Agreement.")').first();
  const locationLabel = page.locator('label:has-text("I consent to location processing for live guard and mission tracking.")').first();

  if (await termsLabel.count()) {
    await termsLabel.click({ timeout: 3000 });
    evidence.push('checked:consent:terms');
  }
  if (await locationLabel.count()) {
    await locationLabel.click({ timeout: 3000 });
    evidence.push('checked:consent:location');
  }

  const agreeBtn = page.locator('button:has-text("Agree and Continue")').first();
  if (await agreeBtn.count()) {
    await agreeBtn.click({ timeout: 5000 });
    evidence.push('clicked:Agree and Continue');
    await page.waitForTimeout(1800);
  }
}

async function clickIfVisible(page, selector, evidence, tag) {
  const el = page.locator(selector).first();
  if (!(await el.count())) return false;
  if (!(await el.isVisible())) return false;
  try { await el.scrollIntoViewIfNeeded(); } catch {}
  try {
    await el.click({ timeout: 3000, force: true });
    evidence.push(tag);
    await page.waitForTimeout(350);
    return true;
  } catch {
    return false;
  }
}

async function runWebDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });
  const page = await context.newPage();
  const evidence = [];
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await loginAndConsent(page, evidence);

  const labels = ['Dashboard','Users','Approvals','Schedule','Alerts','Analytics','Tracking','Trips','Armored Car','Firearm','Permits','Maintenance','Settings','Feedback'];
  for (const label of labels) {
    await clickIfVisible(page, `button:has-text("${label}")`, evidence, `clicked:${label}`);
    await clickIfVisible(page, `a:has-text("${label}")`, evidence, `clicked:${label}`);
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'web-desktop-superadmin.png'), fullPage: true });
  await context.close();
  return { mode: 'web-desktop', ok: true, clicks: evidence.length, evidence, consoleErrors };
}

async function runAndroidLike(browser) {
  const context = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await context.newPage();
  const evidence = [];
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await loginAndConsent(page, evidence);

  await clickIfVisible(page, 'button:has-text("Dismiss")', evidence, 'mobile-dismiss-location-banner');

  const tabs = ['Dashboard','Approvals','Schedule','Alerts','More'];
  for (const tab of tabs) {
    await clickIfVisible(page, `nav[aria-label="Mobile navigation"] button:has-text("${tab}")`, evidence, `mobile-tab:${tab}`);
  }

  await clickIfVisible(page, 'nav[aria-label="Mobile navigation"] button:has-text("More")', evidence, 'mobile-more-open');
  const drawerItems = ['Profile','Settings','Feedback','Tracking','Trips'];
  for (const item of drawerItems) {
    await clickIfVisible(page, `#operational-more-drawer button:has-text("${item}")`, evidence, `mobile-more:${item}`);
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, 'android-mobile-webview-superadmin.png'), fullPage: true });
  await context.close();
  return { mode: 'android-mobile-webview', ok: true, clicks: evidence.length, evidence, consoleErrors };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    results.push(await runWebDesktop(browser));
    results.push(await runAndroidLike(browser));
  } finally {
    await browser.close();
  }

  const report = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, role: 'superadmin', results };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
  console.log('Smoke report written:', path.join(OUTPUT_DIR, 'report.json'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
