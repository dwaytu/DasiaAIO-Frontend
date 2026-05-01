import fs from "node:fs";
import path from "node:path";
import { chromium, devices } from "playwright";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:5173";
const OUTPUT_DIR = path.resolve("output/playwright/local-smoke");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const roles = [
  { name: "superadmin", identifier: "superadmin.smoke@sentinel.dev", password: "Sentinel!234" },
  { name: "admin", identifier: "admin.smoke@sentinel.dev", password: "Sentinel!234" },
  { name: "supervisor", identifier: "supervisor.smoke@sentinel.dev", password: "Sentinel!234" },
  { name: "guard", identifier: "guard.smoke@sentinel.dev", password: "Sentinel!234" }
];

const modes = [
  { name: "web-desktop", contextOptions: { viewport: { width: 1536, height: 960 } } },
  { name: "android-mobile-webview", contextOptions: { ...devices["Pixel 7"], viewport: { width: 412, height: 915 } } }
];

const navLabels = [
  "Dashboard", "Approvals", "Schedule", "Alerts", "More", "Users", "Tracking", "Trips", "Armored",
  "Firearm", "Permits", "Maintenance", "Analytics", "Calendar", "Performance", "Merit", "Inbox",
  "Profile", "Settings", "Support", "Map", "MDR", "Feedback", "System", "Audit"
];

const destructivePattern = /(delete|remove|reject|commit|submit|save|create|update|reset|import|upload|archive|disable|revoke|logout|log out|sign out|decline)/i;

async function safeClick(locator, label, evidence) {
  try {
    if (await locator.count() === 0) return false;
    const target = locator.first();
    await target.waitFor({ state: "visible", timeout: 1500 });
    await target.click({ timeout: 2000 });
    evidence.push(`clicked:${label}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return true;
  } catch {
    return false;
  }
}

async function runRole(page, role, modeName, consoleErrors) {
  const evidence = [];
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.fill("#identifier", role.identifier);
  await page.fill("#password", role.password);
  await page.click('button:has-text("Login")');

  await page.waitForTimeout(1800);
  // Resolve mandatory legal-consent gate.
  const consentDialog = page.locator('text=Terms of Agreement').first();
  if (await consentDialog.count()) {
    try {
      const termsBox = page.locator('label:has-text("I have read and agree to the Terms of Agreement.")').first();
      const locationBox = page.locator('label:has-text("I consent to location processing for live guard and mission tracking.")').first();
      if (await termsBox.count()) {
        await termsBox.click({ timeout: 3000 });
        evidence.push('clicked:legal-consent:terms-checkbox');
      }
      if (await locationBox.count()) {
        await locationBox.click({ timeout: 3000 });
        evidence.push('clicked:legal-consent:location-checkbox');
      }
      const agreeButton = page.locator('button:has-text("Agree and Continue")').first();
      if (await agreeButton.count()) {
        await agreeButton.click({ timeout: 5000 });
        evidence.push('clicked:legal-consent:agree-and-continue');
        await page.waitForTimeout(1600);
      }
    } catch {
      // continue; subsequent checks will capture failures
    }
  }
  const loginError = await page.locator(".soc-auth-alert-error").first().textContent().catch(() => null);
  if (loginError && loginError.trim()) {
    return { role: role.name, mode: modeName, ok: false, reason: `login failed: ${loginError.trim()}`, evidence, consoleErrors };
  }

  for (const label of navLabels) {
    await safeClick(page.locator(`button:has-text("${label}")`), `button:${label}`, evidence);
    await safeClick(page.locator(`a:has-text("${label}")`), `link:${label}`, evidence);
  }

  const candidates = await page.locator("button, a, [role='button']").all();
  let clickedCount = 0;
  for (const item of candidates) {
    if (clickedCount >= 35) break;
    let text = "";
    try {
      text = ((await item.innerText()) || "").trim().replace(/\s+/g, " ").slice(0, 120);
    } catch {
      continue;
    }
    if (!text) continue;
    if (destructivePattern.test(text)) continue;
    try {
      if (!(await item.isVisible())) continue;
      await item.click({ timeout: 1200 });
      evidence.push(`clicked:generic:${text}`);
      clickedCount += 1;
      await page.waitForTimeout(200);
    } catch {
      // ignore and continue
    }
  }

  await page.screenshot({ path: path.join(OUTPUT_DIR, `${modeName}-${role.name}.png`), fullPage: true });

  const severeConsole = consoleErrors.filter((m) => /error|failed|exception/i.test(m));
  return {
    role: role.name,
    mode: modeName,
    ok: true,
    clicked: evidence.length,
    evidence: evidence.slice(0, 80),
    consoleErrors: severeConsole.slice(0, 30)
  };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const mode of modes) {
    for (const role of roles) {
      const context = await browser.newContext(mode.contextOptions);
      const page = await context.newPage();
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error" || msg.type() === "warning") {
          consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
        }
      });
      page.on("pageerror", (err) => consoleErrors.push(`[pageerror] ${err.message}`));

      try {
        const result = await runRole(page, role, mode.name, consoleErrors);
        results.push(result);
      } catch (err) {
        results.push({
          role: role.name,
          mode: mode.name,
          ok: false,
          reason: err instanceof Error ? err.message : String(err),
          consoleErrors: consoleErrors.slice(0, 30)
        });
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();

  const report = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    results
  };

  const reportPath = path.join(OUTPUT_DIR, "report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Smoke report written: ${reportPath}`);

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error(`Smoke failed entries: ${failed.length}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});



