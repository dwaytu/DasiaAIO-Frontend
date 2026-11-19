import { expect, test, type Page } from '@playwright/test'

const shifts = [
  { id: 'completed-1', site: 'Alpha post', time: '08:00', status: 'completed' },
  { id: 'completed-2', site: 'Bravo post', time: '09:00', status: 'completed' },
  { id: 'completed-3', site: 'Charlie post', time: '10:00', status: 'completed' },
  { id: 'attention', site: 'Needs cover post', time: '17:00', status: 'cancelled' },
].map(({ id, site, time, status }) => ({
  id,
  client_site: site,
  start_time: `2026-11-18T${time}:00+08:00`,
  end_time: '2026-11-18T18:00:00+08:00',
  status,
}))

async function installFixtures(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'sentinel-browser-fixture')
    localStorage.setItem('user', JSON.stringify({
      id: 'qa-superadmin', username: 'qa', email: 'qa@example.test',
      role: 'superadmin', legalConsentAccepted: true,
    }))
  })
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/guard-replacement/shifts') {
      await route.fulfill({ json: { total: shifts.length, page: 1, pageSize: 200, shifts } })
    } else if (path === '/api/audit/logs') {
      await route.fulfill({ json: { items: [], meta: { total: 0, page: 1 } } })
    } else if (path === '/api/audit/anomalies') {
      await route.fulfill({ json: { anomalies: [{ type: 'failed_burst', severity: 'high', actorName: 'Fixture actor', failedCount: 12 }] } })
    } else if (path === '/api/firearm-allocations/summary') {
      await route.fulfill({ json: {
        totalFirearms: 3, totalAllocationRecords: 5, activeCustody: 1, returnedAllocations: 2,
        verifiedActiveCustody: null, importedOrUnverifiedAllocations: 4,
        registerBreakdown: [
          { origin: 'application', active: 1, returned: 0, unverified: 0 },
          { origin: 'presentation', active: 0, returned: 1, unverified: 0 },
          { origin: 'imported', active: 0, returned: 1, unverified: 2 },
        ],
        availableFirearms: 1, custodyReviewFirearms: 1, eligibleGuards: 0, activeApprovedGuards: 2,
        guardsWithActivePermit: 1, guardsWithValidFirearmsTraining: 1,
      } })
    } else if (path === '/api/firearm-allocations/eligible-guards') {
      await route.fulfill({ json: { total: 0, guards: [] } })
    } else if (path === '/api/firearm-allocations') {
      const allocations = Array.from({ length: 5 }, (_, index) => ({
        id: `fixture-custody-${index}`, guardId: 'fixture-guard', firearmId: 'fixture-asset',
        guardName: 'Fixture guard', firearmSerialNumber: 'FIXTURE', allocationDate: '2026-11-18T00:00:00Z',
        status: index === 0 ? 'active' : index <= 2 ? 'returned' : 'imported',
      }))
      const status = new URL(route.request().url()).searchParams.get('status')
      const matches = allocations.filter((allocation) => !status || allocation.status === status)
      await route.fulfill({ json: { total: matches.length, allocations: matches } })
    } else {
      await route.fulfill({ json: [] })
    }
  })
}

