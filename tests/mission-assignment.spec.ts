import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block', timezoneId: 'UTC' })

for (const role of ['admin', 'supervisor', 'superadmin']) {
  test(`${role} can assign, start, and end a saved mission`, async ({ page }) => {
    if (role === 'supervisor') await page.setViewportSize({ width: 390, height: 844 })
    const assignments: unknown[] = []
    const statusUpdates: unknown[] = []
    let tripStatus: string | null = null
    await page.addInitScript((role) => {
      localStorage.setItem('token', 'fixture-token')
      localStorage.setItem('user', JSON.stringify({ id: 'viewer', role, username: 'Fixture Operator', legalConsentAccepted: true }))
    }, role)
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      switch (new URL(request.url()).pathname) {
        case '/api/users/pending-approvals':
          return route.fulfill({ json: { users: [{ id: 'approval-fixture' }] } })
        case '/api/guards':
          return route.fulfill({ json: [{ id: 'guard', full_name: 'Fixture Guard' }] })
        case '/api/firearms':
          return route.fulfill({ json: {
            total: 2,
            firearms: new URL(request.url()).searchParams.get('page') === '2'
              ? [{ id: 'asset', serialNumber: 'INERT-FIXTURE', status: 'available', licenseExpiryDate: '2099-01-01' }]
              : [{ id: 'expired-asset', status: 'available', licenseExpiryDate: '2000-01-01' }],
          } })
        case '/api/armored-cars':
          return route.fulfill({ json: [{ id: 'vehicle', license_plate: '9999', plate_number: 'QA-123', status: 'available' }] })
        case '/api/missions':
          return route.fulfill({ json: { missions: tripStatus ? [{
            id: 'fixture-trip', status: tripStatus, driver_name: 'Fixture Guard', vehicle_plate_number: 'QA-123',
            start_time: '2030-01-02T00:00:00Z', end_time: '2030-01-02T01:00:00Z',
          }] : [] } })
        case '/api/missions/assign':
          assignments.push(request.postDataJSON())
          tripStatus = 'scheduled'
          return route.fulfill({ status: 201, json: { mission_id: 'fixture-mission', allocated_resources: { guards: [], firearms: [], vehicles: [] } } })
        case '/api/trip-management/fixture-trip/status': {
          const update = request.postDataJSON()
          statusUpdates.push(update)
          tripStatus = update.status
          return route.fulfill({ json: { success: true } })
        }
        default:
          return route.fulfill({ json: [] })
      }
    })

    await page.goto('/dashboard')
    if (role !== 'supervisor') {
      await expect(page.getByText('Pending guard approvals', { exact: true })).toBeVisible()
    }
    await expect(page.getByText('Threat Low', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Create Mission', exact: true }).click()
    await expect(page).toHaveURL(/\/missions$/)
    await expect(page.getByRole('heading', { name: 'Assign New Mission' })).toBeVisible()
    await expect(page.getByText('Enter the mission date and times in Philippine time (UTC+8).')).toBeVisible()
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
    await expect(page.getByRole('row', { name: /Fixture Guard/ })).toContainText(/08:00\s*am\s*-\s*09:00\s*am/i)

    await page.getByRole('button', { name: 'Start Mission', exact: true }).click()
    await page.getByRole('button', { name: 'End Mission', exact: true }).click()
    await expect(page.getByRole('row', { name: /Fixture Guard/ })).toContainText('completed')
    expect(statusUpdates).toEqual([
      { status: 'in_progress', expected_status: 'scheduled' },
      { status: 'completed', expected_status: 'in_progress' },
    ])
  })
}

test('an older trip shows its driver and describes missing assignment records', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fixture-token')
    localStorage.setItem('user', JSON.stringify({ id: 'viewer', role: 'supervisor', username: 'Fixture Operator', legalConsentAccepted: true }))
  })
  const trip = {
    id: 'older-trip', status: 'scheduled', driver_name: 'Recorded Driver',
    start_time: '2030-01-02T00:00:00Z', end_time: '2030-01-02T01:00:00Z',
  }
  await page.route('**/api/**', async (route) => {
    switch (new URL(route.request().url()).pathname) {
      case '/api/trip-management/active':
        return route.fulfill({ json: { trips: [trip] } })
      case '/api/trip-management/older-trip':
        return route.fulfill({ json: { trip, guards: [], firearms: [], guard_count: 0, firearm_count: 0 } })
      default:
        return route.fulfill({ json: [] })
    }
  })
  await page.goto('/trips')
  await expect(page.getByRole('row', { name: /Recorded Driver/ })).toContainText(/8:00\s*am/i)
  await page.getByRole('button', { name: 'Details', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Trip Details' })).toBeVisible()
  await expect(page.getByText('No trip-specific guard assignments on record.')).toBeVisible()
  await expect(page.getByText('No trip-specific firearm allocations on record.')).toBeVisible()
})

test('permit records can be searched and time-expired active records are filterable', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fixture-token')
    localStorage.setItem('user', JSON.stringify({ id: 'viewer', role: 'admin', username: 'Fixture Operator', legalConsentAccepted: true }))
  })
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/guard-firearm-permits') {
      return route.fulfill({ json: { permits: [
        { id: 'old', guardId: 'old-fixture', firearmId: null, permitType: 'Recorded type', issuedDate: '1999-01-01T00:00:00Z', expiryDate: '2000-01-01T00:00:00Z', status: 'active' },
        { id: 'current', guardId: 'new-fixture', firearmId: null, permitType: 'Recorded type', issuedDate: '2026-01-01T00:00:00Z', expiryDate: '2099-01-01T00:00:00Z', status: 'active' },
      ] } })
    }
    return route.fulfill({ json: [] })
  })
  await page.goto('/permits')
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('expired')
  await expect(page.getByRole('row', { name: /old-fixture/ })).toContainText('expired')
  await expect(page.getByRole('row', { name: /new-fixture/ })).toHaveCount(0)
  await page.getByLabel('Search permits').fill('unmatched')
  await expect(page.getByText('No permits match these filters.')).toBeVisible()
})
