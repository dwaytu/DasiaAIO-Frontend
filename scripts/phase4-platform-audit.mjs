import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:5173'
const apiBaseUrl = process.env.AUDIT_API_BASE_URL ?? 'http://127.0.0.1:5000'
const accounts = {
  superadmin: {
    identifier: process.env.AUDIT_SUPERADMIN_IDENTIFIER ?? 'superadmin',
    password: process.env.AUDIT_SUPERADMIN_PASSWORD ?? 'password123',
    route: '/operations-map',
  },
  guard: {
    identifier: process.env.AUDIT_GUARD_IDENTIFIER ?? 'guard',
    password: process.env.AUDIT_GUARD_PASSWORD ?? 'password123',
    route: '/overview',
  },
}
const outputDir = 'test-results/phase4'

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const failures = []
const results = []

function recordDiagnostics(page, diagnostics) {
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
      diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`)
    }
  })
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      diagnostics.apiErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
}

async function login(page, account) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
  await page.locator('#identifier').fill(account.identifier)
  await page.locator('#password').fill(account.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 })
}

async function getMapEndpointChecks(page) {
  const token = await page.evaluate(() => localStorage.getItem('token') ?? '')
  const endpoints = ['/api/tracking/map-data', '/api/tracking/active-guards', '/api/tracking/client-sites']
  const checks = []

  for (const path of endpoints) {
    const response = await fetch(`${apiBaseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } })
    const body = await response.json().catch(() => null)
    checks.push({
      path,
      status: response.status,
      validPayload: body !== null && typeof body === 'object',
    })
  }

  return checks
}

async function inspectThemeAndMap(page, role, viewportName) {
  const map = page.locator('.leaflet-container').first()
  await map.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  if (!(await map.isVisible().catch(() => false))) {
    failures.push(`${role}/${viewportName}: map is not visible`)
    return null
  }

  const mapBox = await map.boundingBox()
  if (!mapBox || mapBox.width < 200 || mapBox.height < 120) {
    failures.push(`${role}/${viewportName}: map dimensions are invalid (${mapBox?.width ?? 0}x${mapBox?.height ?? 0})`)
  }

  const themeButton = page.locator('button[title^="Switch to "]').first()
  if (!(await themeButton.isVisible().catch(() => false))) {
    const activeTheme = await page.evaluate(() => {
      const classes = document.documentElement.classList
      return classes.contains('dark') ? 'dark' : classes.contains('light') ? 'light' : ''
    })
    if (!activeTheme) failures.push(`${role}/${viewportName}: active theme class is missing`)
  } else {
    const before = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    await themeButton.click()
    await page.waitForTimeout(250)
    const after = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    if (before === after) failures.push(`${role}/${viewportName}: theme toggle did not change the theme state`)
    await themeButton.click()
    await page.waitForTimeout(250)
    const restored = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    if (restored !== before) failures.push(`${role}/${viewportName}: theme toggle did not restore the original theme state`)
  }

  const tileCount = await map.locator('.leaflet-tile').count()
  if (tileCount === 0) failures.push(`${role}/${viewportName}: map has no tile elements`)

  return { width: mapBox?.width ?? 0, height: mapBox?.height ?? 0, tileCount }
}

async function run(role, viewportName, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const diagnostics = { pageErrors: [], consoleErrors: [], requestFailures: [], apiErrors: [] }
  recordDiagnostics(page, diagnostics)

  try {
    await login(page, accounts[role])
    await page.goto(`${baseUrl}${accounts[role].route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    if (role === 'guard') {
      const mapTab = page.getByRole('button', { name: 'Map', exact: true })
      await mapTab.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
      if (!(await mapTab.isVisible().catch(() => false))) {
        failures.push(`${role}/${viewportName}: guard Map tab is missing`)
      } else {
        await mapTab.click()
      }
    }

    await page.waitForTimeout(1_000)
    const map = await inspectThemeAndMap(page, role, viewportName)
    const endpointChecks = await getMapEndpointChecks(page)
    for (const check of endpointChecks) {
      const expectedStatus = role === 'guard' && check.path === '/api/tracking/client-sites'
        ? new Set([403])
        : new Set([200])
      if (!expectedStatus.has(check.status) || !check.validPayload) {
        failures.push(`${role}/${viewportName}: ${check.path} returned ${check.status} with an invalid payload`)
      }
    }

    if (role === 'guard') {
      diagnostics.consoleErrors = diagnostics.consoleErrors.filter((entry) => !entry.includes('client-sites'))
      diagnostics.apiErrors = diagnostics.apiErrors.filter((entry) => !entry.includes('/api/tracking/client-sites'))
    }

    const layout = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    if (layout.scrollWidth > layout.width + 1) {
      failures.push(`${role}/${viewportName}: horizontal overflow ${layout.scrollWidth}px > ${layout.width}px`)
    }
    for (const [kind, entries] of Object.entries(diagnostics)) {
      for (const entry of entries) failures.push(`${role}/${viewportName}: ${kind}: ${entry}`)
    }

    await page.screenshot({ path: `${outputDir}/${role}-${viewportName}.png`, fullPage: true })
    results.push({ role, viewportName, map, endpointChecks, layout, diagnostics })
  } catch (error) {
    await page.screenshot({ path: `${outputDir}/${role}-${viewportName}-failure.png`, fullPage: true }).catch(() => {})
    failures.push(`${role}/${viewportName}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await context.close()
  }
}

try {
  for (const [role] of Object.entries(accounts)) {
    await run(role, 'desktop', { width: 1440, height: 900 })
    await run(role, 'mobile', { width: 390, height: 844 })
  }
} finally {
  await browser.close()
}

console.log(JSON.stringify({ baseUrl, apiBaseUrl, results, failures }, null, 2))
if (failures.length > 0) process.exitCode = 1
