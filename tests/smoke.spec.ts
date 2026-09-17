/**
 * SENTINEL smoke tests — critical happy paths.
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'

const USERNAME = process.env.E2E_USERNAME ?? process.env.AUDIT_GUARD_IDENTIFIER
const PASSWORD = process.env.E2E_PASSWORD ?? process.env.AUDIT_GUARD_PASSWORD

test.describe.configure({ mode: 'serial' })

async function login(page: Page) {
  if (!USERNAME || !PASSWORD) {
    throw new Error('Set E2E_USERNAME and E2E_PASSWORD to a provisioned test account before running live smoke tests.')
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto('/')
    await page.getByLabel(/email.*username.*phone|identifier/i).fill(USERNAME)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: /login/i }).click()

    await page.waitForTimeout(800)
    if (!page.url().includes('/login')) {
      return
    }

    const loginError = page.locator('.soc-auth-alert-error')
    if (await loginError.isVisible().catch(() => false)) {
      const errorText = ((await loginError.textContent()) || '').trim()
      const waitMatch = errorText.match(/try again in\s+(\d+)\s+second/i)
      if (waitMatch && attempt === 0) {
        await page.waitForTimeout((Number(waitMatch[1]) + 1) * 1000)
        continue
      }
      throw new Error(`Login failed: ${errorText || 'unknown authentication error'}`)
    }
  }

  throw new Error('Login failed: session did not leave /login route.')
}

async function getCurrentRole(page: Page): Promise<string> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('user')
    if (!raw) return ''
    try {
      const parsed = JSON.parse(raw) as { role?: string }
      return typeof parsed.role === 'string' ? parsed.role.toLowerCase() : ''
    } catch {
      return ''
    }
  })
}

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('login page shows identifier and password fields', async ({ page }) => {
    await expect(page.getByLabel(/email.*username.*phone|identifier/i)).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible()
  })

  test('successful login lands on a dashboard', async ({ page }) => {
    await login(page)
  })
})

test.describe('Authenticated Workflows', () => {
  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext()
    page = await context.newPage()
    await login(page)
  })

  test.afterAll(async () => {
    await context.close()
  })

  test('incident surface is visible for the logged-in role', async () => {
    const role = await getCurrentRole(page)

    if (role === 'guard') {
      await expect(page.getByRole('button', { name: /report incident/i })).toBeVisible({ timeout: 8_000 })
      return
    }

    await expect(page.getByText(/live operations|incident/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('incident interaction path works for the logged-in role', async () => {
    const role = await getCurrentRole(page)

    if (role === 'guard') {
      await page.getByRole('button', { name: /report incident/i }).click()
      const descriptionInput = page.getByLabel(/what happened\?/i)
      await expect(descriptionInput).toBeVisible({ timeout: 8_000 })
      await page.getByRole('button', { name: 'Submit Report' }).click()
      await expect.poll(() => descriptionInput.evaluate((input: HTMLTextAreaElement) => input.validity.valueMissing)).toBe(true)
      return
    }

    const emptyIncidentState = page.locator('p').filter({ hasText: /no active incidents|monitoring remains stable/i }).first()
    if (await emptyIncidentState.isVisible().catch(() => false)) {
      return
    }

    const incidentPanelSurface = page.locator('h1, h2, h3').filter({ hasText: /incident intelligence|live operations/i }).first()
    await expect(incidentPanelSurface).toBeVisible({ timeout: 10_000 })
  })

  test('logout returns to login page', async () => {
    const incidentDialog = page.getByRole('dialog').filter({ has: page.getByLabel(/what happened\?/i) })
    if (await incidentDialog.isVisible().catch(() => false)) {
      await incidentDialog.getByRole('button', { name: /cancel|close/i }).first().click()
    }
    await page.getByRole('button', { name: 'Open profile menu' }).first().click()
    const logoutBtn = page.getByRole('button', { name: /logout|sign out/i }).filter({ visible: true }).first()
    await expect(logoutBtn).toBeVisible({ timeout: 8_000 })
    await logoutBtn.click()

    await expect(page.getByRole('button', { name: /^login$/i })).toBeVisible({ timeout: 8_000 })
    await expect(page.url()).toContain('/login')
  })
})
