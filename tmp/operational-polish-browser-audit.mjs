import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = 'http://127.0.0.1:5173'
const outputDir = path.resolve('output/playwright/final-acceptance-2026-10-27/operational')
fs.mkdirSync(outputDir, { recursive: true })

const user = {
  id: 'qa-superadmin',
  email: 'qa-superadmin@example.test',
  username: 'qa-superadmin',
  fullName: 'QA Superadmin',
  role: 'superadmin',
  legalConsentAccepted: true,
}

const now = new Date().toISOString()
const dtrItems = Array.from({ length: 58 }, (_, index) => ({
  shiftId: `shift-${index + 1}`,
  guardId: `guard-${index + 1}`,
  guardName: `Guard ${index + 1}`,
  clientSite: index % 2 ? 'DSIA - Tagum' : 'DSIA - Davao',
  scheduledStart: '2026-10-20T00:00:00.000Z',
  scheduledEnd: '2026-10-20T08:00:00.000Z',
  actualCheckIn: '2026-10-20T00:00:00.000Z',
  actualCheckOut: '2026-10-20T08:00:00.000Z',
  lateMinutes: 0,
  totalHours: 8,
  status: 'completed',
}))

const firearm = {
  id: 'firearm-1',
  serialNumber: 'DSIA-9001',
  model: 'Glock 17',
  caliber: '9mm',
  make: 'Armscor',
  status: 'available',
  licenseExpiryDate: '2027-10-20',
  lastMaintenance: '2026-10-01',
}

const firearmCompliance = {
  firearmId: 'firearm-1',
  serialNumber: 'DSIA-9001',
  model: 'Glock 17',
  caliber: '9mm',
  firearmStatus: 'allocated',
  holderName: 'Guard One',
  allocationDate: '2026-10-01',
  expectedReturnDate: '2026-10-31',
  permitType: 'Carry permit',
  permitExpiryDate: '2027-01-20',
  permitStatus: 'valid',
  permitDaysRemaining: 92,
  maintenanceType: 'Routine',
  maintenanceDate: '2026-10-01',
  maintenanceStatus: 'current',
  complianceStatus: 'compliant',
}

const guardCompliance = {
  guardId: 'guard-1',
  guardNumber: 1,
  guardName: 'Guard One',
  licenseNumber: 'LIC-9001',
  licenseIssuedDate: '2025-10-20',
  licenseExpiryDate: '2027-10-20',
  licenseDaysRemaining: 360,
  complianceStatus: 'compliant',
}

const auditLog = {
  id: 'audit-1',
  actor_name: 'QA Superadmin',
  actor_role: 'superadmin',
  action_key: 'firearm.read',
  entity_type: 'firearms',
  entity_id: 'firearm-1',
  result: 'success',
  source: 'web',
  actor_attribution_mode: 'authenticated',
  created_at: now,
}

const mapSnapshot = {
  clientSites: [
    { id: 'site-1', name: 'DSIA - Tagum', latitude: 7.4478, longitude: 125.8078, isActive: true },
  ],
  trackingPoints: [
    { id: 'guard-point', entityType: 'guard', entityId: 'guard-1', label: 'Guard One', latitude: 7.4478, longitude: 125.8078, accuracyMeters: 8, movementStatus: 'idle', heartbeatStatus: 'active', scheduleStatus: 'on-duty', scheduleClientSite: 'DSIA - Tagum', scheduleStartTime: '08:00', scheduleEndTime: '20:00', recordedAt: now },
    { id: 'vehicle-point', entityType: 'vehicle', entityId: 'vehicle-1', label: 'Unit V-8', latitude: 7.4578, longitude: 125.8178, accuracyMeters: 12, movementStatus: 'moving', heartbeatStatus: 'active', scheduleClientSite: 'DSIA - Tagum', scheduleStartTime: '06:00', scheduleEndTime: '18:00', speedKph: 18.5, source: 'vehicle-telemetry', recordedAt: now },
  ],
  geofenceAlerts: [{ id: 'alert-1', guardId: 'guard-1', guardName: 'Guard One', eventType: 'exit', siteId: 'site-1', siteName: 'DSIA - Tagum', createdAt: now }],
}

