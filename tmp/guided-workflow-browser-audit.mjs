import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import assert from 'node:assert/strict'

const baseUrl = 'http://127.0.0.1:5173'
const outputDir = path.resolve('output/playwright/final-acceptance-2026-10-27')
fs.mkdirSync(outputDir, { recursive: true })

const roles = {
  superadmin: { id: 'qa-superadmin', email: 'superadmin@example.test', username: 'superadmin', fullName: 'QA Superadmin', role: 'superadmin', legalConsentAccepted: true },
  admin: { id: 'qa-admin', email: 'admin@example.test', username: 'admin', fullName: 'QA Admin', role: 'admin', legalConsentAccepted: true },
  supervisor: { id: 'qa-supervisor', email: 'supervisor@example.test', username: 'supervisor', fullName: 'QA Supervisor', role: 'supervisor', legalConsentAccepted: true },
  guard: { id: 'qa-guard', email: 'guard@example.test', username: 'guard', fullName: 'QA Guard', role: 'guard', legalConsentAccepted: true },
}
const fixtureNow = Date.parse('2026-11-18T08:00:00+08:00')
const shifts = [
  { id: 'qa-unassigned', start_time: new Date(fixtureNow + 30 * 60 * 1000).toISOString(), end_time: new Date(fixtureNow + 9 * 60 * 60 * 1000).toISOString(), client_site: 'North Gate', status: 'scheduled' },
  { id: 'qa-overnight', start_time: '2026-11-18T22:00:00+08:00', end_time: '2026-11-19T06:00:00+08:00', client_site: 'Night Gate', guard_id: 'guard-1', guard_name: 'QA Guard One', status: 'scheduled' },
  { id: 'qa-same-day', start_time: '2027-10-15T08:00:00+08:00', end_time: '2027-10-15T16:00:00+08:00', client_site: 'West Gate', guard_id: 'guard-2', guard_name: 'QA Guard Two', status: 'scheduled' },
  { id: 'qa-month-boundary', start_time: '2027-10-31T22:00:00+08:00', end_time: '2027-11-01T06:00:00+08:00', client_site: 'Month Gate', guard_id: 'guard-2', guard_name: 'QA Guard Two', status: 'scheduled' },
  { id: 'qa-overlap-a', start_time: '2027-12-31T22:00:00+08:00', end_time: '2028-01-01T06:00:00+08:00', client_site: 'East Gate', guard_id: 'guard-1', guard_name: 'QA Guard One', status: 'scheduled' },
  { id: 'qa-overlap-b', start_time: '2028-01-01T05:00:00+08:00', end_time: '2028-01-01T10:00:00+08:00', client_site: 'South Gate', guard_id: 'guard-1', guard_name: 'QA Guard One', status: 'scheduled' },
]
const guard = { id: 'guard-1', role: 'guard', full_name: 'QA Guard One', username: 'qa.guard.one', email: 'guard.one@example.test', phone_number: '09171234567', license_number: 'LIC-0042', guard_code: 'G-0042', status: 'active' }
const secondGuard = { id: 'guard-2', role: 'guard', full_name: 'QA Guard Two', username: 'qa.guard.two', email: 'guard.two@example.test', guard_code: 'G-0043', status: 'active' }
const report = {
  generatedAt: new Date().toISOString(), baseUrl, isolatedApi: true, productionDataTouched: false,
  scenarioResults: [], pageErrors: [], failedApiRequests: [], consoleErrors: [], blockedExternalResourceErrors: [], screenshotPaths: [],
  automatedValidation: null,
}

