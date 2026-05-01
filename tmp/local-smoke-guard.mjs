import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE_URL = "http://localhost:5173";
const OUTPUT_DIR = path.resolve("output/playwright/local-smoke-guard");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const creds = { identifier: "guard.smoke@sentinel.dev", password: "Sentinel!234" };

async function clickIfVisible(page, selector, evidence, tag) {
  const el = page.locator(selector).first();
  if (!(await el.count())) return false;
  if (!(await el.isVisible().catch(() => false))) return false;
  try { await el.scrollIntoViewIfNeeded(); } catch {}
  try {
    await el.click({ timeout: 2500, force: true });
    evidence.push(tag);
    await page.waitForTimeout(300);
    return true;
  } catch {
    return false;
  }
}

async function login(page, evidence) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill("#identifier", creds.identifier);
  await page.fill("#password", creds.password);
  await page.click('button:has-text("Login")');
  await page.waitForTimeout(1500);

  const terms = page.locator('label:has-text("I have read and agree to the Terms of Agreement.")').first();
  const location = page.locator('label:has-text("I consent to location processing for live guard and mission tracking.")').first();
  if (await terms.count()) {
    await terms.click({ timeout: 3000 });
    evidence.push("checked:consent:terms");
  }
  if (await location.count()) {
    await location.click({ timeout: 3000 });
    evidence.push("checked:consent:location");
  }
  const agree = page.locator('button:has-text("Agree and Continue")').first();
  if (await agree.count()) {
    await agree.click({ timeout: 5000 });
    evidence.push("clicked:agree-and-continue");
    await page.waitForTimeout(1600);
  }
}

async function runMode(browser, mode, contextOptions) {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  const evidence = [];
  const consoleErrors = [];

  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  await login(page, evidence);

  const selectors = [
    ['button:has-text("Enable Location")', 'guard:Enable Location'],
    ['button:has-text("Dismiss")', 'guard:Dismiss'],
    ['button:has-text("REPORT INCIDENT")', 'guard:REPORT INCIDENT'],
    ['button:has-text("View Instructions")', 'guard:View Instructions'],
    ['button:has-text("Emergency Contacts")', 'guard:Emergency Contacts'],
    ['button:has-text("Mission")', 'guard:Mission'],
    ['button:has-text("Resources")', 'guard:Resources'],
    ['button:has-text("Support")', 'guard:Support'],
    ['button:has-text("Map")', 'guard:Map'],
    ['button:has-text("SOS")', 'guard:SOS']
  ];

  for (const [selector, tag] of selectors) {
    await clickIfVisible(page, selector, evidence, tag);
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, `${mode}.png`), fullPage: true });
  await context.close();

  return { mode, ok: true, clicks: evidence.length, evidence, consoleErrors };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    results.push(await runMode(browser, "guard-web-desktop", { viewport: { width: 1536, height: 960 } }));
    results.push(await runMode(browser, "guard-android-mobile-webview", { ...devices["Pixel 7"] }));
  } finally {
    await browser.close();
  }

  const report = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, role: "guard", results };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log("Smoke report written:", path.join(OUTPUT_DIR, "report.json"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
