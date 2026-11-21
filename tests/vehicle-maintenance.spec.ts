import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Manila' })

test('vehicle maintenance uses the shared page and the existing vehicle endpoints', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(() => {
    localStorage.setItem('token', 'vehicle-maintenance-fixture')
    localStorage.setItem('user', JSON.stringify({
      id: 'supervisor-1', username: 'Reviewer', role: 'supervisor', legalConsentAccepted: true,
    }))
  })

  const vehicles = [
    { id: 'vehicle-1', license_plate: '3003', plate_number: 'QA-123', status: 'available' },
    { id: 'vehicle-2', license_plate: '6817', plate_number: null, status: 'available' },
    { id: 'vehicle-3', license_plate: '6355', plate_number: 'Not provided', status: 'available' },
    { id: 'vehicle-4', license_plate: '6473', plate_number: 'QA-456', status: 'allocated' },
  ]
  const scheduleRequests: unknown[] = []
  const unexpectedAllocationRequests: string[] = []
  let completionRequests = 0
  let saved = false
  let completed = false

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/car-allocation')) unexpectedAllocationRequests.push(path)
    switch (path) {
      case '/api/armored-cars':
        return route.fulfill({ json: vehicles })
      case '/api/car-maintenance/schedule':
        expect(request.method()).toBe('POST')
        scheduleRequests.push(request.postDataJSON())
        saved = true
        return route.fulfill({ status: 201, json: { maintenanceId: 'service-1' } })
      case '/api/car-maintenance/service-1/complete':
        expect(request.method()).toBe('POST')
        completionRequests += 1
        completed = true
        return route.fulfill({ json: { message: 'Completed' } })
      case '/api/car-maintenance/vehicle-1':
        return route.fulfill({ json: saved ? [{
          id: 'service-1', car_id: 'vehicle-1', maintenance_type: 'routine_service',
          description: 'Routine fleet service', scheduled_date: null,
          status: completed ? 'completed' : 'scheduled',
        }] : [] })
      case '/api/firearm-maintenance':
        return route.fulfill({ json: { total: 0, maintenances: [] } })
      default:
        return route.fulfill({ json: [] })
    }
  })

  await page.goto('/armored-cars')
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { name: 'Vehicle Inventory' })).toBeVisible()
  await expect(main.getByRole('button', { name: 'Allocations', exact: true })).toHaveCount(0)
  await expect(main.getByRole('button', { name: 'Maintenance', exact: true })).toHaveCount(0)
  await expect(main.getByRole('button', { name: 'Trips', exact: true })).toBeVisible()
  await main.getByRole('link', { name: 'Vehicle maintenance' }).click()
  await expect(page).toHaveURL(/\/maintenance\?asset=armored-cars$/)
  const tabs = main.getByRole('navigation', { name: 'Maintenance assets' })
  await expect(tabs.getByRole('link', { name: 'Armored Cars' })).toHaveAttribute('aria-current', 'page')
  await expect(main.getByRole('heading', { name: 'Maintenance controls' })).toBeVisible()

  await main.getByRole('button', { name: 'Schedule maintenance', exact: true }).click()
  const vehiclesSelect = main.getByRole('combobox', { name: 'Armored car', exact: true })
  await expect(vehiclesSelect.getByRole('option')).toHaveText([
    'Select an armored car', '3003 - QA-123', '6817', '6355', '6473 - QA-456',
  ])
  await vehiclesSelect.selectOption('vehicle-1')
  await main.getByRole('combobox', { name: 'Maintenance type' }).selectOption('routine_service')
  await main.getByRole('textbox', { name: 'Description' }).fill('Routine fleet service')
  await main.getByRole('button', { name: 'Schedule maintenance', exact: true }).click()
  const record = main.getByRole('row', { name: /Routine fleet service/ })
  await expect(record).toContainText('scheduled')
  expect(scheduleRequests).toEqual([{
    carId: 'vehicle-1', maintenanceType: 'routine_service',
    description: 'Routine fleet service', scheduledDate: null,
  }])

  await record.getByRole('button', { name: 'Complete', exact: true }).click()
  await expect(main.getByRole('heading', { name: 'Complete maintenance for 3003 - QA-123' })).toBeVisible()
  await main.getByRole('button', { name: 'Complete maintenance', exact: true }).click()
  await expect(record.getByRole('cell', { name: 'completed', exact: true })).toBeVisible()
  expect(completionRequests).toBe(1)
  expect(unexpectedAllocationRequests).toEqual([])

  await tabs.getByRole('link', { name: 'Firearms' }).click()
  await expect(main.getByText('Available firearms', { exact: true })).toBeVisible()
  await expect(main.getByText('No firearm maintenance records found.')).toBeVisible()
})
