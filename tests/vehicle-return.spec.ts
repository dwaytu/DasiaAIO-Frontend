import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

test('a vehicle return requires confirmation and refreshes fleet availability', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('token', 'vehicle-return-fixture')
    localStorage.setItem('user', JSON.stringify({
      id: 'superadmin-1', username: 'Reviewer', role: 'superadmin', legalConsentAccepted: true,
    }))
  })
  const requests: unknown[] = []
  let returned = false
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    switch (new URL(request.url()).pathname) {
      case '/api/armored-cars':
        return route.fulfill({ json: [{
          id: 'vehicle-1', plate_number: 'QA-123', model: 'Fixture', status: returned ? 'available' : 'allocated',
        }] })
      case '/api/car-allocations/active':
        return route.fulfill({ json: returned ? [] : [{
          id: 'allocation-1', car_id: 'vehicle-1', client_id: 'Client site',
          status: 'active', allocation_date: '2026-11-18T10:00:00Z',
        }] })
      case '/api/car-allocation/return':
        expect(request.method()).toBe('POST')
        requests.push(request.postDataJSON())
        if (requests.length === 1) {
          return route.fulfill({ status: 503, json: { error: 'Return service unavailable' } })
        }
        returned = true
        return route.fulfill({ json: { message: 'Car returned successfully' } })
      default:
        return route.fulfill({ json: [] })
    }
  })

  await page.goto('/armored-cars')
  await page.getByRole('button', { name: 'Allocations', exact: true }).click()
  const action = page.getByRole('button', { name: 'Return vehicle QA-123' })
  const dialog = page.getByRole('dialog', { name: 'Return Vehicle' })
  await action.click()
  await expect(dialog).toContainText('QA-123')
  await expect(dialog).toBeInViewport()
  await page.keyboard.press('Escape')
  await expect(action).toBeFocused()
  expect(requests).toHaveLength(0)

  await action.click()
  await dialog.getByRole('button', { name: 'Confirm Return' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Return service unavailable')
  await expect(action).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirm Return' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('No active allocations')).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: 'Return recorded for QA-123.' })).toBeVisible()
  await expect(page.getByText('Ready to allocate').locator('..')).toContainText('1')
  expect(requests).toEqual([{ allocationId: 'allocation-1' }, { allocationId: 'allocation-1' }])
})

test('vehicle dropdowns show recorded plates and omit missing plate placeholders', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'vehicle-options-fixture')
    localStorage.setItem('user', JSON.stringify({
      id: 'superadmin-1', username: 'Reviewer', role: 'superadmin', legalConsentAccepted: true,
    }))
  })
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    await route.fulfill({ json: path === '/api/armored-cars' ? [
      { id: 'vehicle-1', license_plate: '3003', plate_number: 'QA-123', model: 'Not provided', status: 'available' },
      { id: 'vehicle-2', license_plate: '6817', plate_number: null, model: 'Unrelated model', status: 'available' },
      { id: 'vehicle-3', license_plate: '6355', plate_number: 'Not provided', status: 'available' },
      { id: 'vehicle-4', license_plate: '6473', plate_number: 'QA-456', status: 'allocated' },
    ] : [] })
  })

  await page.goto('/armored-cars')
  await page.getByRole('button', { name: 'Allocations', exact: true }).click()
  const options = page.getByRole('combobox', { name: 'Select Vehicle' }).getByRole('option')
  await expect(options).toHaveText(['Choose a vehicle...', '3003 - QA-123', '6817', '6355'])

  await page.getByRole('main').getByRole('button', { name: 'Maintenance', exact: true }).click()
  await expect(options).toHaveText(['Choose a vehicle...', '3003 - QA-123', '6817', '6355', '6473 - QA-456'])
})
