import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

test('issues and returns a firearm through the saved allocation register', async ({ page }) => {
  const guard = { id: 'guard-a', fullName: 'Fixture Guard' }
  const firearm = { id: 'inert-fixture', serialNumber: 'INERT-ONLY', model: 'Fixture' }
  const allocationId = 'new-allocation'
  let allocationStatus: 'active' | 'returned' | null = null
  const originalRecord = { id: 'saved-fixture', guardName: 'Saved Fixture', status: 'returned' }
  const custodyWrites: { path: string; method: string; body: unknown }[] = []

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/firearm') && request.method() !== 'GET') {
      custodyWrites.push({ path, method: request.method(), body: request.postDataJSON() })
    }
    switch (path) {
      case '/api/login': return route.fulfill({ json: {
        token: 'browser-fixture-token', refreshToken: 'browser-fixture-refresh',
        user: { id: 'admin-fixture', username: 'admin-fixture', role: 'superadmin', legalConsentAccepted: true },
      } })
      case '/api/firearm-allocations/eligible-guards': return route.fulfill({ json: { guards: [guard] } })
      case '/api/firearms': return route.fulfill({ json: {
        firearms: [{ ...firearm, status: allocationStatus === 'active' ? 'allocated' : 'available' }],
      } })
      case '/api/firearm-allocations/summary': return route.fulfill({ json: {
        eligibleGuards: 1,
        availableFirearms: allocationStatus === 'active' ? 0 : 1,
        activeCustody: allocationStatus === 'active' ? 1 : 0,
        custodyReviewFirearms: 0,
        returnedAllocations: allocationStatus === 'returned' ? 2 : 1,
        totalAllocationRecords: allocationStatus ? 2 : 1,
        maintenanceFirearms: 0,
      } })
      case '/api/firearm-allocations': {
        const allocations = allocationStatus ? [{
          id: allocationId,
          guardName: guard.fullName,
          firearmSerialNumber: firearm.serialNumber,
          firearmModel: firearm.model,
          status: allocationStatus,
        }, originalRecord] : [originalRecord]
        return route.fulfill({ json: { allocations, total: allocations.length } })
      }
      case '/api/firearm-allocation/issue':
        allocationStatus = 'active'
        return route.fulfill({ json: {} })
      case '/api/firearm-allocation/return':
        allocationStatus = 'returned'
        return route.fulfill({ json: {} })
      default: return route.fulfill({ json: [] })
    }
  })

  await page.goto('/allocation')
  await page.getByLabel('Email, Username, or Phone Number').fill('admin-fixture')
  await page.getByLabel('Password', { exact: true }).fill('browser-fixture')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.getByRole('button', { name: 'Assign Equipment', exact: true }).click()

  const table = page.getByRole('table', { name: 'Allocation register' })
  await expect(table.getByText('Saved Fixture')).toBeVisible()
  await expect(page.getByRole('group', { name: 'Allocation register views' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Allocate firearm', exact: true }).click()
  const issueDialog = page.getByRole('dialog', { name: 'Allocate firearm' })
  await issueDialog.getByLabel('Eligible guard').selectOption(guard.id)
  await issueDialog.getByLabel('Available firearm').selectOption(firearm.id)
  await issueDialog.getByRole('button', { name: 'Allocate firearm', exact: true }).click()

  const row = table.getByRole('row', { name: /Fixture Guard/ })
  await expect(row.getByText('Active', { exact: true })).toBeVisible()
  await page.reload()
  await expect(row.getByText('Active', { exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await row.getByRole('button', { name: 'Return', exact: true }).click()
  const returnDialog = page.getByRole('dialog', { name: 'Return firearm' })
  await returnDialog.getByRole('button', { name: 'Return firearm', exact: true }).click()
  await expect(row.getByText('Returned', { exact: true })).toBeVisible()
  await page.reload()
  await expect(row.getByText('Returned', { exact: true })).toBeVisible()
  await expect(table.getByText('Saved Fixture')).toBeVisible()
  expect(custodyWrites).toEqual([
    { path: '/api/firearm-allocation/issue', method: 'POST', body: { guardId: guard.id, firearmId: firearm.id } },
    { path: '/api/firearm-allocation/return', method: 'POST', body: { allocationId } },
  ])
})
