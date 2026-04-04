import { test, expect, type Page, type Route } from '@playwright/test'

const guardUser = {
  id: 'guard-001',
  email: 'guard@test.com',
  username: 'guard@test.com',
  role: 'guard',
  fullName: 'Guard Test',
  legalConsentAccepted: true,
}

function buildIsoOffset(hoursFromNow: number): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString()
}

async function mockGuardDashboardApi(route: Route): Promise<void> {
  const url = route.request().url()

  if (url.includes('/api/attendance/')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        attendance: [
          {
            id: 'att-1',
            shift_id: 'shift-1',
            check_in_time: buildIsoOffset(-1),
            check_out_time: null,
          },
        ],
      }),
    })
    return
  }

  if (url.includes('/api/guard-replacement/guard/') && url.endsWith('/shifts')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        shifts: [
          {
            id: 'shift-1',
            client_site: 'Tower One Lobby',
            start_time: buildIsoOffset(-1),
            end_time: buildIsoOffset(7),
          },
        ],
      }),
    })
    return
  }

  if (url.includes('/api/guard-allocations/')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        allocations: [
          {
            id: 'alloc-1',
            firearm_id: 'f1',
            firearm_model: 'Glock 17',
            firearm_caliber: '9mm',
            firearm_serial_number: 'SN-1001',
            allocation_date: buildIsoOffset(-24),
            status: 'active',
          },
        ],
      }),
    })
    return
  }

  if (url.includes('/api/guard-firearm-permits/')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        permits: [
          {
            id: 'permit-1',
            permit_type: 'Carry Permit',
            issued_date: buildIsoOffset(-24 * 30),
            expiry_date: buildIsoOffset(24 * 14),
            status: 'active',
          },
        ],
      }),
    })
    return
  }

  if (url.includes('/api/support-tickets/')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tickets: [
          {
            id: 'ticket-1',
            subject: 'Radio battery issue',
            message: 'Battery drains quickly during shift.',
            status: 'open',
            created_at: buildIsoOffset(-4),
          },
        ],
      }),
    })
    return
  }

  if (url.includes('/api/shifts/swap-requests')) {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ swapRequests: [] }),
    })
    return
  }

  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({}),
  })
}

async function dismissLocationConsentIfPresent(page: Page): Promise<void> {
  const consentDialog = page.getByRole('dialog', { name: 'Location Tracking Consent' })
  if (!(await consentDialog.isVisible().catch(() => false))) return

  const declineButton = consentDialog.getByRole('button', { name: 'Decline' })
  await declineButton.click()
  await expect(consentDialog).not.toBeVisible()
}

async function bootstrapGuard(page: Page): Promise<void> {
  await page.addInitScript((user) => {
    localStorage.setItem('token', 'test-token')
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('sentinel-theme', 'dark')
  }, guardUser)

  await page.route('**/api/**', mockGuardDashboardApi)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await dismissLocationConsentIfPresent(page)
  await expect(page.locator('main, [role="main"]')).toBeVisible()
}

