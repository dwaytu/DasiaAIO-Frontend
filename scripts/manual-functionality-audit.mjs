import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:5173'
const outputDir = 'test-results/system-audit'
const waitMs = Number(process.env.AUDIT_WAIT_MS ?? 350)
const viewportPresets = (process.env.AUDIT_VIEWPORTS ?? '1440x900,390x844')
  .split(',')
  .map((value) => value.trim().match(/^(\d+)x(\d+)$/))
  .filter(Boolean)
  .map(([_, width, height]) => ({ width: Number(width), height: Number(height), name: `${width}x${height}` }))

const roles = [
  {
    name: 'superadmin',
    identifier: process.env.AUDIT_SUPERADMIN_IDENTIFIER ?? 'superadmin',
    password: process.env.AUDIT_SUPERADMIN_PASSWORD ?? 'password123',
    routes: [
      '/dashboard', '/approvals', '/schedule', '/calendar', '/feedback-dashboard',
      '/analytics', '/performance', '/dtr', '/merit', '/audit', '/manage',
      '/mdr-import', '/operations-map', '/firearms', '/firearms/compliance',
      '/armored-cars', '/settings', '/permits', '/inbox', '/profile', '/support',
    ],
  },
  {
    name: 'admin',
    identifier: process.env.AUDIT_ADMIN_IDENTIFIER ?? 'admin',
    password: process.env.AUDIT_ADMIN_PASSWORD ?? 'password123',
    routes: [
      '/dashboard', '/approvals', '/schedule', '/calendar', '/feedback', '/allocation',
      '/dtr', '/performance', '/merit', '/manage', '/mdr-import', '/operations-map',
      '/firearms', '/firearms/compliance', '/armored-cars', '/maintenance', '/settings',
      '/permits', '/inbox', '/profile', '/support',
    ],
  },
  {
    name: 'supervisor',
    identifier: process.env.AUDIT_SUPERVISOR_IDENTIFIER ?? 'supervisor',
    password: process.env.AUDIT_SUPERVISOR_PASSWORD ?? 'password123',
    routes: [
      '/dashboard', '/schedule', '/calendar', '/missions', '/allocation',
      '/dtr', '/performance', '/merit', '/firearms', '/firearms/compliance',
      '/armored-cars', '/maintenance', '/operations-map', '/settings', '/permits',
      '/inbox', '/profile', '/support', '/feedback',
    ],
  },
  {
    name: 'guard',
    identifier: process.env.AUDIT_GUARD_IDENTIFIER ?? 'guard',
    password: process.env.AUDIT_GUARD_PASSWORD ?? 'password123',
    routes: ['/overview', '/calendar', '/feedback', '/permits', '/inbox', '/profile', '/settings', '/support'],
  },
]

const mobileRoutes = {
  superadmin: ['/dashboard', '/calendar', '/analytics', '/firearms/compliance'],
  admin: ['/dashboard', '/calendar', '/allocation', '/firearms/compliance'],
  supervisor: ['/dashboard', '/calendar', '/missions', '/firearms/compliance'],
  guard: ['/overview', '/calendar', '/feedback', '/inbox'],
}

const safeButtonPatterns = [
  /^Apply$/i,
  /^Clear$/i,
  /^Refresh(?: report| compliance report)?$/i,
  /^Print(?: DTR report| compliance report)?$/i,
  /^CSV$/i,
  /^Sync alerts$/i,
  /^Previous month$/i,
  /^Next month$/i,
  /^Open quick inbox/i,
]

const browser = await chromium.launch({ headless: true })
const results = []
const failures = []

await mkdir(outputDir, { recursive: true })

function slug(value) {
  return value.replace(/^\//, '').replaceAll('/', '-') || 'home'
}

function addFailure(role, route, message) {
  const detail = `${role} ${route}: ${message}`
  failures.push(detail)
}

async function settle(page) {
  await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(waitMs)
}

function attachDiagnostics(page, state) {
  page.on('pageerror', (error) => state.pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') state.consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    const errorText = request.failure()?.errorText ?? 'failed'
    if (errorText !== 'net::ERR_ABORTED') {
      state.requestFailures.push(`${request.method()} ${request.url()} ${errorText}`)
    }
  })
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      state.apiErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
  page.on('dialog', async (dialog) => {
    state.dialogs.push(`${dialog.type()}: ${dialog.message()}`)
    await dialog.dismiss()
  })
}

