import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:5173";
const OUTPUT_DIR = path.resolve("output/playwright/local-smoke-roles");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const roles = [
  { name: "superadmin", identifier: "superadmin.smoke@sentinel.dev", password: "Sentinel!234" },
  { name: "admin", identifier: "admin.smoke@sentinel.dev", password: "Sentinel!234" },
  { name: "supervisor", identifier: "supervisor.smoke@sentinel.dev", password: "Sentinel!234" },
  { name: "guard", identifier: "guard.smoke@sentinel.dev", password: "Sentinel!234" }
];

const roleNavHints = {
  superadmin: ["Dashboard", "Users", "Approvals", "Schedule", "Alerts", "Analytics", "Tracking", "Trips", "Armored Car", "Firearm", "Permits", "Maintenance", "Settings", "Feedback"],
  admin: ["Dashboard", "Users", "Approvals", "Schedule", "Alerts", "Tracking", "Trips", "Armored Car", "Firearm", "Permits", "Maintenance", "Settings", "Feedback"],
  supervisor: ["Dashboard", "Approvals", "Schedule", "Alerts", "Tracking", "Trips", "Armored Car", "Firearm", "Settings", "Feedback"],
  guard: ["Dashboard", "Schedule", "Alerts", "Tracking", "Trips", "Profile", "Settings", "Feedback"]
};

async function clickIfVisible(page, selectors, evidence, tag) {
  for (const selector of selectors) {
    const el = page.locator(selector).first();
    if (!(await el.count())) continue;
    if (!(await el.isVisible().catch(() => false))) continue;
    try { await el.scrollIntoViewIfNeeded(); } catch {}
    try {
      await el.click({ timeout: 2500, force: true });
      evidence.push(tag);
      await page.waitForTimeout(250);
      return true;
    } catch {}
  }
  return false;
}

async function login(page, creds, evidence) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.fill("#identifier", creds.identifier);
  await page.fill("#password", creds.password);
  await page.click('button:has-text("Login")');
  await page.waitForTimeout(1500);

  const err = await page.locator(".soc-auth-alert-error").first().textContent().catch(() => null);
  if (err && err.trim()) throw new Error(`login failed: ${err.trim()}`);

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

async function runDesktopRole(browser, role) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });
  const page = await context.newPage();
  const evidence = [];
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  await login(page, role, evidence);
  for (const label of roleNavHints[role.name] || []) {
    await clickIfVisible(page, [
      `button:has-text("${label}")`,
      `a:has-text("${label}")`
    ], evidence, `desktop:${label}`);
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, `desktop-${role.name}.png`), fullPage: true });
  await context.close();

  return { role: role.name, mode: "web-desktop", ok: true, clicks: evidence.length, evidence, consoleErrors };
}

async function runAndroidRole(browser, role) {
  const context = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await context.newPage();
  const evidence = [];
  const consoleErrors = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(`[pageerror] ${err.message}`));

  await login(page, role, evidence);
  await clickIfVisible(page, ['button:has-text("Dismiss")'], evidence, "mobile:dismiss-location");

  const mobileTabs = ["Dashboard", "Approvals", "Schedule", "Alerts", "More"];
  for (const tab of mobileTabs) {
    await clickIfVisible(page, [`nav[aria-label="Mobile navigation"] button:has-text("${tab}")`], evidence, `mobile-tab:${tab}`);
  }

  await clickIfVisible(page, ['nav[aria-label="Mobile navigation"] button:has-text("More")'], evidence, "mobile:more-open");

  const drawerItems = ["Profile", "Settings", "Feedback", "Tracking", "Trips"];
  for (const item of drawerItems) {
    await clickIfVisible(page, [
      `#operational-more-drawer button:has-text("${item}")`,
      `#operational-more-drawer a:has-text("${item}")`
    ], evidence, `mobile-more:${item}`);
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, `android-${role.name}.png`), fullPage: true });
  await context.close();

  return { role: role.name, mode: "android-mobile-webview", ok: true, clicks: evidence.length, evidence, consoleErrors };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    for (const role of roles) {
      try {
        results.push(await runDesktopRole(browser, role));
      } catch (err) {
        results.push({ role: role.name, mode: "web-desktop", ok: false, reason: err instanceof Error ? err.message : String(err) });
      }

      try {
        results.push(await runAndroidRole(browser, role));
      } catch (err) {
        results.push({ role: role.name, mode: "android-mobile-webview", ok: false, reason: err instanceof Error ? err.message : String(err) });
      }
    }
  } finally {
    await browser.close();
  }

  const report = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, results };
  const reportPath = path.join(OUTPUT_DIR, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Smoke report written: ${reportPath}`);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
