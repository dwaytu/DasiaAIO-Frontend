import { expect, test } from '@playwright/test'

const testUser = {
  id: 'superadmin-feedback-test',
  email: 'superadmin@example.test',
  username: 'superadmin',
  role: 'superadmin',
  fullName: 'Superadmin Feedback',
  legalConsentAccepted: true,
  mustChangePassword: false,
}

async function openAuthenticatedRoute(page: import('@playwright/test').Page, path: string) {
  await page.goto('/login')
  await page.evaluate((user) => {
    window.localStorage.setItem('token', 'eyJhbGciOiJub25lIn0.eyJleHAiOjQxMDI0NDQ4MDB9.signature')
    window.localStorage.setItem('user', JSON.stringify(user))
  }, testUser)
  await page.goto(path)
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/api/feedback/status', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ has_submitted: false }) }))
  await page.route('**/api/feedback', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'feedback-1',
      user_id: 'admin-1',
      user_name: 'Administrator',
      user_role: 'admin',
      rating: 5,
      comments: 'Clear workflow.',
      created_at: '2026-09-21T08:00:00Z',
    }]),
  }))
})

test('feedback stars are visibly filled after rating and for saved feedback', async ({ page }) => {
  await openAuthenticatedRoute(page, '/feedback')
  await page.getByRole('radio', { name: 'Rate 4 out of 5' }).check({ force: true })

  const selectedStar = page.getByRole('radio', { name: 'Rate 4 out of 5' }).locator('xpath=following-sibling::span/*[name()="svg"]')
  await expect(selectedStar).toHaveClass(/fill-current/)
  await expect(selectedStar).not.toHaveCSS('fill', 'none')

  await page.goto('/feedback-dashboard')
  const savedStars = page.getByLabel('5 out of 5 stars').locator('svg')
  await expect(savedStars).toHaveCount(5)
  await expect(savedStars.first()).toHaveClass(/fill-/)
  await expect(savedStars.first()).not.toHaveCSS('fill', 'none')
})