async function login(page, account, state) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
  await page.locator('#identifier').fill(account.identifier)
  await page.locator('#password').fill(account.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForTimeout(600)
  await settle(page)
  if (page.url().includes('/login')) {
    const alert = (await page.locator('[role="alert"]').allTextContents()).join(' | ')
    throw new Error(`login did not complete${alert ? `: ${alert}` : ''}`)
  }
}

async function clickSafeControls(page, role, route, state) {
  for (const pattern of safeButtonPatterns) {
    const buttons = page.getByRole('button', { name: pattern })
    const count = await buttons.count()
    for (let index = 0; index < count; index += 1) {
      const button = buttons.nth(index)
      if (!(await button.isVisible().catch(() => false)) || await button.isDisabled().catch(() => true)) continue
      const label = (await button.getAttribute('aria-label')) || (await button.textContent())?.trim() || pattern.toString()
      try {
        if (/^CSV$/i.test(label)) {
          const downloadPromise = page.waitForEvent('download', { timeout: 5_000 }).catch(() => null)
          await button.click()
          const download = await downloadPromise
          if (!download && !/disabled/i.test(await button.getAttribute('class') ?? '')) {
            addFailure(role, route, `CSV control did not produce a download`)
          }
        } else {
          await button.click()
        }
        state.clicked.push(label)
        await page.waitForTimeout(150)
      } catch (error) {
        addFailure(role, route, `could not click safe control ${label}: ${error.message}`)
      }
    }
  }

  const selects = page.locator('select:visible')
  const selectCount = await selects.count()
  for (let index = 0; index < selectCount; index += 1) {
    const select = selects.nth(index)
    const enabledOptions = select.locator('option:not([disabled])')
    const options = await enabledOptions.count()
    if (!(await select.isEnabled().catch(() => false)) || options < 2) continue
    try {
      const optionValue = await enabledOptions.nth(1).getAttribute('value')
      if (optionValue == null) continue
      await select.selectOption(optionValue)
      state.clicked.push(`select:${index}`)
      await page.waitForTimeout(150)
    } catch (error) {
      addFailure(role, route, `could not change select ${index}: ${error.message}`)
    }
  }

  const quickInbox = page.getByRole('button', { name: /Open quick inbox/i }).first()
  if (await quickInbox.isVisible().catch(() => false)) {
    await quickInbox.click()
    const close = page.getByRole('dialog', { name: 'Quick Inbox' }).getByRole('button', { name: 'Close' }).first()
    if (await close.isVisible().catch(() => false)) await close.click()
    else await page.keyboard.press('Escape')
    state.clicked.push('quick inbox open/close')
  }

  const profile = page.getByRole('button', { name: 'Open profile menu' }).first()
  if (await profile.isVisible().catch(() => false)) {
    await profile.click()
    await page.keyboard.press('Escape')
    state.clicked.push('profile menu open/close')
  }

  const menuToggle = page.getByRole('button', { name: 'Toggle menu' }).first()
  if (await menuToggle.isVisible().catch(() => false)) {
    await menuToggle.click()
    state.clicked.push('menu toggle')
    const closeMenu = page.getByRole('button', { name: 'Close menu' }).first()
    if (await closeMenu.isVisible().catch(() => false)) {
      await closeMenu.evaluate((element) => element.click())
      state.clicked.push('mobile menu open/close')
    }
  }

  const more = page.getByRole('button', { name: 'More', exact: true }).first()
  if (await more.isVisible().catch(() => false)) {
    await more.click({ force: true })
    const drawer = page.locator('#operational-more-drawer:visible, #appshell-more-drawer:visible')
    const drawerClose = drawer.getByRole('button', { name: /Close (more )?menu/i }).first()
    if (await drawerClose.count()) await drawerClose.click({ force: true })
    if (await drawer.count()) {
      await page.locator('div.fixed.inset-0.z-\\[63\\] > div.absolute.inset-0').click({ position: { x: 5, y: 5 }, force: true }).catch(() => {})
    }
    await drawer.waitFor({ state: 'hidden', timeout: 1_000 }).catch(() => {})
    state.clicked.push('More drawer open/close')
  }
}