const sos = {
  id: 'sos-1',
  title: 'SOS EMERGENCY',
  description: 'Emergency panic alert triggered by Guard One',
  location: '7.447800, 125.807800',
  site_name: 'DSIA - Tagum',
  reported_by: 'guard-1',
  reported_by_name: 'Guard One',
  contact_number: '+639171234567',
  latitude: 7.4478,
  longitude: 125.8078,
  status: 'open',
  priority: 'critical',
  created_at: now,
  updated_at: now,
}

async function json(route, body) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
}

let emptyDtr = false
async function installPresentationApi(page) {
  await page.addInitScript((sessionUser) => {
    localStorage.setItem('token', 'isolated-presentation-token')
    localStorage.setItem('user', JSON.stringify(sessionUser))
    localStorage.setItem('dasi.toa.accepted.v1', 'accepted')
    localStorage.setItem('dasi.locationConsent.v1', 'accepted')
    localStorage.setItem('sentinel-theme', 'light')
  }, user)

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/attendance/dtr') {
      const pageNumber = Number(new URL(route.request().url()).searchParams.get('page') ?? 1)
      const pageSize = 50
      const start = (pageNumber - 1) * pageSize
      return json(route, { total: emptyDtr ? 0 : dtrItems.length, page: pageNumber, pageSize, items: emptyDtr ? [] : dtrItems.slice(start, start + pageSize) })
    }
    if (pathname === '/api/firearm-allocations/summary') return json(route, { totalFirearms: 1, availableFirearms: 1, allocatedFirearms: 0, maintenanceFirearms: 0, activeCustody: 0, custodyReviewFirearms: 0 })
    if (pathname === '/api/firearms/compliance-report') return json(route, { total: 1, page: 1, pageSize: 50, summary: { expired: 0, expiringSoon: 0, noPermit: 0, maintenance: 0, compliant: 1 }, items: [firearmCompliance] })
    if (pathname === '/api/guards/compliance-report') return json(route, { total: 1, page: 1, pageSize: 50, summary: { totalGuards: 1, expired: 0, expiringSoon: 0, noLicense: 0, compliant: 1 }, items: [guardCompliance] })
    if (pathname === '/api/audit/logs') return json(route, { items: [auditLog], meta: { total: 1, page: 1, page_size: 25, has_more: false } })
    if (pathname === '/api/tracking/map-data') return json(route, mapSnapshot)
    if (pathname === '/api/tracking/geofences') return json(route, { zones: [] })
    if (pathname === '/api/incidents/active') return json(route, { incidents: [sos] })
    if (pathname.endsWith('/status')) return json(route, {})
    if (pathname === '/api/firearms') return json(route, [firearm])
    if (pathname === '/api/users') return json(route, [])
    if (pathname === '/api/armored-cars') return json(route, { armored_cars: [] })
    if (pathname === '/api/guard-replacement/shifts') return json(route, { shifts: [] })
    if (pathname === '/api/guards') return json(route, [])
    if (pathname === '/api/users/pending-approvals') return json(route, { users: [] })
    if (pathname.startsWith('/api/firearm-allocations')) return json(route, { allocations: [] })
    if (pathname === '/api/trips') return json(route, { trips: [] })
    if (pathname.startsWith('/api/guard-firearm-permits')) return json(route, { permits: [] })
    return json(route, {})
  })
}

async function capture(page, name) {
  await page.screenshot({ path: path.join(outputDir, name), fullPage: true })
}

