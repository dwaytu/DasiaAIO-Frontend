import { expect, test, type Page, type Route } from '@playwright/test'

function installSession(page: Page) {
  return page.addInitScript(() => {
    localStorage.setItem('token', 'schedule-browser-token')
    localStorage.setItem('user', JSON.stringify({
      id: 'superadmin-1',
      email: 'superadmin@example.com',
      username: 'superadmin',
      fullName: 'Test Superadmin',
      role: 'superadmin',
      legalConsentAccepted: true,
    }))
    localStorage.setItem('dasi.toa.accepted.v1', 'accepted')
    localStorage.setItem('dasi.locationConsent.v1', 'accepted')
  })
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

test('scheduler searches guards and client sites while preserving the schedule payload', async ({ page }) => {
  let schedulePayload: Record<string, unknown> | null = null
  await installSession(page)

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname

    if (path === '/api/guards') {
      await fulfillJson(route, [{
        id: 'guard-uuid-47',
        full_name: 'CABANAG, REYSAN',
        username: 'reysan.cabanag',
        guard_code: 'G-0047',
        role: 'guard',
      }])
      return
    }
    if (path === '/api/guard-replacement/shifts' && request.method() === 'GET') {
      await fulfillJson(route, { shifts: [] })
      return
    }
    if (path === '/api/guard-replacement/shifts' && request.method() === 'POST') {
      schedulePayload = request.postDataJSON()
      await fulfillJson(route, { shiftId: 'shift-1' }, 201)
      return
    }
    if (path === '/api/tracking/client-sites') {
      await fulfillJson(route, { sites: [
        { id: 'site-1', name: 'Main Branch', address: 'Tagum City, Davao del Norte', isActive: true },
        { id: 'site-2', name: 'Davao Field Office', address: 'Bajada, Davao City', isActive: true },
      ] })
      return
    }
    if (path === '/api/users') {
      await fulfillJson(route, { users: [] })
      return
    }
    await fulfillJson(route, [])
  })

  await page.goto('/schedule')
  await expect(page.getByRole('heading', { name: 'All Guard Schedules' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Schedule' }).click()

  const dialog = page.getByRole('dialog', { name: 'Add New Schedule' })
  const guardSearch = dialog.getByRole('combobox', { name: 'Select Guard' })
  await guardSearch.click()
  const guardResults = dialog.getByRole('listbox', { name: 'Select Guard results' })
  await expect(guardResults.getByRole('option', { name: 'G-0047 - CABANAG, REYSAN' })).toBeVisible()
  await expect(guardResults).toHaveCSS('overflow-y', 'auto')

  const siteSearch = dialog.getByRole('combobox', { name: 'Select Client Site' })
  await siteSearch.click()
  await expect(dialog.getByRole('listbox', { name: 'Select Guard results' })).toHaveCount(0)

  const siteResults = dialog.getByRole('listbox', { name: 'Select Client Site results' })
  await expect(siteResults.getByRole('option', { name: /Main Branch.*Tagum City/i })).toBeVisible()
  await expect(siteResults.getByRole('option', { name: /Davao Field Office.*Bajada/i })).toBeVisible()
  await siteSearch.fill('tagum')
  await expect(siteResults.getByRole('option', { name: /Main Branch.*Tagum City/i })).toBeVisible()
  await expect(siteResults.getByRole('option', { name: /Davao Field Office/i })).toHaveCount(0)

  const siteResultsBox = await siteResults.boundingBox()
  const dateBox = await dialog.locator('input[type="date"]').boundingBox()
  expect(siteResultsBox).not.toBeNull()
  expect(dateBox).not.toBeNull()
  expect(dateBox!.y).toBeGreaterThanOrEqual(siteResultsBox!.y + siteResultsBox!.height)

  await siteSearch.press('ArrowDown')
  await siteSearch.press('Enter')
  await expect(siteSearch).toHaveValue('Main Branch')

  await guardSearch.click()
  await guardSearch.fill('g-0047')
  await dialog.getByRole('option', { name: 'G-0047 - CABANAG, REYSAN' }).click()

  await dialog.locator('input[type="date"]').fill('2026-10-05')
  await dialog.locator('input[type="time"]').nth(0).fill('08:00')
  await dialog.locator('input[type="time"]').nth(1).fill('17:00')
  await dialog.getByRole('button', { name: 'Create Schedule' }).click()

  await expect.poll(() => schedulePayload).not.toBeNull()
  expect(schedulePayload).toMatchObject({ guardId: 'guard-uuid-47', clientSite: 'Main Branch' })
})
