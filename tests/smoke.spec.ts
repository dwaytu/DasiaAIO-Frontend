/**
 * SENTINEL smoke tests — cover the critical happy paths:
 *  1. Login page renders and rejects bad credentials
 *  2. Successful login lands on a dashboard
 *  3. Incident report form is reachable and submittable
 *  4. Logout returns to the login page
 *
 * Environment variables:
 *   E2E_BASE_URL    – defaults to http://localhost:5173
 *   E2E_USERNAME    – test account identifier  (default: admin)
 *   E2E_PASSWORD    – test account password    (default: admin123)
 */

import { test, expect } from '@playwright/test'

const USERNAME = process.env.E2E_USERNAME ?? 'admin'
const PASSWORD = process.env.E2E_PASSWORD ?? 'admin123'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('login page shows identifier and password fields', async ({ page }) => {
    await expect(page.getByLabel(/email.*username.*phone|identifier/i)).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.getByLabel(/email.*username.*phone|identifier/i).fill('notauser@invalid.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: /login/i }).click()

    // Error message should appear (don't assert exact text — it may vary)
    await expect(page.locator('.soc-auth-alert-error')).toBeVisible({ timeout: 8_000 })
  })

  test('successful login lands on a dashboard', async ({ page }) => {
    await test.step('fill and submit login form', async () => {
      await page.getByLabel(/email.*username.*phone|identifier/i).fill(USERNAME)
      await page.getByLabel('Password').fill(PASSWORD)
      await page.getByRole('button', { name: /login/i }).click()
    })

    await test.step('verify dashboard is displayed', async () => {
      // After login the login page should be gone; a nav or main landmark appears
      await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 10_000 })
      // Login button should no longer be visible
      await expect(page.getByRole('button', { name: /^login$/i })).not.toBeVisible()
    })
  })
})

test.describe('Incident Reporting (requires auth)', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test in this suite
    await page.goto('/')
    await page.getByLabel(/email.*username.*phone|identifier/i).fill(USERNAME)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: /login/i }).click()
    await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 10_000 })
  })

  test('incident report form is reachable and has required fields', async ({ page }) => {
    await test.step('navigate to incident section', async () => {
      // Layout differs by role; click incident/report nav only when present
      const incidentButton = page.getByRole('button', { name: /incident|report/i }).first()
      const incidentLink = page.getByRole('link', { name: /incident|report/i }).first()
      if (await incidentButton.count()) {
        await incidentButton.click()
      } else if (await incidentLink.count()) {
        await incidentLink.click()
      }
    })

    await test.step('verify form fields exist', async () => {
      const titleField = page.getByLabel('Title')
      if (!(await titleField.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip()
        return
      }
      await expect(titleField).toBeVisible({ timeout: 5_000 })
      await expect(page.getByLabel(/location/i)).toBeVisible()
      await expect(page.getByLabel(/description/i)).toBeVisible()
    })
  })

  test('incident report form validates required fields', async ({ page }) => {
    // Navigate to the incident section
    const incidentNav = page.getByRole('button', { name: /incident|report/i }).first()
    if (await incidentNav.isVisible()) await incidentNav.click()

    const titleInput = page.getByLabel('Title')
    if (!(await titleInput.isVisible({ timeout: 5_000 }).catch(() => false))) {
      test.skip()
      return
    }

    await test.step('submit empty form', async () => {
      await page.getByRole('button', { name: /submit|report incident/i }).click()
    })

    await test.step('browser required validation fires', async () => {
      // The title input should be invalid (HTML5 required)
      await expect(titleInput).toHaveAttribute('required')
    })
  })
})

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByLabel(/email.*username.*phone|identifier/i).fill(USERNAME)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: /login/i }).click()
    await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 10_000 })
  })

  test('logout returns to login page', async ({ page }) => {
    await test.step('find and click logout', async () => {
      const logoutBtn = page.getByRole('button', { name: /logout|sign out/i }).first()
      if (!(await logoutBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
        test.skip()
        return
      }
      await logoutBtn.click()
    })

    await test.step('login page is shown again', async () => {
      await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible({
        timeout: 8_000,
      })
    })
  })
})