async function fulfill(route, payload) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) }) }
async function prepare(page, user, theme) {
  await page.addInitScript(({ user, theme }) => {
    localStorage.setItem('token', 'isolated-browser-audit-token')
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('sentinel-theme', theme)
    localStorage.setItem('dasi.locationConsent.v1', 'accepted')
  }, { user, theme })
  await page.route('**/api/**', async route => {
    const pathName = new URL(route.request().url()).pathname
    if (pathName.includes('/guard-replacement/shifts')) return fulfill(route, { total: shifts.length, page: 1, pageSize: 200, shifts })
    if (pathName === '/api/audit/logs') return fulfill(route, { items: [{ id: 'qa-audit-1', actor_name: 'QA Operator', actor_role: 'superadmin', action_key: 'firearm.read', entity_type: 'firearms', result: 'success', source: 'web', actor_attribution_mode: 'authenticated', created_at: '2026-10-27T08:00:00Z' }], meta: { total: 1, page: 1, page_size: 25, has_more: false } })
    if (pathName === '/api/users/pending-approvals') return fulfill(route, { users: [] })
    if (pathName === '/api/users') return fulfill(route, { users: [guard, secondGuard] })
    if (pathName.includes('/attendance/')) return fulfill(route, { attendance: [] })
    if (pathName.includes('/guard-allocations/')) return fulfill(route, { allocations: [] })
    if (pathName.includes('/guard-firearm-permits/')) return fulfill(route, { permits: [] })
    if (pathName.includes('/support-tickets/')) return fulfill(route, { tickets: [] })
    if (pathName.includes('/client-sites')) return fulfill(route, { sites: [{ id: 'site-1', name: 'North Gate', isActive: true }], items: [] })
    if (pathName.includes('/armored-cars')) return fulfill(route, { armored_cars: [] })
    if (pathName.includes('/firearms')) return fulfill(route, [])
    if (pathName.includes('/trips')) return fulfill(route, [])
    if (pathName.includes('/missions')) return fulfill(route, [])
    return fulfill(route, {})
  })
}
async function snap(page, name) {
  const file = path.join(outputDir, name)
  await page.screenshot({ path: file, fullPage: true })
  report.screenshotPaths.push(file)
}
const scenarioFilter = process.env.SENTINEL_AUDIT_SCENARIOS ? new RegExp(process.env.SENTINEL_AUDIT_SCENARIOS) : null
async function scenario(browser, { id, description, role, route, viewport, theme, name, assertions, action, authenticated = true, emptyShifts = false }) {
  if (scenarioFilter && !scenarioFilter.test(id)) return
  const context = await browser.newContext({ viewport, serviceWorkers: 'block', timezoneId: 'Asia/Manila', locale: 'en-US' })
  const page = await context.newPage()
  page.setDefaultTimeout(7000)
  if (route === '/calendar') await page.clock.setFixedTime(new Date(fixtureNow))
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (url.origin === baseUrl && !url.pathname.startsWith('/api/')) return route.continue()
    report.blockedExternalResourceErrors.push({ id, type: route.request().resourceType(), url: url.origin + url.pathname })
    return route.abort('blockedbyclient')
  })
  page.on('pageerror', error => report.pageErrors.push({ id, error: error.message }))
  page.on('console', message => {
    if (message.type() !== 'error') return
    const error = { id, text: message.text() }
    if (!message.text().includes('ERR_BLOCKED_BY_CLIENT')) report.consoleErrors.push(error)
  })
  page.on('requestfailed', request => { if (request.url().includes('/api/') && request.failure()?.errorText !== 'net::ERR_ABORTED') report.failedApiRequests.push({ id, url: request.url() }) })
  page.on('response', response => { if (response.url().includes('/api/') && response.status() >= 400) report.failedApiRequests.push({ id, url: response.url(), status: response.status() }) })
  if (authenticated) {
    await prepare(page, roles[role], theme)
  } else {
    await page.addInitScript((selectedTheme) => localStorage.setItem('sentinel-theme', selectedTheme), theme)
    await page.route('**/api/**', request => {
      if (new URL(request.request().url()).pathname === '/api/login' && role === 'guard') {
        return fulfill(request, { token: 'isolated-browser-audit-token', user: roles.guard })
      }
      return fulfill(request, {})
    })
  }
  if (emptyShifts) await page.route('**/api/guard-replacement/shifts**', request => fulfill(request, { total: 0, shifts: [] }))
  let result = { id, description, route, role, viewport, theme, passed: false, assertions, screenshotPath: null, failureMessage: null }
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
    await action(page)
    const file = path.join(outputDir, name); await page.screenshot({ path: file, fullPage: true })
    report.screenshotPaths.push(file); result.passed = true; result.screenshotPath = file
  } catch (error) {
    result.failureMessage = error instanceof Error ? error.message : String(error)
    const failurePath = path.join(outputDir, `${id}-failure.png`)
    await page.screenshot({ path: failurePath, fullPage: true })
    result.screenshotPath = failurePath
    report.screenshotPaths.push(failurePath)
  }
  report.scenarioResults.push(result)
  await context.close()
}