for (const width of [1440, 768, 390, 320]) {
  test(`selected-date agenda filters and pages at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 })
    await page.clock.setFixedTime(new Date('2026-11-18T04:00:00Z'))
    await installFixtures(page)
    await page.goto('/calendar')
    const heading = page.getByRole('heading', { level: 1, name: 'Calendar', exact: true })
    const titleText = await heading.evaluate((element) => {
      const text = document.createRange()
      text.selectNodeContents(element)
      const { left, right, top, bottom } = text.getBoundingClientRect()
      return { left, right, top, bottom }
    })
    const themeButton = await page.getByRole('button', { name: /Switch to (dark|light) mode/ }).boundingBox()
    expect(themeButton).not.toBeNull()
    const overlapsThemeButton = themeButton && titleText.right > themeButton.x && titleText.left < themeButton.x + themeButton.width
      && titleText.bottom > themeButton.y && titleText.top < themeButton.y + themeButton.height
    expect(overlapsThemeButton).toBe(false)
    const pager = page.getByRole('navigation', { name: 'Selected date agenda pages' })
    const agenda = page.getByRole('region', { name: /November 18/ })
    const entries = agenda.getByRole('button').filter({ hasText: 'post' })
    await expect(entries).toHaveCount(3)
    await expect(entries.first()).toContainText('Needs cover post')
    await expect(pager.getByRole('button', { name: 'Previous' })).toBeDisabled()
    if (width < 768) await expect(page.getByLabel('Agenda date')).toBeVisible()
    await agenda.getByLabel('Event status').scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`agenda-${width}.png`) })
    const next = pager.getByRole('button', { name: 'Next' })
    await next.scrollIntoViewIfNeeded()
    await expect(pager).toBeInViewport()
    await page.screenshot({ path: info.outputPath(`pagination-${width}.png`) })
    await next.focus()
    await page.keyboard.press('Enter')
    await expect(entries).toHaveCount(1)
    await expect(entries.first()).toContainText('Charlie post')
    await agenda.getByLabel('Event status').selectOption('attention')
    await expect(pager).toContainText('Page 1 of 1')
    await expect(entries.first()).toContainText('Needs cover post')
    await agenda.getByLabel('Event status').selectOption('scheduled')
    await expect(agenda.getByText('No matching events')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('audit keeps the activity view while hiding anomaly signal details', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installFixtures(page)
  const anomalies = page.waitForResponse((response) => response.url().includes('/api/audit/anomalies'))
  await page.goto('/audit')
  await anomalies
  await expect(page.getByRole('heading', { name: 'Activity Heatmap (Hour of Day)' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Anomaly Signals' })).toHaveCount(0)
  await expect(page.getByText('Fixture actor')).toHaveCount(0)
  await page.getByRole('button', { name: /^Filters/ }).click()
  await expect(page.getByRole('option', { name: 'Scenario activity' })).toHaveAttribute('value', 'capstone_seed')
})

test('the allocation register explains why historical records do not imply new issuance eligibility', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installFixtures(page)
  await page.goto('/allocation')
  await expect(page.getByText('Eligible for new issuance', { exact: true })).toBeVisible()
  await expect(page.getByText('Imported or unverified records', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Verified active custody', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('table', { name: 'Register by origin and status' })).toHaveCount(0)
  await expect(page.getByText('No guards currently meet the issuance requirements.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Allocate firearm' })).toBeDisabled()
  await page.getByLabel('Filter allocations by status').selectOption('imported')
  await expect(page.getByText('Import record', { exact: true })).toHaveCount(2)
})

test('a qualified fixture guard can select an inert training asset and confirm in isolation', async ({ page }) => {
  await installFixtures(page)
  const summary = {
    totalFirearms: 1, totalAllocationRecords: 0, activeCustody: 0, returnedAllocations: 0,
    availableFirearms: 1, custodyReviewFirearms: 0, importedAllocations: 0, eligibleGuards: 1,
    activeApprovedGuards: 1, guardsWithActivePermit: 1, guardsWithValidFirearmsTraining: 1,
  }
  await page.route('**/api/firearm-allocations/summary', (route) => route.fulfill({ json: summary }))
  await page.route('**/api/firearm-allocations/eligible-guards?*', (route) => route.fulfill({ json: {
    total: 1, guards: [{ id: 'fixture-qualified', fullName: 'Fixture qualified guard' }],
  } }))
  await page.route('**/api/firearms?*', (route) => route.fulfill({ json: {
    firearms: [{ id: 'fixture-inert', model: 'Inert training asset', serialNumber: 'FIXTURE-ONLY', status: 'available' }],
  } }))
  await page.route('**/api/firearm-allocation/issue', (route) => {
    expect(route.request().postDataJSON()).toEqual({ guardId: 'fixture-qualified', firearmId: 'fixture-inert' })
    return route.fulfill({ status: 201, json: { id: 'fixture-allocation' } })
  })

  await page.goto('/allocation')
  await page.getByRole('button', { name: 'Allocate firearm' }).click()
  const form = page.getByRole('dialog', { name: 'Allocate firearm' })
  await form.getByLabel('Eligible guard').selectOption('fixture-qualified')
  await form.getByLabel('Available firearm').selectOption('fixture-inert')
  await form.getByRole('button', { name: 'Allocate firearm' }).click()
  await expect(page.getByText('Firearm allocated successfully.')).toBeVisible()
})
