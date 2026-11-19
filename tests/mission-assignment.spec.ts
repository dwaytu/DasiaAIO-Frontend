import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

test('assigns a mission without asking for a destination', async ({ page }) => {
  const assignments: unknown[] = []
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fixture-token')
    localStorage.setItem('user', JSON.stringify({ id: 'viewer', role: 'superadmin', username: 'Fixture Supervisor', legalConsentAccepted: true }))
  })
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    switch (new URL(request.url()).pathname) {
      case '/api/guards':
        return route.fulfill({ json: [{ id: 'guard', full_name: 'Fixture Guard' }] })
      case '/api/firearms':
        return route.fulfill({ json: [{ id: 'asset', serialNumber: 'INERT-FIXTURE', status: 'available', licenseExpiryDate: '2099-01-01' }] })
      case '/api/armored-cars':
        return route.fulfill({ json: [{ id: 'vehicle', license_plate: '9999', plate_number: 'QA-123', status: 'available' }] })
      case '/api/missions':
        return route.fulfill({ json: { missions: [] } })
      case '/api/missions/assign':
        assignments.push(request.postDataJSON())
        return route.fulfill({ status: 201, json: { mission_id: 'fixture-mission', allocated_resources: { guards: [], firearms: [], vehicles: [] } } })
      default:
        return route.fulfill({ json: [] })
    }
  })

  await page.goto('/missions')
  await expect(page.getByRole('heading', { name: 'Assign New Mission' })).toBeVisible()
  await expect(page.getByLabel('Destination', { exact: true })).toHaveCount(0)
  await page.getByLabel('Mission Name').fill('Fixture mission')
  await page.getByLabel('Select Guard').selectOption('guard')
  await page.getByLabel('Select Firearm').selectOption('asset')
  await page.getByLabel('Select Vehicle').selectOption('vehicle')
  await page.getByLabel('Date', { exact: true }).fill('2030-01-02')
  await page.getByLabel('Start Time').fill('08:00')
  await page.getByLabel('End Time').fill('09:00')
  await page.getByRole('button', { name: 'Assign Mission', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Mission Assigned Successfully!' })).toBeVisible()
  expect(assignments).toHaveLength(1)
  expect(assignments[0]).toMatchObject({ mission_name: 'Fixture mission', guard_id: 'guard', firearm_id: 'asset', vehicle_id: 'vehicle' })
  expect(assignments[0]).not.toHaveProperty('destination')
})
