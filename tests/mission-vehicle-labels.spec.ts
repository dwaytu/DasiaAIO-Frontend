import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

test('Missions identifies vehicles by fleet and plate numbers', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'mission-vehicle-fixture')
    localStorage.setItem('user', JSON.stringify({
      id: 'superadmin-1', username: 'Reviewer', role: 'superadmin', legalConsentAccepted: true,
    }))
  })
  await page.route('**/api/**', async (route) => {
    switch (new URL(route.request().url()).pathname) {
      case '/api/users':
        return route.fulfill({ json: { users: [], total: 0 } })
      case '/api/armored-cars':
        return route.fulfill({ json: [
          { id: 'vehicle-1', license_plate: '3003', plate_number: 'QA-123', model: 'Not provided', status: 'available' },
          { id: 'vehicle-2', license_plate: '6817', plate_number: null, model: 'Not provided', status: 'available' },
        ] })
      case '/api/missions':
        return route.fulfill({ json: { missions: [
          { id: 'mission-1', vehicle_fleet_number: '3003', vehicle_plate_number: 'QA-123', vehicle_model: 'Not provided', status: 'completed' },
          { id: 'mission-2', vehicle_fleet_number: '6817', vehicle_plate_number: null, vehicle_model: 'Not provided', status: 'completed' },
        ] } })
      default:
        return route.fulfill({ json: [] })
    }
  })
  await page.goto('/missions')
  const picker = page.getByRole('combobox', { name: 'Select Vehicle' })
  await expect(picker.getByRole('option')).toHaveText(['-- Select a vehicle --', '3003 - QA-123', '6817'])
  const history = page.locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Mission History', exact: true }) })
    .getByRole('table')
  await expect(history.getByRole('cell', { name: '3003 - QA-123', exact: true })).toBeVisible()
  await expect(history.getByRole('cell', { name: '6817', exact: true })).toBeVisible()
  await expect(history.getByText('Not provided')).toHaveCount(0)
})