async function checkPage(page, account, route, viewportName) {
  const state = { pageErrors: [], consoleErrors: [], apiErrors: [], requestFailures: [], dialogs: [], clicked: [] }
  page.removeAllListeners('pageerror')
  page.removeAllListeners('console')
  page.removeAllListeners('requestfailed')
  page.removeAllListeners('response')
  page.removeAllListeners('dialog')
  attachDiagnostics(page, state)
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
  await settle(page)
  await page.locator('#maincontent').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(waitMs)

  if (page.url().includes('/login')) {
    addFailure(account.name, route, 'redirected to login after authentication')
  }

  const main = page.locator('#maincontent')
  if (!(await main.isVisible().catch(() => false))) addFailure(account.name, route, 'main application shell is not visible')
  const textLength = (await page.locator('body').innerText().catch(() => '')).trim().length
  if (textLength < 80) addFailure(account.name, route, `page body is unexpectedly short (${textLength} characters)`)
  if (await page.getByText('Section error detected', { exact: true }).isVisible().catch(() => false)) {
    addFailure(account.name, route, 'React error boundary is visible')
  }

  await clickSafeControls(page, account.name, route, state)
  const layout = await page.evaluate(() => ({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }))
  if (layout.scrollWidth > layout.innerWidth + 1) addFailure(account.name, route, `horizontal overflow ${layout.scrollWidth}px > ${layout.innerWidth}px`)

  await page.screenshot({ path: `${outputDir}/${account.name}-${viewportName}-${slug(route)}.png`, fullPage: true })
  for (const error of state.pageErrors) addFailure(account.name, route, `page error: ${error}`)
  for (const error of state.consoleErrors) addFailure(account.name, route, `console error: ${error}`)
  for (const error of state.requestFailures) addFailure(account.name, route, `request failed: ${error}`)
  for (const error of state.apiErrors) {
    if (!error.includes('/api/shifts/swap-requests')) addFailure(account.name, route, `API error: ${error}`)
  }

  results.push({ role: account.name, viewport: viewportName, route, layout, clicked: state.clicked, pageErrors: state.pageErrors, consoleErrors: state.consoleErrors, apiErrors: state.apiErrors, requestFailures: state.requestFailures })
}

async function runAccount(account, viewport, viewportName, routeList) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  try {
    const loginState = { pageErrors: [], consoleErrors: [], apiErrors: [], requestFailures: [], dialogs: [], clicked: [] }
    attachDiagnostics(page, loginState)
    await login(page, account, loginState)
    for (const route of routeList) await checkPage(page, account, route, viewportName)
    const openMoreDrawer = page.locator('#operational-more-drawer:visible, #appshell-more-drawer:visible')
    if (await openMoreDrawer.count()) {
      await openMoreDrawer.getByRole('button', { name: /Close (more )?menu/i }).first().evaluate((element) => element.click())
      await openMoreDrawer.waitFor({ state: 'hidden', timeout: 1_000 }).catch(() => {})
    }
    // Reset transient overlay state before testing the session exit control.
    await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await settle(page)
    const profile = page.getByRole('button', { name: 'Open profile menu' }).first()
    if (await profile.isVisible().catch(() => false)) await profile.click()
    const logout = page.getByRole('dialog', { name: 'Profile menu' }).getByRole('button', { name: 'Logout', exact: true }).first()
    if (await logout.isVisible().catch(() => false)) {
      await logout.click()
      await page.waitForTimeout(waitMs)
      if (!page.url().includes('/login')) addFailure(account.name, 'logout', 'logout did not return to the login route')
    } else {
      addFailure(account.name, 'logout', 'logout control was not visible after route checks')
    }
  } catch (error) {
    addFailure(account.name, 'login', error.message)
  } finally {
    await context.close()
  }
}

try {
  for (const account of roles) {
    for (const preset of viewportPresets) {
      const routeList = preset.width < 600 ? mobileRoutes[account.name] : account.routes
      await runAccount(account, { width: preset.width, height: preset.height }, preset.name, routeList)
    }
  }
} finally {
  await browser.close()
}

const summary = {
  baseUrl,
  routeChecks: results.length,
  clickedControls: results.reduce((total, result) => total + result.clicked.length, 0),
  failures,
  results,
}
await writeFile(`${outputDir}/manual-functionality-audit.json`, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
console.log(JSON.stringify(summary, null, 2))
if (failures.length > 0) process.exitCode = 1
