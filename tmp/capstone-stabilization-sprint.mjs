import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUT_DIR = path.resolve('output/playwright/capstone-stabilization-sprint');
fs.mkdirSync(OUT_DIR, { recursive: true });

const users = {
  guard: { identifier: 'guard', password: 'password123' },
  supervisor: { identifier: 'supervisor', password: 'password123' },
  admin: { identifier: 'admin', password: 'password123' },
  superadmin: { identifier: 'superadmin', password: 'password123' },
};

async function login(page, creds) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.locator('#identifier').fill(creds.identifier);
  await page.locator('#password').fill(creds.password);
  await page.getByRole('button', { name: /login/i }).click();
  await page.waitForTimeout(1200);

  const terms = page.locator('label:has-text("I have read and agree to the Terms of Agreement")').first();
  const loc = page.locator('label:has-text("I consent to location processing for live guard and mission tracking")').first();
  if (await terms.isVisible().catch(() => false)) {
    await terms.click();
  }
  if (await loc.isVisible().catch(() => false)) {
    await loc.click();
  }
  const agree = page.getByRole('button', { name: /agree and continue/i }).first();
  if (await agree.isVisible().catch(() => false)) {
    await agree.click();
    await page.waitForTimeout(1200);
  }

  const stillLogin = page.url().includes('/login');
  return !stillLogin;
}

async function runGuardMobile(browser) {
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    geolocation: { latitude: 7.0722, longitude: 125.6131 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  const result = {
    flow: 'guard-mobile-live-tracking-sos-offline',
    loginOk: false,
    trackingStatusVisible: false,
    mapTabVisible: false,
    mapSurfaceOk: false,
    emergencyContactsVisible: false,
    sosButtonVisible: false,
    offlineQueueBannerVisible: false,
    queueCountBeforeSos: null,
    queueCountAfterSos: null,
    sosSentVisible: false,
    notes: [],
    consoleErrors: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') result.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => result.consoleErrors.push(`[pageerror] ${err.message}`));

  try {
    result.loginOk = await login(page, users.guard);
    if (!result.loginOk) {
      result.notes.push('Guard login failed.');
      await page.screenshot({ path: path.join(OUT_DIR, 'guard-mobile-login-failed.png'), fullPage: true });
      return result;
    }

    await page.waitForTimeout(1200);

    const trackingStatus = page.getByText(/Tracking Active|Tracking Paused|Tracking Blocked|Tracking Waiting/i).first();
    result.trackingStatusVisible = await trackingStatus.isVisible().catch(() => false);

    const emergencyContacts = page.getByText(/Operations Center|HR \/ Compliance|Emergency Contacts/i).first();
    result.emergencyContactsVisible = await emergencyContacts.isVisible().catch(() => false);

    const mapTab = page.getByRole('button', { name: /^Map$/i }).first();
    result.mapTabVisible = await mapTab.isVisible().catch(() => false);
    if (result.mapTabVisible) {
      await mapTab.click();
      await page.waitForTimeout(900);
      const mapFrame = page.locator('iframe[title*="map" i], .leaflet-container').first();
      const mapFallback = page.getByText(/No live coordinates yet|Enable tracking from Mission/i).first();
      result.mapSurfaceOk = (await mapFrame.isVisible().catch(() => false)) || (await mapFallback.isVisible().catch(() => false));
    }

    const sosButton = page.getByRole('button', { name: /Emergency SOS/i }).first();
    result.sosButtonVisible = await sosButton.isVisible().catch(() => false);

    if (result.sosButtonVisible) {
      result.queueCountBeforeSos = await page.evaluate(async () => {
        return await new Promise((resolve) => {
          const req = indexedDB.open('sentinel-offline', 1);
          req.onerror = () => resolve(-1);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('action-queue', 'readonly');
            const countReq = tx.objectStore('action-queue').count();
            countReq.onsuccess = () => resolve(countReq.result);
            countReq.onerror = () => resolve(-1);
          };
        });
      });

      await context.setOffline(true);
      await sosButton.click({ timeout: 4000 });
      await page.waitForTimeout(23000);
      result.sosSentVisible = await page.getByText(/SOS Sent/i).first().isVisible().catch(() => false);

      const queueBanner = page.getByText(/action waiting to send|actions waiting to send/i).first();
      result.offlineQueueBannerVisible = await queueBanner.isVisible().catch(() => false);
      result.queueCountAfterSos = await page.evaluate(async () => {
        return await new Promise((resolve) => {
          const req = indexedDB.open('sentinel-offline', 1);
          req.onerror = () => resolve(-1);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('action-queue', 'readonly');
            const countReq = tx.objectStore('action-queue').count();
            countReq.onsuccess = () => resolve(countReq.result);
            countReq.onerror = () => resolve(-1);
          };
        });
      });
      if (!result.offlineQueueBannerVisible) {
        result.notes.push('Offline queue banner not visible after offline SOS click.');
      }

      await context.setOffline(false);
      await page.waitForTimeout(600);
    }

    await page.screenshot({ path: path.join(OUT_DIR, 'guard-mobile-critical-path.png'), fullPage: true });
  } finally {
    await context.close();
  }

  return result;
}