const browser = await chromium.launch({ headless: true })
const results = {
  generatedAt: new Date().toISOString(), baseUrl, isolatedApi: true, productionDataTouched: false,
  outputDir, pageErrors: [], failedApiRequests: [], consoleErrors: [], blockedResources: [], scenarioResults: [],
}
function record(id, route, viewport, assertions, screenshot, passed, failureMessage = null) {
  results.scenarioResults.push({ id, description: assertions.join('. '), route, role: 'superadmin', viewport, theme: 'light',
    assertions, screenshotPath: path.join(outputDir, screenshot), passed, failureMessage })
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, serviceWorkers: 'block' })
  await context.route('**/*', route => {
    const url = new URL(route.request().url())
    if (url.origin === baseUrl && !url.pathname.startsWith('/api/')) return route.continue()
    results.blockedResources.push({ type: route.request().resourceType(), url: url.origin + url.pathname })
    return route.abort('blockedbyclient')
  })
  const page = await context.newPage()
  page.setDefaultTimeout(8000)
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('ERR_BLOCKED_BY_CLIENT')) results.consoleErrors.push(msg.text())
  })
  page.on('pageerror', (error) => results.pageErrors.push(error.message))
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText || ''
    if (request.url().includes('/api/') && reason !== 'net::ERR_ABORTED') results.failedApiRequests.push(request.url())
  })
  await installPresentationApi(page)

  for (const [route, screenshot] of [
    ['/firearms', 'desktop-firearm-inventory.png'],
    ['/firearms/compliance', 'tablet-firearm-compliance.png'],
  ]) {
    await page.setViewportSize({ width: route === '/firearms' ? 1440 : 1024, height: 1000 })
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('table').waitFor({ timeout: 10_000 })
    await capture(page, screenshot)
    const headerPosition = await page.locator('thead').first().evaluate((node) => getComputedStyle(node).position)
    const rowPresent = await page.getByRole('table').getByText('DSIA-9001', { exact: true }).isVisible()
    const passed = rowPresent && headerPosition === 'sticky'
    record(route === '/firearms' ? 'firearm-inventory' : 'firearm-documents', route, page.viewportSize(),
      ['Fixture inventory row is readable', 'Table heading is sticky'], screenshot, passed, passed ? null : 'Fixture row or sticky table header was missing')
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${baseUrl}/audit`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('table').waitFor({ timeout: 10_000 })
  await capture(page, 'desktop-audit-log.png')
  const desktopSticky = await page.locator('thead').first().evaluate(node => getComputedStyle(node).position === 'sticky')
  record('activity-history-desktop-table', '/audit', page.viewportSize(), ['Activity History table has a sticky header'], 'desktop-audit-log.png', desktopSticky, desktopSticky ? null : 'Audit header is not sticky')

  for (const [route, width, screenshot] of [
    ['/guards/compliance', 390, 'mobile-390-guard-license-compliance.png'],
    ['/audit', 320, 'mobile-320-audit-log.png'],
  ]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
    if (route === '/audit') {
      await page.getByRole('heading', { name: 'Activity History' }).waitFor({ timeout: 10_000 })
      await page.waitForTimeout(300)
    } else {
      await page.getByRole('table').waitFor({ timeout: 10_000 })
    }
    await capture(page, screenshot)
    const table = page.locator('table').first()
    const tableCount = await table.count()
    const scrollable = tableCount ? await table.evaluate((node) => {
      const parent = node.parentElement
      return Boolean(parent && parent.scrollWidth > parent.clientWidth)
    }) : false
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    let passed
    if (route === '/audit') {
      const actor = page.getByRole('button').filter({ hasText: 'QA Superadmin' }).filter({ visible: true })
      await actor.focus()
      await actor.press('Enter')
      passed = noOverflow && await actor.getAttribute('aria-expanded') === 'true'
      await capture(page, screenshot)
      record('activity-history-mobile', route, page.viewportSize(), ['Mobile audit entry opens with Enter', 'Page stays within 320px'], screenshot, passed, passed ? null : 'Unable to expand mobile row or page overflowed')
    } else {
      const row = page.getByRole('table').getByText('Guard One', { exact: true })
      const moved = await table.evaluate(node => {
        const wrap = node.parentElement
        wrap.scrollLeft = wrap.scrollWidth
        return wrap.scrollLeft > 0
      })
      passed = noOverflow && scrollable && moved && await row.isVisible()
      record('guard-documents-mobile', route, page.viewportSize(), ['Fixture guard is present', 'Horizontal scrolling is contained in the table'], screenshot, passed, passed ? null : 'Table content or contained horizontal scroll was missing')
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 })
  emptyDtr = true
  await page.goto(`${baseUrl}/dtr`, { waitUntil: 'domcontentloaded' })
  await page.getByText('No attendance records found', { exact: true }).waitFor()
  await capture(page, 'dtr-empty.png')
  record('dtr-empty', '/dtr', page.viewportSize(), ['An empty intercepted response displays the attendance empty state'], 'dtr-empty.png', true)
  emptyDtr = false
  await page.goto(`${baseUrl}/dtr`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('table').waitFor({ timeout: 10_000 })
  await capture(page, 'desktop-dtr-screen.png')
  await page.evaluate(() => { window.print = () => { document.body.dataset.auditPrintInvoked = 'true' } })
  await page.getByRole('button', { name: 'Print Official Timesheet' }).click()
  const printInvoked = await page.locator('body').getAttribute('data-audit-print-invoked') === 'true'
  await page.emulateMedia({ media: 'print' })
  await page.locator('.dtr-print-heading').waitFor()
  await capture(page, 'print-dtr-a4-landscape.png')
  await page.pdf({ path: path.join(outputDir, 'print-dtr-a4-landscape.pdf'), format: 'A4', landscape: true, printBackground: true })
  const printHeading = await page.locator('.dtr-print-heading').innerText()
  const signatures = await page.locator('.dtr-print-signatures').innerText()
  const repeatingHeaders = await page.locator('.dtr-print-table thead').evaluate(node => getComputedStyle(node).display === 'table-header-group')
  const printPassed = printInvoked && /DSIA/i.test(printHeading) && /Reporting period/i.test(printHeading)
    && await page.locator('.dtr-print-table tbody tr').count() === 50
    && /Prepared by/i.test(signatures) && /Reviewed by/i.test(signatures) && /Received by/i.test(signatures)
    && repeatingHeaders && await page.locator('form:visible, aside:visible, nav:visible, button:visible').count() === 0
  record('dtr-print', '/dtr', page.viewportSize(), ['Print action invoked', 'Heading, period, 50 current-page fixture rows and three signatures are present', 'Table header group and hidden screen controls verified in print media', 'A4 landscape PDF generated'], 'print-dtr-a4-landscape.png', printPassed, printPassed ? null : 'Print content or screen control assertion failed')
  await page.emulateMedia({ media: 'screen' })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('alertdialog', { name: /sos emergency alert/i }).waitFor({ timeout: 10_000 })
  await capture(page, 'mobile-390-sos-alert.png')
  const beforeTimer = await page.getByText(/Response Time:/).textContent()
  await page.waitForTimeout(1100)
  const afterTimer = await page.getByText(/Response Time:/).textContent()
  const callGuardVisible = await page.getByRole('link', { name: 'Call Guard' }).isVisible()
  const timerPassed = beforeTimer !== afterTimer && callGuardVisible
  record('sos-timer-contact', '/dashboard', page.viewportSize(), ['SOS timer advances and fixture Call Guard is available'], 'mobile-390-sos-alert.png', timerPassed, timerPassed ? null : 'Timer or valid contact failed')
  await page.setViewportSize({ width: 320, height: 844 })
  await capture(page, 'mobile-320-sos-alert.png')
  for (const label of ['Resolve SOS', 'Focus on Map']) await page.getByRole('button', { name: label, exact: true }).click({ trial: true })
  record('sos-narrow-actions', '/dashboard', page.viewportSize(), ['Resolve SOS and Focus on Map pass browser clickability checks at 320px'], 'mobile-320-sos-alert.png', true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Focus on Map' }).click()
  const mapRegion = page.getByRole('region', { name: 'Operational map' })
  await mapRegion.waitFor({ timeout: 10_000 })
  await mapRegion.scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(outputDir, 'mobile-390-operations-map.png') })
  const mapRoutePassed = new URL(page.url()).pathname === '/operations-map'
  record('sos-focus-on-map', '/dashboard', page.viewportSize(), ['Focus on Map opens the Operations Map route and renders the map'], 'mobile-390-operations-map.png', mapRoutePassed, mapRoutePassed ? null : 'Map route did not open')

  const layers = page.getByRole('group', { name: 'Map layer visibility' })
  for (const label of ['Guards', 'Vehicles', 'Sites', 'Alerts']) {
    const prefix = label + ' (1) layer '
    await layers.getByRole('button', { name: prefix + 'visible', exact: true }).click()
    await layers.getByRole('button', { name: prefix + 'hidden', exact: true }).click()
    await layers.getByRole('button', { name: prefix + 'visible', exact: true }).waitFor()
  }
  await capture(page, 'mobile-390-map-layers.png')
  record('operations-map-layers', '/operations-map', page.viewportSize(), ['Guard, vehicle, site, and alert layers toggle off and on while preserving each fixture count'], 'mobile-390-map-layers.png', true)

  await context.close()
} catch (error) {
  results.fatal = error instanceof Error ? error.message : String(error)
} finally {
  await browser.close()
}

fs.writeFileSync(path.join(outputDir, 'audit-report.json'), JSON.stringify(results, null, 2))
if (results.pageErrors.length || results.consoleErrors.length || results.failedApiRequests.length || results.fatal || results.scenarioResults.some(result => !result.passed)) process.exitCode = 1
console.log(JSON.stringify(results, null, 2))