test.describe('Guard Dashboard UX Regression', () => {
  test.beforeEach(async ({ page }) => {
    await bootstrapGuard(page)
  })

  test('mission-first landing and single sticky bottom region are visible', async ({ page }) => {
    const missionWorkspace = page.getByRole('region', { name: 'Guard mission workspace' })
    const readinessCheck = missionWorkspace.getByRole('region', { name: 'Mission readiness check' })

    await expect(page.getByRole('heading', { name: 'Mission Screen' })).toBeVisible()
    await expect(missionWorkspace.getByRole('heading', { name: 'Immediate Action' })).toBeVisible()
    await expect(missionWorkspace.getByText(/(check in|stay on post) at tower one lobby/i)).toBeVisible()
    await expect(readinessCheck).toContainText(/(tracking and sync|location consent|reconnect)/i)
    await expect(missionWorkspace.getByText(/^Duty Status$/)).toBeVisible()
    await expect(missionWorkspace.getByText(/^Current Post$/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Report Incident/i })).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Mission Screen' })).toBeInViewport()
    await expect(page.getByRole('button', { name: /Report Incident/i })).toBeInViewport()

    await expect(page.getByTestId('guard-sticky-region')).toHaveCount(1)
    await expect(page.locator('[aria-label="Primary guard actions and navigation"]')).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: 'Guard primary navigation' })).toBeVisible()
  })

  test('resources section shows summary-first hierarchy', async ({ page }) => {
    await page.getByRole('button', { name: 'Resources' }).click()

    await expect(page.getByRole('heading', { name: 'Resource Snapshot' })).toBeVisible()
    await expect(page.getByText('Allocated Firearms')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Assigned Firearms' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Permit Records' })).toBeVisible()

    const summaryY = (await page.getByText('Allocated Firearms').first().boundingBox())?.y
    const detailsY = (await page.getByRole('heading', { name: 'Assigned Firearms' }).boundingBox())?.y

    expect(summaryY).toBeDefined()
    expect(detailsY).toBeDefined()
    expect(summaryY!).toBeLessThan(detailsY!)
  })

  test('support section groups workflows and exposes contextual shift selector', async ({ page }) => {
    await page.getByRole('button', { name: 'Support' }).click()

    await expect(page.getByRole('heading', { name: 'Field Instructions' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Schedule Change Requests' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Support Tickets' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Shift Swaps' })).toBeVisible()

    const shiftSelector = page.getByLabel('Scheduled Shift')
    await expect(shiftSelector).toBeVisible()
    await expect(shiftSelector.locator('option')).toHaveCount(2)
    await expect(shiftSelector.locator('option').nth(1)).toContainText('Tower One Lobby')
    await expect(page.getByText(/enter the sentinel user id for the guard covering your post/i)).toBeVisible()
  })

  test('support section degrades gracefully when swap history is unavailable', async ({ page }) => {
    await page.route('**/api/shifts/swap-requests', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Not found' }),
      })
    })

    await page.getByRole('button', { name: 'Support' }).click()

    await expect(page.getByText('Shift swap updates are temporarily unavailable. You can still submit a manual request below.')).toBeVisible()
    await expect(page.getByText('Swap request history is unavailable right now.')).toBeVisible()
    await expect(page.getByLabel('Scheduled Shift')).toBeVisible()
  })

  test('map section keeps status visible and supports expand flow', async ({ page }) => {
    await page.getByRole('button', { name: 'Map' }).click()

    await expect(page.getByRole('heading', { name: 'Location Status' })).toBeVisible()
    await expect(page.getByText('Map Feed')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Expand Live Map' })).toBeVisible()

    await page.getByRole('button', { name: 'Expand Live Map' }).click()

    await expect(page.getByRole('button', { name: 'Collapse Live Map' })).toBeVisible()

    const mapFrame = page.getByTitle('Guard location map')
    if (await mapFrame.count()) {
      await expect(mapFrame).toBeVisible()
    } else {
      await expect(page.getByText('No live coordinates yet. Enable tracking from Mission screen, then reopen map.')).toBeVisible()
    }
  })

  test('profile opens inline, theme toggle persists, and settings route is reachable', async ({ page }) => {
    await expect(page.getByRole('button', { name: /switch to light mode/i })).toBeVisible()
    await page.getByRole('button', { name: /switch to light mode/i }).click()
    await expect(page.locator('html')).toHaveClass(/light/)

    await page.getByRole('button', { name: 'Profile' }).click()
    const profileDialog = page.getByRole('dialog', { name: /guard profile settings/i })
    await expect(profileDialog).toBeVisible()
    await expect(profileDialog.getByRole('heading', { name: 'Account Settings' })).toBeVisible()
    await profileDialog.getByRole('button', { name: /back to mission shell/i }).click()
    await expect(profileDialog).not.toBeVisible()

    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Guard Settings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  })
})
