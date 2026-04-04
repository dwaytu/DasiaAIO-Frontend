import { test, expect, type Page } from '@playwright/test'

const BASE_URL = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173/'

function installSession(page: Page, user: Record<string, unknown>) {
  return page.addInitScript((payload) => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify(payload))
    localStorage.setItem('dasi.toa.accepted.v1', 'accepted')
    localStorage.setItem('dasi.locationConsent.v1', 'accepted')
  }, user)
}

test.describe('Shell Header Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url()

      if (url.includes('/guard-replacement/guard/') && url.includes('/shifts')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            shifts: [
              {
                id: 'shift-1',
                client_site: 'North Gate',
                start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
                end_time: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
                status: 'active',
              },
            ],
          }),
        })
        return
      }

      if (url.includes('/users/') && url.includes('/notifications')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            notifications: [
              {
                id: 'notif-1',
                title: 'Relief update',
                message: 'Relief guard confirmed for North Gate.',
                type: 'shift',
                created_at: new Date().toISOString(),
                is_read: false,
              },
            ],
            unreadCount: 1,
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      })
    })
  })

  test('admin sidebar is trimmed and header actions open quick inbox and settings', async ({ page }) => {
    await installSession(page, {
      id: 'u2',
      email: 'admin@test.com',
      username: 'admin@test.com',
      role: 'admin',
      fullName: 'Test Admin',
      legalConsentAccepted: true,
    })

    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    const sidebarNav = page.getByRole('navigation').first()
    await expect(sidebarNav.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible()
    await expect(sidebarNav.getByRole('button', { name: 'Inbox', exact: true })).toHaveCount(0)
    await expect(sidebarNav.getByRole('button', { name: 'Settings', exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: /open quick inbox/i }).click()
    const quickInbox = page.getByRole('dialog', { name: /quick inbox/i })
    await expect(quickInbox).toBeVisible()
    await expect(quickInbox).toContainText(/pending guard approval|relief update|quick inbox/i)

    await page.getByRole('button', { name: /open settings/i }).click()
    const settingsDialog = page.getByRole('dialog', { name: /settings/i })
    await expect(settingsDialog).toBeVisible()
    await expect(settingsDialog.getByRole('heading', { name: /admin settings|superadmin settings/i }).first()).toBeVisible()
  })
})