async function runSuperadminDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });
  const page = await context.newPage();
  const result = {
    flow: 'superadmin-desktop-operations-map',
    loginOk: false,
    headingVisible: false,
    mapPanelVisible: false,
    controlsVisible: false,
    dataStateVisible: false,
    notes: [],
    consoleErrors: [],
  };

  page.on('console', (msg) => {
    if (msg.type() === 'error') result.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => result.consoleErrors.push(`[pageerror] ${err.message}`));

  try {
    result.loginOk = await login(page, users.superadmin);
    if (!result.loginOk) {
      result.notes.push('Superadmin login failed.');
      await page.screenshot({ path: path.join(OUT_DIR, 'superadmin-login-failed.png'), fullPage: true });
      return result;
    }

    await page.goto(`${BASE_URL}/operations-map`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1300);

    result.headingVisible = await page.getByRole('heading', { name: /Operations Map/i }).first().isVisible().catch(() => false);
    result.mapPanelVisible = await page.getByRole('heading', { name: /Operational Map/i }).first().isVisible().catch(() => false);

    const fitAll = page.getByRole('button', { name: /Fit All/i }).first();
    const centerTagum = page.getByRole('button', { name: /Center Tagum/i }).first();
    result.controlsVisible = (await fitAll.isVisible().catch(() => false)) && (await centerTagum.isVisible().catch(() => false));

    const noTracked = page.getByText(/No tracked field units yet/i).first();
    const trackedUnits = page.getByText(/Tracked Units/i).first();
    result.dataStateVisible = (await noTracked.isVisible().catch(() => false)) || (await trackedUnits.isVisible().catch(() => false));

    await page.screenshot({ path: path.join(OUT_DIR, 'superadmin-operations-map.png'), fullPage: true });
  } finally {
    await context.close();
  }

  return result;
}

async function runRoleDashboards(browser) {
  const roles = ['superadmin', 'admin', 'supervisor', 'guard'];
  const summary = [];

  for (const role of roles) {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    const item = { role, loginOk: false, shellVisible: false, mobileNavVisible: false, notes: [] };

    try {
      item.loginOk = await login(page, users[role]);
      if (item.loginOk) {
        await page.waitForTimeout(800);
        item.shellVisible = await page.locator('header').first().isVisible().catch(() => false);
        item.mobileNavVisible = await page.locator('[aria-label*="navigation" i], nav').first().isVisible().catch(() => false);
      } else {
        item.notes.push('Login failed.');
      }

      await page.screenshot({ path: path.join(OUT_DIR, `role-${role}-desktop.png`), fullPage: true });
    } finally {
      await context.close();
    }

    summary.push(item);
  }

  return summary;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const report = { generatedAt: new Date().toISOString(), baseUrl: BASE_URL, checks: {}, roleSummary: [] };

  try {
    report.checks.guard = await runGuardMobile(browser);
    report.checks.superadmin = await runSuperadminDesktop(browser);
    report.roleSummary = await runRoleDashboards(browser);
  } finally {
    await browser.close();
  }

  const reportPath = path.join(OUT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`Wrote report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
