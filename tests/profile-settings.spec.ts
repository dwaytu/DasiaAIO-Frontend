import path from 'node:path'
import { expect, test } from '@playwright/test'

const testUser = {
  id: 'guard-1',
  email: 'guard@example.test',
  username: 'guard1',
  role: 'guard',
  fullName: 'Guard One',
  phoneNumber: '09171234567',
  legalConsentAccepted: true,
  mustChangePassword: false,
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/user/guard-1', async (route) => {
    if (route.request().method() !== 'GET') return route.fulfill({ status: 200, body: '{}' })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        guard_code: 'G-0042',
        verified: true,
        last_seen_at: '2026-09-20T08:00:00Z',
        created_at: '2026-01-01T08:00:00Z',
        updated_at: '2026-09-19T08:00:00Z',
      }),
    })
  })
})

async function openAuthenticatedRoute(page: import('@playwright/test').Page, path: string) {
  await page.goto('/login')
  await page.evaluate((user) => {
    window.localStorage.setItem('token', 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.signature')
    window.localStorage.setItem('user', JSON.stringify(user))
  }, testUser)
  await page.goto(path)
}

test('profile and settings expose supported account controls', async ({ page }) => {
  await openAuthenticatedRoute(page, '/profile')
  await expect(page.getByRole('heading', { name: 'Personal Information' })).toBeVisible()
  await expect(page.getByText('G-0042')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save Profile' })).toBeDisabled()

  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  const darkMode = page.getByRole('switch', { name: 'Dark mode' })
  await expect(darkMode).toHaveCSS('width', '44px')
  await expect(darkMode).toHaveCSS('height', '24px')
  const initialTheme = await darkMode.getAttribute('aria-checked')
  await darkMode.click()
  await expect(darkMode).toHaveAttribute('aria-checked', initialTheme === 'true' ? 'false' : 'true')
  await page.getByRole('button', { name: 'Change Password' }).click()
  await expect(page.getByRole('dialog', { name: 'Change Password' })).toBeVisible()
  await page.getByRole('button', { name: 'Change Password' }).last().click()
  await expect(page.getByRole('alert')).toContainText('Enter your current password.')
})

test('profile photo selection opens the position dialog and uploads a cropped PNG', async ({ page }) => {
  let uploadedPhoto = ''
  await page.route('**/api/user/guard-1/profile-photo', async (route) => {
    if (route.request().method() === 'PUT') {
      uploadedPhoto = route.request().postDataJSON().profilePhoto
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await openAuthenticatedRoute(page, '/profile')
  await page.locator('input[type="file"]').setInputFiles(path.resolve('node_modules/@jest/reporters/assets/jest_logo.png'))

  const dialog = page.getByRole('dialog', { name: 'Position profile photo' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Use Photo' })).toBeEnabled()
  await dialog.getByRole('button', { name: 'Use Photo' }).click()

  await expect(dialog).toBeHidden()
  expect(uploadedPhoto).toMatch(/^data:image\/png;base64,/)
})
