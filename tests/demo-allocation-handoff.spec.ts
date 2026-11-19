import { expect, test, type Page } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

async function login(page: Page, identifier: string) {
  await page.getByLabel('Email, Username, or Phone Number').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill('browser-fixture')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Open profile menu' }).click()
  await page.getByRole('dialog', { name: 'Profile menu' }).getByRole('button', { name: 'Logout' }).click()
  await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible()
}

test('demo allocation follows the selected guard through a same-tab sign-in', async ({ page, baseURL }) => {
  test.skip(!baseURL || (new URL(baseURL).hostname !== 'dasiasentinel.xyz' && process.env.VITE_PRESENTATION_ALLOCATION !== 'true'),
    'Requires the presentation host or the local allocation-demo flag.')

  const custodyWrites: string[] = []
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.startsWith('/api/firearm') && request.method() !== 'GET') custodyWrites.push(path)
    switch (path) {
      case '/api/login': {
        const { identifier } = request.postDataJSON()
        const role = identifier === 'admin-fixture' ? 'superadmin' : 'guard'
        return route.fulfill({ json: {
          token: 'browser-fixture-token', refreshToken: 'browser-fixture-refresh',
          user: { id: identifier, username: identifier, email: `${identifier}@example.test`, role, legalConsentAccepted: true },
        } })
      }
      case '/api/logout': return route.fulfill({ json: {} })
      case '/api/users': return route.fulfill({ json: {
        users: [{ id: 'guard-a', username: 'guard-a', email: 'guard-a@example.test', role: 'guard', full_name: 'Guard A', license_number: 'TEST', license_expiry_date: '2099-01-01' }],
        total: 1,
      } })
      case '/api/firearms': return route.fulfill({ json: {
        firearms: [{ id: 'inert-fixture', serialNumber: 'INERT-ONLY', model: 'Fixture', status: 'available' }],
      } })
      case '/api/firearm-allocations/summary': return route.fulfill({ json: {
        eligibleGuards: 0, availableFirearms: 1, activeCustody: 0, custodyReviewFirearms: 0,
        returnedAllocations: 1, totalAllocationRecords: 1, maintenanceFirearms: 0,
      } })
      case '/api/firearm-allocations': return route.fulfill({ json: {
        allocations: [{ id: 'saved-fixture', guardName: 'Saved Fixture', status: 'returned' }], total: 1,
      } })
      default: return route.fulfill({ json: [] })
    }
  })

  await page.goto('/allocation')
  await login(page, 'admin-fixture')
  await page.getByRole('button', { name: 'Assign Equipment', exact: true }).click()
  const table = page.getByRole('table', { name: 'Allocation register' })
  await expect(table.getByText('Saved Fixture')).toBeVisible()
  await page.getByRole('button', { name: 'Allocate firearm', exact: true }).click()
  const form = page.getByRole('dialog', { name: 'Allocate firearm' })
  await form.getByLabel('Eligible guard').selectOption('guard-a')
  await form.getByLabel('Available firearm').selectOption('inert-fixture')
  await form.getByRole('button', { name: 'Allocate firearm', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Allocations', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(table.getByRole('row', { name: /Guard A/ })).toContainText('Active')
  await expect(table.getByText('Saved Fixture')).toHaveCount(0)
  await expect(page.getByText('Clears on reload', { exact: true })).toHaveCount(0)

  await logout(page)
  await login(page, 'guard-b')
  await page.getByRole('button', { name: 'Resources', exact: true }).click()
  await expect(page.getByText('No resources allocated to this shift yet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Allocations', exact: true })).toHaveCount(0)

  await logout(page)
  await login(page, 'guard-a')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Resources', exact: true }).click()
  const demo = page.getByRole('list', { name: 'Demo allocations' })
  await expect(page.getByRole('button', { name: 'Allocations', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(demo.getByText('INERT-ONLY - Fixture')).toBeVisible()
  await expect(demo.getByText('Active', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Saved records' }).click()
  await expect(page.getByText('No resources allocated to this shift yet.')).toBeVisible()
  await expect(demo).toHaveCount(0)

  await logout(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await login(page, 'admin-fixture')
  await page.getByRole('button', { name: 'Assign Equipment', exact: true }).click()
  await page.getByRole('button', { name: 'Allocations', exact: true }).click()
  await table.getByRole('button', { name: 'Return', exact: true }).click()
  await page.getByRole('dialog', { name: 'Return firearm' }).getByRole('button', { name: 'Return firearm', exact: true }).click()
  await expect(table.getByRole('row', { name: /Guard A/ })).toContainText('Returned')
  await page.reload()
  await page.getByRole('button', { name: 'Allocations', exact: true }).click()
  await expect(page.getByText('No allocations yet.')).toBeVisible()
  expect(custodyWrites).toEqual([])
})