const browser = await chromium.launch({ headless: true })
try {
  await scenario(browser, { id: 'calendar-list-filter', description: 'Calendar/List switching preserves the selected event filter.', assertions: ['Guard Shift filter selected', 'List opens', 'Filter persists after returning to Calendar'], role: 'superadmin', route: '/calendar', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'desktop-superadmin-calendar-list.png', action: async page => {
    const filter = page.getByRole('button', { name: 'Guard Shift', exact: true })
    await filter.click()
    await page.getByRole('button', { name: 'List' }).click()
    await page.getByRole('region', { name: 'Schedule list' }).waitFor()
    if (await filter.getAttribute('aria-pressed') !== 'true') throw new Error('Shift filter not active in List')
    await snap(page, 'calendar-list-preserved-filter.png')
    await page.getByRole('group', { name: 'Calendar view' }).getByRole('button', { name: 'Calendar', exact: true }).click()
    if (await filter.getAttribute('aria-pressed') !== 'true') throw new Error('Shift filter lost on return to Calendar')
  } })
  await scenario(browser, { id: 'calendar-dark-tablet', description: 'Dark tablet Calendar List evidence.', assertions: ['List opens', 'Overnight label visible'], role: 'admin', route: '/calendar', viewport: { width: 1024, height: 900 }, theme: 'dark', name: 'tablet-admin-calendar-dark.png', action: async page => {
    await page.getByRole('button', { name: 'List' }).click(); await page.getByText('Overnight shift', { exact: true }).first().waitFor()
  } })
  await scenario(browser, { id: 'calendar-mobile-390', description: 'Supervisor calendar mobile reflow.', assertions: ['List opens at 390px'], role: 'supervisor', route: '/calendar', viewport: { width: 390, height: 844 }, theme: 'light', name: 'mobile-390-supervisor-calendar.png', action: async page => {
    await page.getByRole('button', { name: 'List' }).click(); await page.getByRole('region', { name: 'Schedule list' }).waitFor()
  } })
  await scenario(browser, { id: 'calendar-mobile-320', description: 'Calendar and List remain operable at 320px.', assertions: ['Calendar control is available', 'List opens at 320px', 'No document horizontal overflow'], role: 'admin', route: '/calendar', viewport: { width: 320, height: 844 }, theme: 'dark', name: 'mobile-320-admin-calendar-list.png', action: async page => {
    await page.getByRole('button', { name: 'List' }).click()
    await page.getByRole('region', { name: 'Schedule list' }).waitFor()
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Document overflows at 320px')
  } })
  await scenario(browser, { id: 'schedule-needs-assignment', description: 'Needs assignment filters the list to an intercepted unassigned shift.', assertions: ['Needs assignment opens List', 'Unassigned record is visible', 'Assign guard handoff is available'], role: 'superadmin', route: '/calendar', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'schedule-needs-assignment.png', action: async page => {
    await page.getByRole('button', { name: /Needs assignment/i }).click()
    await page.getByText('Unassigned', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Assign guard' }).waitFor()
  } })
  await scenario(browser, { id: 'schedule-assignment-cancel', description: 'Follow assignment handoff to the matching schedule and cancel without mutation.', assertions: ['Calendar handoff navigates to Schedule', 'North Gate edit interface opens', 'Cancel sends no mutation', 'Focus returns to edit trigger'], role: 'superadmin', route: '/calendar', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'assignment-cancel.png', action: async page => {
    let mutations = 0
    page.on('request', request => { if (request.url().includes('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations += 1 })
    await page.getByRole('button', { name: /Needs assignment/i }).click()
    await page.getByRole('button', { name: 'Assign guard' }).click()
    await page.waitForURL('**/schedule')
    const row = page.getByRole('row').filter({ hasText: 'North Gate' })
    const edit = row.getByRole('button', { name: 'Edit schedule' })
    await edit.click()
    await page.getByRole('heading', { name: 'Edit Schedule' }).waitFor()
    await snap(page, 'assignment-before-cancel.png')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    if (mutations) throw new Error(`Unexpected mutation requests: ${mutations}`)
    if (!await edit.evaluate(node => document.activeElement === node)) throw new Error('Focus did not return to schedule edit trigger after cancellation')
  } })
  await scenario(browser, { id: 'schedule-starting-soon', description: 'Starting soon filters records using the loaded shift times.', assertions: ['Near-future fixture appears', 'Distant fixtures are absent'], role: 'admin', route: '/calendar', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'schedule-starting-soon.png', action: async page => {
    await page.getByRole('button', { name: /Starting soon/i }).click()
    const list = page.getByRole('region', { name: 'Schedule list' })
    await list.getByText('North Gate').first().waitFor()
    assert.equal(await list.locator('article').count(), 1)
  } })
  await scenario(browser, { id: 'schedule-list-order-and-empty', description: 'Calendar list groups loaded shifts by date in chronological order and reports an empty filter.', assertions: ['Fixture sites are in chronological order', 'Date group headings exist', 'Same-day, month-boundary and year-boundary formatting', 'A filter without matching events shows an empty state'], role: 'admin', route: '/calendar', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'schedule-list-empty.png', action: async page => {
    await page.getByRole('button', { name: 'List', exact: true }).click()
    const list = page.getByRole('region', { name: 'Schedule list' })
    await list.getByText('South Gate').first().waitFor()
    const titles = await list.locator('article > div > div:first-child > p:first-child').allTextContents()
    assert.deepEqual(titles, ['North Gate', 'Night Gate', 'West Gate', 'Month Gate', 'East Gate', 'South Gate'])
    if (await list.locator('section > h3').count() < 2) throw new Error('Expected separate date group headings')
    const overnight = list.locator('article').filter({ hasText: 'East Gate' })
    const overnightText = await overnight.innerText()
    if (!overnightText.includes('2027') || !overnightText.includes('2028') || !/overnight shift/i.test(overnightText)) throw new Error(`Year-boundary dates or overnight label missing: ${overnightText}`)
    const monthText = await list.locator('article').filter({ hasText: 'Month Gate' }).innerText()
    if (!/October 31/i.test(monthText) || !/November 1/i.test(monthText) || !/overnight shift/i.test(monthText)) throw new Error(`Month-boundary shift formatting missing: ${monthText}`)
    const sameDay = await list.locator('article').filter({ hasText: 'West Gate' }).innerText()
    assert.match(sameDay, /October 15.*08:00 AM.*04:00 PM/i)
    assert.match(sameDay, /QA Guard Two/)
    assert.doesNotMatch(sameDay, /overnight shift/i)
    assert.match(await list.locator('article').filter({ hasText: 'Night Gate' }).innerText(), /November 18.*10:00 PM.*November 19.*06:00 AM[\s\S]*overnight shift/i)
    assert.match(await list.locator('article').filter({ hasText: 'North Gate' }).innerText(), /unassigned/i)
    await snap(page, 'schedule-list-year-boundary.png')
    await page.getByRole('button', { name: 'Mission', exact: true }).click()
    await list.getByText('No scheduled items').waitFor()
  } })
  await scenario(browser, { id: 'schedule-no-data', description: 'Calendar List gives an empty state for a loaded empty schedule.', assertions: ['No records shown after an empty response'], role: 'admin', route: '/calendar', viewport: { width: 1024, height: 900 }, theme: 'light', name: 'schedule-no-data.png', emptyShifts: true, action: async page => {
    await page.getByRole('button', { name: 'List', exact: true }).click()
    const list = page.getByRole('region', { name: 'Schedule list' })
    await list.getByText('No scheduled items').waitFor()
    assert.equal(await list.locator('article').count(), 0)
  } })
  for (const width of [1440, 1024, 390, 320]) {
    await scenario(browser, { id: `calendar-reflow-${width}`, description: 'Calendar and List allow scrolling to lower content at this width.', assertions: ['Month controls and lower calendar content reachable', 'Last list record reachable', 'Both views fit their main scroll container'], role: 'admin', route: '/calendar', viewport: { width, height: width >= 1024 ? 900 : 844 }, theme: width === 1024 ? 'dark' : 'light', name: `calendar-list-lower-${width}.png`, action: async page => {
      const main = page.locator('main')
      const views = page.getByRole('group', { name: 'Calendar view' })
      assert.equal(await views.getByRole('button', { name: 'Calendar', exact: true }).getAttribute('aria-pressed'), 'true')
      await page.getByRole('button', { name: 'Next month' }).click({ trial: true })
      const lower = width < 768 ? page.getByRole('heading', { name: 'Mobile Agenda' }) : page.getByText(/scheduled$/).last()
      await lower.scrollIntoViewIfNeeded()
      assert.ok(await lower.isVisible())
      assert.ok(await main.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
      await snap(page, `calendar-lower-${width}.png`)
      await views.getByRole('button', { name: 'List', exact: true }).click()
      const lastShift = page.getByRole('region', { name: 'Schedule list' }).locator('article').last()
      await lastShift.getByRole('button', { name: 'View shift' }).click({ trial: true })
      assert.match(await lastShift.innerText(), /South Gate/)
      assert.ok(await main.evaluate(el => el.scrollWidth <= el.clientWidth + 1))
    } })
  }
  await scenario(browser, { id: 'schedule-overlaps', description: 'Overlap summary identifies exactly the affected assignments.', assertions: ['Summary count is two affected shifts', 'Both overlapping sites appear', 'Non-overlapping comparison is excluded', 'Warning makes no claim of backend rejection', 'Affected records can be opened'], role: 'superadmin', route: '/calendar', viewport: { width: 1440, height: 1000 }, theme: 'dark', name: 'schedule-overlaps.png', action: async page => {
    const summary = page.getByRole('button', { name: /Overlapping shifts/i })
    if (!/\(2\)/.test(await summary.innerText())) throw new Error('Overlap count did not equal two affected shifts')
    await summary.click()
    const list = page.getByRole('region', { name: 'Schedule list' })
    await list.getByText('East Gate').first().waitFor(); await list.getByText('South Gate').first().waitFor()
    if (await list.getByText('West Gate').count()) throw new Error('Non-overlapping comparison shift appeared')
    if (await list.getByText('Overlapping shifts', { exact: true }).count() !== 2) throw new Error('Both overlap warnings were not visible')
    if (/reject/i.test(await list.innerText())) throw new Error('UI incorrectly claims backend rejection')
    await snap(page, 'schedule-overlaps-list.png')
    await list.locator('article').filter({ hasText: 'East Gate' }).getByRole('button', { name: 'View shift' }).click()
    if (!await page.getByRole('dialog', { name: 'Shift details' }).isVisible()) throw new Error('Affected record did not open')
  } })
  await scenario(browser, { id: 'people-search', description: 'Guard roster search filters by guard number and can be cleared.', assertions: ['Search returns only the matching guard', 'Clearing restores both fixture guards'], role: 'superadmin', route: '/manage', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'desktop-superadmin-guard-search.png', action: async page => {
    const details = page.getByRole('button', { name: /view details for qa guard one/i })
    await details.waitFor()
    await page.getByRole('button', { name: /view details for qa guard two/i }).waitFor()
    await page.getByRole('searchbox', { name: 'Search guard roster' }).fill('G-0042')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    assert.ok(await details.isVisible())
    if (await page.getByRole('button', { name: /view details for qa guard two/i }).count()) throw new Error('Search did not filter second guard')
    await page.getByRole('searchbox', { name: 'Search guard roster' }).fill('')
    await page.getByRole('button', { name: 'Search', exact: true }).click()
    await page.getByRole('button', { name: /view details for qa guard two/i }).waitFor()
  } })
  await scenario(browser, { id: 'people-details-desktop', description: 'Guard details opens for the fixture guard and restores exact focus.', assertions: ['Correct fixture name and guard number', 'Focus enters the dialog', 'Escape closes and restores focus to the originating button'], role: 'superadmin', route: '/manage', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'desktop-superadmin-guard-details.png', action: async page => {
    const details = page.getByRole('button', { name: /view details for qa guard one/i })
    await details.click()
    const dialog = page.getByRole('dialog', { name: /guard details: qa guard one/i })
    await dialog.waitFor()
    if (!await dialog.evaluate(node => node.contains(document.activeElement))) throw new Error('Focus did not enter details')
    await dialog.getByText('G-0042', { exact: true }).waitFor()
    await snap(page, 'guard-details-desktop-open.png')
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.ok(await details.evaluate(node => document.activeElement === node))
  } })
  await scenario(browser, { id: 'people-removal-cancel', description: 'Cancelling the fixture guard removal preserves the roster.', assertions: ['Confirmation identifies the fixture guard', 'Cancel restores focus to Remove guard', 'Guard remains in roster', 'No mutation sent'], role: 'superadmin', route: '/manage', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'people-removal-cancel.png', action: async page => {
    const details = page.getByRole('button', { name: /view details for qa guard one/i })
    let mutations = 0
    page.on('request', request => { if (request.url().includes('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations += 1 })
    await details.click()
    const dialog = page.getByRole('dialog', { name: /guard details: qa guard one/i })
    const remove = dialog.getByRole('button', { name: 'Remove guard' })
    await remove.click()
    const confirmation = page.getByRole('dialog', { name: 'Remove guard account?' })
    await confirmation.getByText(/QA Guard One.*G-0042/).waitFor()
    await snap(page, 'guard-removal-confirmation.png')
    await confirmation.getByRole('button', { name: 'Cancel' }).click()
    await confirmation.waitFor({ state: 'hidden' })
    assert.ok(await remove.evaluate(node => document.activeElement === node))
    await page.keyboard.press('Escape')
    await details.waitFor()
    if (!await details.evaluate(node => document.activeElement === node)) throw new Error('Focus did not return to details trigger')
    if (mutations) throw new Error(`Unexpected mutation requests: ${mutations}`)
  } })
  await scenario(browser, { id: 'people-supervisor-mobile', description: 'Supervisor mobile permission boundary.', assertions: ['Details opens', 'Remove unavailable'], role: 'supervisor', route: '/manage', viewport: { width: 390, height: 844 }, theme: 'dark', name: 'mobile-390-supervisor-guard-details.png', action: async page => {
    await page.getByRole('button', { name: /view details for qa guard one/i }).click()
    const dialog = page.getByRole('dialog', { name: /guard details/i })
    await dialog.waitFor()
    await dialog.getByRole('button', { name: 'Edit details' }).waitFor()
    if (await dialog.getByRole('button', { name: 'Remove guard' }).count()) throw new Error('Supervisor exposed removal')
  } })
  for (const [id, actionLabel, title] of [
    ['people-edit-cancel', 'Edit details', 'Edit User: guard.one@example.test'],
    ['people-password-cancel', 'Reset password', 'Set temporary password'],
  ]) {
    await scenario(browser, { id, description: `Open ${actionLabel} for the fixture guard and cancel safely.`, assertions: ['The editor identifies the same fixture guard', 'Close restores focus to the roster or details action', 'No account mutation request'], role: 'superadmin', route: '/manage', viewport: { width: 1440, height: 1000 }, theme: 'light', name: `${id}.png`, action: async page => {
      const writes = []
      page.on('request', request => {
        if (new URL(request.url()).pathname.startsWith('/api/users/') && !['GET', 'OPTIONS'].includes(request.method())) writes.push(request.method())
      })
      const trigger = page.getByRole('button', { name: /view details for qa guard one/i })
      await trigger.click()
      const action = page.getByRole('dialog', { name: /guard details: qa guard one/i }).getByRole('button', { name: actionLabel })
      await action.click()
      const dialog = page.getByRole('dialog', { name: title, exact: true })
      await dialog.waitFor()
      if (id === 'people-password-cancel') {
        await dialog.getByText('Guard account: QA Guard One', { exact: true }).waitFor()
        await dialog.getByLabel('Confirm temporary password', { exact: true }).waitFor()
      }
      await dialog.getByRole('button', { name: 'Close dialog' }).click()
      await dialog.waitFor({ state: 'hidden' })
      assert.deepEqual(writes, [])
      assert.ok(await trigger.evaluate(el => document.activeElement === el) ||
        (await action.count() && await action.evaluate(el => document.activeElement === el)), 'Account editor dropped focus on close')
    } })
  }
  await scenario(browser, { id: 'people-confirmation-escape', description: 'Escape dismisses only the removal confirmation and restores focus to its trigger.', assertions: ['Confirmation closes with Escape', 'Guard details remains open', 'Focus returns to Remove guard'], role: 'superadmin', route: '/manage', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'people-confirmation-escape.png', action: async page => {
    await page.getByRole('button', { name: /view details for qa guard one/i }).click()
    const details = page.getByRole('dialog', { name: /guard details: qa guard one/i })
    const remove = details.getByRole('button', { name: 'Remove guard' })
    await remove.click()
    await page.getByRole('dialog', { name: 'Remove guard account?' }).waitFor()
    await page.keyboard.press('Escape')
    if (await page.getByRole('dialog', { name: 'Remove guard account?' }).count()) throw new Error('Confirmation remained open')
    if (!await details.count()) throw new Error('Escape also closed the guard details')
    if (!await remove.evaluate(node => document.activeElement === node)) throw new Error('Focus did not return to Remove guard')
  } })
  for (const width of [320, 390]) {
    await scenario(browser, { id: `people-details-${width}`, description: 'Guard details internal scrolling and controls on a narrow screen.', assertions: ['Details dialog visible', 'No horizontal overflow in dialog', 'Internal content scrolled to bottom', 'Actions and close remain reachable'], role: 'admin', route: '/manage', viewport: { width, height: 700 }, theme: 'light', name: `people-details-${width}.png`, action: async page => {
      await page.getByRole('button', { name: /view details for qa guard one/i }).click()
      const dialog = page.getByRole('dialog', { name: /guard details: qa guard one/i })
      await dialog.waitFor()
      if (await dialog.evaluate(node => node.scrollWidth > node.clientWidth + 1)) throw new Error('Dialog overflows horizontally')
      const body = dialog.locator('.overflow-y-auto')
      await body.evaluate(node => { node.scrollTop = node.scrollHeight })
      await dialog.getByRole('button', { name: 'Edit details' }).scrollIntoViewIfNeeded()
      if (!await dialog.getByRole('button', { name: 'Edit details' }).isVisible()) throw new Error('Edit action unavailable')
      if (!await dialog.getByRole('button', { name: 'Close dialog' }).isVisible()) throw new Error('Close unavailable')
      for (const label of ['Edit details', 'Reset password', 'Remove guard', 'Close dialog']) {
        const control = dialog.getByRole('button', { name: label })
        await control.scrollIntoViewIfNeeded()
        const unobscured = await control.evaluate(node => {
          const bounds = node.getBoundingClientRect()
          const hit = document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
          return bounds.top >= 0 && bounds.bottom <= window.innerHeight && !!hit && (hit === node || node.contains(hit))
        })
        if (!unobscured) throw new Error(`${label} is clipped or covered`)
      }
      await snap(page, `people-details-${width}-lower.png`)
    } })
  }
  await scenario(browser, { id: 'guard-guide-persistence', description: 'Guard guide steps, skip and completion.', assertions: ['First step', 'Next', 'Skip', 'Manual reopen', 'Complete'], role: 'guard', route: '/overview', viewport: { width: 320, height: 844 }, theme: 'dark', name: 'mobile-320-guard-guide.png', action: async page => {
    await page.getByRole('heading', { name: /check in starts a routine shift/i }).waitFor()
    await snap(page, 'guard-guide-first-step-320.png')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.getByRole('button', { name: 'Skip guide' }).click()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Open quick guide' }).waitFor()
    if (await page.getByRole('heading', { name: /check in starts a routine shift/i }).count()) throw new Error('Guide reopened after dismissal')
    await page.getByRole('button', { name: 'Open quick guide' }).click()
    for (let step = 0; step < 4; step += 1) await page.getByRole('button', { name: 'Next' }).click()
    await snap(page, 'guard-guide-final-step-320.png')
    await page.getByRole('button', { name: 'Complete guide' }).click()
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Open quick guide' }).waitFor()
    if (await page.getByRole('heading', { name: /check in starts a routine shift/i }).count()) throw new Error('Guide reopened after completion')
    await page.getByRole('button', { name: 'Open quick guide' }).click()
    await page.getByRole('heading', { name: /check in starts a routine shift/i }).waitFor()
  } })
  await scenario(browser, { id: 'guard-guide-first-login', description: 'First sign-in through the intercepted login API presents the guide.', assertions: ['Fixture login request completed', 'Step 1 of 5 appears in a fresh context', 'SOS remains accessible'], role: 'guard', authenticated: false, route: '/login', viewport: { width: 390, height: 844 }, theme: 'light', name: 'guard-guide-first-login.png', action: async page => {
    await page.locator('#identifier').fill(roles.guard.email)
    await page.locator('#password').fill('Fixture-only password')
    const [login] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/api/login'),
      page.locator('form button[type="submit"]').click(),
    ])
    assert.equal(login.status(), 200)
    await page.getByText('Step 1 of 5', { exact: true }).waitFor()
    await page.getByRole('button', { name: /emergency sos/i }).click({ trial: true })
  } })
  await scenario(browser, { id: 'guard-guide-390', description: 'Guard guide is visible and non-overflowing at 390px.', assertions: ['Step 1 of 5 visible', 'SOS remains rendered', 'No horizontal overflow'], role: 'guard', route: '/overview', viewport: { width: 390, height: 844 }, theme: 'light', name: 'mobile-390-guard-guide.png', action: async page => {
    await page.getByText('Step 1 of 5').waitFor()
    await page.getByRole('button', { name: /emergency sos/i }).waitFor()
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Guide overflows at 390px')
  } })
  await scenario(browser, { id: 'guard-guide-keyboard-safety', description: 'Keyboard navigation distinguishes routine check-in from emergency SOS and does not send an incident.', assertions: ['First step describes check-in as routine attendance', 'Keyboard advances and goes back with focus within the guide', 'Step changes are announced and no step advances on its own', 'SOS remains outside the inline guide', 'Skipping leaves consent unchanged and sends no incident'], role: 'guard', route: '/overview', viewport: { width: 390, height: 844 }, theme: 'dark', name: 'guard-guide-keyboard-safety.png', action: async page => {
    let incidentPosts = 0
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/incidents' && request.method() === 'POST') incidentPosts += 1 })
    const guide = page.locator('aside[aria-labelledby="guard-guide-title"]')
    await guide.waitFor()
    if (!/attendance/i.test(await guide.innerText()) || !/not an emergency action/i.test(await guide.innerText())) throw new Error('Check-in guidance does not distinguish emergencies')
    if (!await guide.locator('[aria-live="polite"]').count()) throw new Error('Step changes are not announced')
    const consentBefore = await page.evaluate(() => localStorage.getItem('dasi.locationConsent.v1'))
    const next = guide.getByRole('button', { name: 'Next' })
    await next.focus(); await page.keyboard.press('Enter')
    await guide.getByText('Step 2 of 5').waitFor()
    assert.ok(await guide.evaluate(el => el.contains(document.activeElement)))
    await page.clock.install()
    await page.clock.fastForward(60_000)
    assert.ok(await guide.getByText('Step 2 of 5').isVisible())
    await guide.getByRole('button', { name: 'Back' }).focus(); await page.keyboard.press('Enter')
    await guide.getByText('Step 1 of 5').waitFor()
    await page.getByRole('button', { name: /emergency sos/i }).click({ trial: true })
    assert.equal(await guide.getByRole('button', { name: /emergency sos/i }).count(), 0)
    await guide.getByRole('button', { name: 'Skip guide' }).click()
    const consentAfter = await page.evaluate(() => localStorage.getItem('dasi.locationConsent.v1'))
    if (consentBefore !== consentAfter || incidentPosts !== 0) throw new Error('Guide changed consent or sent an SOS')
  } })
  await scenario(browser, { id: 'guard-guide-landscape', description: 'Guard guide controls fit a narrow landscape viewport.', assertions: ['Skip, Back, Next visible', 'No horizontal overflow'], role: 'guard', route: '/overview', viewport: { width: 844, height: 390 }, theme: 'dark', name: 'landscape-guard-guide.png', action: async page => {
    await page.getByRole('button', { name: 'Skip guide' }).waitFor()
    await page.getByRole('button', { name: 'Back' }).waitFor()
    await page.getByRole('button', { name: 'Next' }).waitFor()
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Guide overflows in landscape')
  } })
  for (const viewport of [{ width: 320, height: 844 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await scenario(browser, { id: `guide-controls-hit-test-${viewport.width}x${viewport.height}`, description: 'Guide buttons remain reachable without fixed UI covering them.', assertions: ['Skip, Next, Back, and Complete are reachable when scrolled into view', 'All five steps can be reached', 'SOS is reachable without overlap', 'Escape closes the inline guide and preserves consent', 'Reopening moves focus to step one', 'No horizontal overflow'], role: 'guard', route: '/overview', viewport, theme: 'light', name: `guide-hit-test-${viewport.width}x${viewport.height}.png`, action: async page => {
      const guide = page.locator('aside[aria-labelledby="guard-guide-title"]')
      await guide.waitFor()
      for (const label of ['Skip guide', 'Next', 'Back']) {
        if (label === 'Back') await guide.getByRole('button', { name: 'Next' }).click()
        const button = guide.getByRole('button', { name: label })
        await button.scrollIntoViewIfNeeded()
        const result = await button.evaluate(node => {
          const rect = node.getBoundingClientRect()
          const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
          const main = document.querySelector('#maincontent')
          return { visible: rect.top >= 0 && rect.bottom <= innerHeight, hit: !!target && (target === node || node.contains(target)), rect: { top: rect.top, bottom: rect.bottom }, target: target?.outerHTML.slice(0, 200), main: main && { rect: { top: main.getBoundingClientRect().top, bottom: main.getBoundingClientRect().bottom }, height: getComputedStyle(main).height, scrollTop: main.scrollTop, scrollHeight: main.scrollHeight } }
        })
        if (!result.visible || !result.hit) throw new Error(`${label} clipped or covered: ${JSON.stringify(result)}`)
      }
      const sos = page.getByRole('button', { name: /emergency sos/i })
      const sosHit = await sos.evaluate(node => {
        const rect = node.getBoundingClientRect()
        const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
        return !!target && (target === node || node.contains(target))
      })
      if (!sosHit) throw new Error('SOS control is covered')
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      for (const step of [3, 4, 5]) {
        await guide.getByRole('button', { name: 'Next' }).click()
        await guide.getByText(`Step ${step} of 5`, { exact: true }).waitFor()
      }
      await guide.getByRole('button', { name: 'Complete guide' }).click({ trial: true })
      const consent = await page.evaluate(() => localStorage.getItem('dasi.locationConsent.v1'))
      await guide.getByRole('button', { name: 'Back' }).focus()
      await page.keyboard.press('Escape')
      await guide.waitFor({ state: 'hidden' })
      assert.equal(await page.evaluate(() => localStorage.getItem('dasi.locationConsent.v1')), consent)
      await page.getByRole('button', { name: 'Open quick guide' }).click()
      await page.waitForFunction(() => document.activeElement?.matches('aside[aria-labelledby="guard-guide-title"]'))
      await guide.getByText('Step 1 of 5').waitFor()
      await guide.getByRole('button', { name: 'Next' }).click({ trial: true })
    } })
  }
  await scenario(browser, { id: 'profile-technical-disclosure', description: 'Profile metadata remains collapsed until opened with the keyboard.', assertions: ['Technical account information is a native disclosure', 'Keyboard toggles metadata'], role: 'guard', route: '/profile', viewport: { width: 390, height: 844 }, theme: 'light', name: 'profile-technical-disclosure.png', action: async page => {
    const disclosure = page.locator('details').filter({ hasText: 'Technical account information' }).first()
    await disclosure.waitFor(); if (await disclosure.evaluate(node => node.open)) throw new Error('Metadata disclosure opened by default')
    await disclosure.locator('summary').focus(); await page.keyboard.press(' ')
    if (!await disclosure.evaluate(node => node.open)) throw new Error('Keyboard did not open metadata disclosure')
  } })
  await scenario(browser, { id: 'login-password-help', description: 'Login password visibility and account-help guidance.', assertions: ['Show and Hide switch password visibility', 'Caps Lock warning updates on keyboard events', 'Account-help guidance visible'], role: 'unauthenticated', authenticated: false, route: '/login', viewport: { width: 390, height: 844 }, theme: 'light', name: 'login-password-help.png', action: async page => {
    const password = page.locator('#password')
    await password.waitFor(); await password.fill('example-password')
    const toggle = page.getByRole('button', { name: /show password/i }); await toggle.click()
    if (await password.getAttribute('type') !== 'text') throw new Error('Password visibility did not toggle')
    await page.getByRole('button', { name: /hide password/i }).click()
    assert.equal(await password.getAttribute('type'), 'password')
    await password.dispatchEvent('keydown', { key: 'A', modifierCapsLock: true })
    await page.getByRole('status').filter({ hasText: 'Caps Lock is on.' }).waitFor()
    await password.dispatchEvent('keyup', { key: 'a', modifierCapsLock: false })
    await page.getByText('Caps Lock is on.', { exact: true }).waitFor({ state: 'hidden' })
    await page.getByText('Contact your administrator', { exact: true }).waitFor()
  } })
  await scenario(browser, { id: 'mdr-workflow', description: 'MDR import steps, review action and separate danger zone.', assertions: ['Import Agency Records heading visible', 'All three steps visible', 'Review changes button visible', 'Danger zone is separate and collapsed'], role: 'superadmin', route: '/mdr-import', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'mdr-workflow.png', action: async page => {
    await page.getByText('Import Agency Records', { exact: true }).waitFor()
    const steps = page.getByRole('list', { name: 'Import steps' })
    for (const name of ['1. Select file', '2. Review changes', '3. Import records']) await steps.getByText(name, { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Review changes', exact: true }).waitFor()
    const danger = page.locator('details').filter({ hasText: 'Danger zone' })
    if (await danger.evaluate(node => node.open)) throw new Error('Danger zone unexpectedly expanded')
  } })
  await scenario(browser, { id: 'activity-history-disclosure', description: 'Activity History refresh and technical disclosure.', assertions: ['Activity History heading and fixture actor visible', 'Refresh requests audit records again', 'Technical details opens and closes via keyboard'], role: 'superadmin', route: '/audit', viewport: { width: 1440, height: 1000 }, theme: 'light', name: 'activity-history-technical.png', action: async page => {
    let auditRequests = 0
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/audit/logs') auditRequests += 1 })
    await page.getByRole('heading', { name: 'Activity History' }).waitFor()
    const row = page.getByRole('button').filter({ hasText: 'QA Operator' }).first()
    await row.waitFor()
    const before = auditRequests
    await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === '/api/audit/logs'),
      page.getByRole('button', { name: 'Refresh activity' }).click(),
    ])
    if (auditRequests <= before) throw new Error('Refresh did not request audit records')
    await row.click()
    const disclosure = page.locator('details').filter({ hasText: 'Technical details' })
    await disclosure.waitFor()
    await disclosure.locator('summary').focus(); await page.keyboard.press('Enter')
    if (!await disclosure.evaluate(node => node.open)) throw new Error('Technical details did not open')
    await snap(page, 'activity-history-technical-open.png')
    await page.keyboard.press('Enter')
    if (await disclosure.evaluate(node => node.open)) throw new Error('Technical details did not close')
  } })
  await scenario(browser, { id: 'quick-actions-primary', description: 'Quick action controls render for the command dashboard.', assertions: ['Assign Shift', 'Start Trip', 'Create Mission controls are visible'], role: 'superadmin', route: '/dashboard', viewport: { width: 1440, height: 1000 }, theme: 'dark', name: 'quick-actions-dark.png', action: async page => {
    await page.getByRole('button', { name: /assign shift/i }).waitFor()
    await page.getByRole('button', { name: /start trip/i }).waitFor()
    await page.getByRole('button', { name: /create mission/i }).waitFor()
  } })
  for (const role of ['admin', 'superadmin']) {
    for (const theme of ['light', 'dark']) {
      await scenario(browser, { id: `quick-actions-colors-${role}-${theme}`, description: 'Computed quick-action icon colors match semantic theme tokens.', assertions: ['Primary, resource, approval and caution icon background, text and border match computed semantic tokens'], role, route: '/dashboard', viewport: { width: 1440, height: 1000 }, theme, name: `quick-actions-${role}-${theme}.png`, action: async page => {
        const actions = {
          'Assign Shift': 'accent', 'Start Trip': 'accent', 'Create Mission': 'accent',
          'Allocate Firearm': 'info', 'Assign Vehicle': 'info', 'Approve Guard': 'success', 'End Trip': 'warning',
        }
        for (const [label, token] of Object.entries(actions)) {
          const button = page.getByRole('button', { name: label, exact: true })
          await button.waitFor()
          const comparison = await button.locator('span').first().evaluate((element, tokenName) => {
            const actual = getComputedStyle(element)
            const probe = document.createElement('span')
            probe.style.backgroundColor = `var(--color-${tokenName}-bg)`
            probe.style.color = `var(--color-${tokenName}-text)`
            probe.style.borderColor = `var(--color-${tokenName}-border)`
            document.body.appendChild(probe)
            const expected = getComputedStyle(probe)
            const result = { actual: [actual.backgroundColor, actual.color, actual.borderColor], expected: [expected.backgroundColor, expected.color, expected.borderColor] }
            probe.remove()
            return result
          }, token)
          if (JSON.stringify(comparison.actual) !== JSON.stringify(comparison.expected)) throw new Error(`${label}: ${JSON.stringify(comparison)}`)
        }
      } })
    }
  }
} catch (error) { report.fatal = error instanceof Error ? error.message : String(error) }
finally { await browser.close() }
report.operationalAuditSource = path.join(outputDir, 'operational', 'audit-report.json')
const validationPath = path.join(outputDir, 'automated-validation.json')
if (!scenarioFilter) {
  if (fs.existsSync(validationPath)) report.automatedValidation = JSON.parse(fs.readFileSync(validationPath, 'utf8'))
  if (!report.automatedValidation || Object.values(report.automatedValidation).some(check => check.exitCode !== 0)) {
    report.fatal ||= 'Successful automated validation evidence is missing'
  }
  if (fs.existsSync(report.operationalAuditSource)) {
    const operational = JSON.parse(fs.readFileSync(report.operationalAuditSource, 'utf8'))
    report.operationalScenarioResults = operational.scenarioResults
    report.screenshotPaths.push(...operational.scenarioResults.map(result => result.screenshotPath))
    for (const field of ['pageErrors', 'consoleErrors', 'failedApiRequests']) report[field].push(...operational[field])
    if (operational.fatal || operational.scenarioResults.some(result => !result.passed)) report.fatal ||= 'Separate operational audit failed'
  } else report.fatal ||= 'Separate operational audit evidence is missing'
  const pdfEvidencePath = path.join(outputDir, 'operational', 'dtr-pdf-verification.json')
  if (fs.existsSync(pdfEvidencePath)) {
    report.dtrPdfVerification = JSON.parse(fs.readFileSync(pdfEvidencePath, 'utf8'))
    const printPages = report.dtrPdfVerification.pages.map((_, index) => path.join(outputDir, 'operational', `print-page-${index + 1}.png`))
    const renderedPrintPages = printPages.filter(file => fs.existsSync(file))
    report.dtrPdfVerification.renderedPages = renderedPrintPages
    report.screenshotPaths.push(...renderedPrintPages)
  }
  if (!report.dtrPdfVerification?.passed) report.fatal ||= 'Printed PDF pagination evidence is missing'
  if (report.screenshotPaths.some(file => !fs.existsSync(file))) report.fatal ||= 'A screenshot listed in the audit is missing'
}
fs.writeFileSync(path.join(outputDir, scenarioFilter ? 'targeted-audit-report.json' : 'audit-report.json'), JSON.stringify(report, null, 2))
for (const result of report.scenarioResults) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.id}${result.failureMessage ? ' — ' + result.failureMessage : ''}`)
if (report.fatal || report.pageErrors.length || report.failedApiRequests.length || report.consoleErrors.length || report.scenarioResults.some(result => !result.passed)) process.exitCode = 1

