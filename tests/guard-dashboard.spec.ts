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
            status: 'checked_in',
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
            status: 'active',
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
            firearmId: 'f1',
            firearmModel: 'Glock 17',
            firearmCaliber: '9mm',
            firearmSerialNumber: 'SN-1001',
            allocationDate: buildIsoOffset(-24),
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
            permitType: 'Carry Permit',
            issuedDate: buildIsoOffset(-24 * 30),
            expiryDate: buildIsoOffset(24 * 14),
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
    await page.setViewportSize({ width: 375, height: 844 })
    const missionWorkspace = page.getByRole('region', { name: 'Guard mission workspace' })
    await expect(page.getByRole('heading', { name: 'Mission' })).toBeVisible()
    await expect(missionWorkspace.getByText(/^on post$/i)).toBeVisible()
    await expect(missionWorkspace.getByText(/tower one lobby/i).first()).toBeVisible()
    await expect(missionWorkspace.getByRole('region', { name: 'Current duty status' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Report Incident/i })).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Mission' })).toBeInViewport()
    const missionAction = page.getByRole('button', { name: /Check Out.*End Shift/i })
    await expect(missionAction).toBeInViewport()
    await expect(missionAction).toHaveCount(1)
    await expect(page.getByRole('button', { name: /Emergency SOS/i })).toBeInViewport()

    await expect(page.getByTestId('guard-sticky-region')).toHaveCount(1)
    await expect(page.getByTestId('guard-sticky-region').getByRole('navigation', { name: 'Guard primary navigation' })).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: 'Guard primary navigation' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Emergency contacts' }).getByRole('link')).toHaveCount(4)
  })

  test('resources section shows summary-first hierarchy', async ({ page }) => {
    await page.getByRole('button', { name: 'Resources' }).click()

    await expect(page.getByRole('heading', { name: 'Resource Snapshot' })).toBeVisible()
    await expect(page.getByText('Allocated Firearms')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Your Resources' })).toBeVisible()
    await expect(page.getByText('Glock 17 (9mm)')).toBeVisible()
    await expect(page.getByText('Carry Permit')).toBeVisible()

    const summaryY = (await page.getByText('Allocated Firearms').first().boundingBox())?.y
    const detailsY = (await page.getByRole('heading', { name: 'Your Resources' }).boundingBox())?.y

    expect(summaryY).toBeDefined()
    expect(detailsY).toBeDefined()
    expect(summaryY!).toBeLessThan(detailsY!)
  })

  test('support section exposes the current support-ticket workflow', async ({ page }) => {
    await page.getByRole('button', { name: 'Support' }).click()

    await expect(page.getByRole('heading', { name: 'Support Tickets', exact: true })).toBeVisible()
    await expect(page.getByText('Radio battery issue')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Ticket' })).toBeVisible()

    await page.getByRole('button', { name: 'New Ticket' }).click()
    await expect(page.getByRole('heading', { name: 'Create Support Ticket' })).toBeVisible()
    await expect(page.getByLabel('Category')).toBeVisible()
    await expect(page.getByLabel('Subject')).toBeVisible()
    await expect(page.getByLabel('Description')).toBeVisible()
  })

  test('support section exposes a retry when tickets are unavailable', async ({ page }) => {
    await page.route('**/api/support-tickets/**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Support service unavailable' }),
      })
    })

    await page.getByRole('button', { name: 'Support' }).click()

    await expect(page.getByText(/support service unavailable/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  test('map section keeps tracking status and fallback location visible', async ({ page }) => {
    await page.getByRole('button', { name: 'Map' }).click()

    await expect(page.getByRole('heading', { name: 'Live Map' })).toBeVisible()
    await expect(page.getByText(/tracking blocked \(consent required\)/i)).toBeVisible()
    await expect(page.getByText(/no location heartbeat yet/i).first()).toBeVisible()
    await expect(page.getByRole('link', { name: 'Open Full Map' })).toBeVisible()
  })

  test('profile and settings are reachable from the guard account menu', async ({ page }) => {
    await expect(page.getByRole('button', { name: /switch to light mode/i })).toHaveCount(0)
    await page.getByRole('button', { name: 'Open profile menu' }).click()
    await page.getByRole('button', { name: 'My Profile' }).click()
    const profileDialog = page.getByRole('dialog', { name: /guard profile settings/i })
    await expect(profileDialog).toBeVisible()
    await expect(profileDialog.getByRole('heading', { name: 'Account Settings' })).toBeVisible()
    await profileDialog.getByRole('button', { name: /back to mission shell/i }).click()
    await expect(profileDialog).not.toBeVisible()

    await page.getByRole('button', { name: 'Open profile menu' }).click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Guard Settings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  })

  test('self-location is visible on map tab from device GPS without heartbeat persistence', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 7.45, longitude: 125.81 })
    await page.route('**/api/tracking/consent/grant', route => route.fulfill({
      json: { legalConsentAccepted: true, locationTrackingConsent: true },
    }))
    await page.route('**/api/tracking/consent', route => route.fulfill({
      json: { legalConsentAccepted: true, locationTrackingConsent: true },
    }))
    await page.getByRole('button', { name: 'Enable Consent' }).click()
    await page.getByRole('button', { name: 'Map', exact: true }).click()
    const map = page.getByRole('region', { name: 'Guard map workspace' })
    await expect(map.getByText('7.450000, 125.810000')).toBeVisible({ timeout: 15_000 })
    await expect(map.locator('.leaflet-container')).toBeVisible()
    await expect(map.getByText(/does not indicate your live position/i)).toHaveCount(0)
  })
})
