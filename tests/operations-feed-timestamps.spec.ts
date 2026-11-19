import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Manila' })

test('shows source timestamps in chronological order in both feeds', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-19T20:00:00+08:00'))
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fixture-token')
    localStorage.setItem('user', JSON.stringify({
      id: 'viewer', role: 'supervisor', username: 'Fixture Supervisor', legalConsentAccepted: true,
    }))
  })

  const shift = {
    id: 'shift', guard_id: 'guard', guard_name: 'Fixture Guard', client_site: 'Fixture Post',
    start_time: '2026-11-19T11:55:00Z', end_time: '2026-11-19T15:00:00Z', status: 'scheduled',
  }
  const incident = {
    id: 'incident', title: 'Fixture incident', location: 'Fixture Post', status: 'open',
    priority: 'critical', created_at: '2026-11-18T17:24:31Z',
  }
  const earlierIncident = {
    ...incident, id: 'earlier-incident', title: 'Earlier operations report', priority: 'low',
    created_at: '2026-10-02T16:28:00Z',
  }

  await page.route('**/api/**', async (route) => {
    switch (new URL(route.request().url()).pathname) {
      case '/api/guard-replacement/shifts':
        return route.fulfill({ json: [shift, { ...shift, id: 'absence', status: 'absent' }] })
      case '/api/incidents/active':
        return route.fulfill({ json: [incident, earlierIncident] })
      case '/api/armored-cars':
        return route.fulfill({ json: [{ id: 'vehicle', license_plate: 'QA-123', status: 'active' }] })
      default:
        return route.fulfill({ json: [] })
    }
  })

  await page.goto('/dashboard')
  const operations = page.getByRole('region', { name: 'Live operations feed' })
  const alerts = page.getByRole('region', { name: 'Incident alert feed' })
  const scheduled = operations.getByRole('button').filter({ hasText: 'Fixture Guard scheduled' })
  const vehicle = operations.getByRole('button').filter({ hasText: 'Armored vehicle QA-123 is active' })
  const alert = alerts.getByRole('button').filter({ hasText: 'Fixture incident' })
  const absence = alerts.getByRole('button').filter({ hasText: 'Guards absent today' })

  await expect(scheduled.locator('time')).toHaveText('Nov 19, 07:55 PM')
  await expect(alert.locator('time')).toHaveText('Reported Nov 19, 01:24:31 AM')
  await expect(alert.locator('time')).toHaveAttribute('datetime', '2026-11-18T17:24:31.000Z')
  await expect(vehicle).toBeVisible()
  await expect(vehicle.locator('time')).toHaveCount(0)
  await expect(absence).toBeVisible()
  await expect(absence.locator('time')).toHaveCount(0)
  await expect(operations.locator('time')).toHaveText(['Oct 3, 12:28 AM', 'Nov 19, 01:24 AM', 'Nov 19, 07:55 PM'])
  await expect(alerts.locator('time')).toHaveText(['Reported Oct 3, 12:28:00 AM', 'Reported Nov 19, 01:24:31 AM'])
  await expect(operations.locator('article').last()).toContainText('Armored vehicle QA-123 is active')
  await expect(alerts.locator('[aria-pressed]').last()).toContainText('Guards absent today')

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(alert.getByText('Escalate', { exact: true })).toHaveCount(0)
    await expect(alert.getByRole('button', { name: 'Resolve Fixture incident' })).toBeVisible()
    for (const card of [scheduled, alert]) {
      await expect(card.locator('time')).toBeVisible()
      expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    }
  }
})
