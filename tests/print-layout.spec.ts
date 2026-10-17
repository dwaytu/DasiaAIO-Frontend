import { expect, test, type Page, type Route } from '@playwright/test'

const testUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  username: 'admin',
  fullName: 'Test Administrator',
  role: 'admin',
  legalConsentAccepted: true,
}

const analyticsResponse = {
  overview: {
    total_guards: 2,
    active_guards: 1,
    total_missions: 2,
    completed_missions: 1,
    active_missions: 1,
    total_firearms: 2,
    allocated_firearms: 1,
    total_vehicles: 2,
    deployed_vehicles: 1,
  },
  performance_metrics: {
    mission_completion_rate: 50,
    average_mission_duration: 2,
    guard_attendance_rate: 50,
    firearm_availability_rate: 50,
    vehicle_utilization_rate: 50,
  },
  resource_utilization: {
    firearms_in_use: 1,
    firearms_available: 1,
    firearms_unavailable: 1,
    vehicles_deployed: 1,
    vehicles_available: 1,
    vehicles_unavailable: 1,
    guards_on_duty: 1,
    guards_available: 1,
    guards_unavailable: 0,
  },
  mission_stats: {
    total_missions_this_month: 2,
    completed_missions_this_month: 1,
    pending_missions: 1,
    average_guards_per_mission: 1,
    average_duration_hours: 2,
  },
  attendance_analytics: {
    period_days: 30,
    total_scheduled_shifts: 2,
    attended_shifts: 1,
    on_time_check_ins: 1,
    late_check_ins: 0,
    no_shows: 1,
    attendance_rate: 50,
  },
  attendance_trend: [{
    date: '2026-09-17',
    scheduled_shifts: 2,
    attended_shifts: 1,
    late_check_ins: 0,
    no_shows: 1,
  }],
  evaluation_analytics: {
    period_days: 30,
    total_evaluations: 1,
    guards_evaluated: 1,
    average_rating: 4,
    low_rating_count: 0,
    rating_distribution: [1, 2, 3, 4, 5].map((rating) => ({ rating, count: rating === 4 ? 1 : 0 })),
  },
  evaluation_trend: [{ date: '2026-09-17', average_rating: 4, evaluation_count: 1 }],
}

function installSession(page: Page) {
  return page.addInitScript((user) => {
    localStorage.setItem('token', 'print-layout-test-token')
    localStorage.setItem('user', JSON.stringify(user))
    localStorage.setItem('dasi.toa.accepted.v1', 'accepted')
    localStorage.setItem('dasi.locationConsent.v1', 'accepted')
  }, testUser)
}

async function fulfillJson(route: Route, body: unknown) {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
}

test('analytics print view keeps report content compact and readable', async ({ page }) => {
  await installSession(page)
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/analytics') {
      await fulfillJson(route, analyticsResponse)
      return
    }

    await fulfillJson(route, [])
  })

  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics overview' })).toBeVisible()

  await page.emulateMedia({ media: 'print' })

  await expect(page.locator('.analytics-print-heading')).toBeVisible()
  await expect(page.locator('.analytics-screen-hero')).toBeHidden()
  await expect(page.getByText('SENTINEL Operational Analytics')).toHaveCSS('color', 'rgb(0, 0, 0)')
  await expect(page.getByLabel('Operational summary').first()).toHaveCSS('display', 'grid')
})

test('DTR print view identifies the report and excludes internal guard UUIDs', async ({ page }) => {
  await installSession(page)
  await page.route('**/api/**', async (route) => {
    if (new URL(route.request().url()).pathname === '/api/attendance/dtr') {
      await fulfillJson(route, {
        total: 1,
        page: 1,
        pageSize: 50,
        items: [{
          shiftId: 'shift-1',
          guardId: '9d8b8278-c60e-64322-a275-cc3af019e4bb',
          guardName: 'Guard One',
          clientSite: 'DSIA - Tagum',
          scheduledStart: '2026-09-17T02:45:00.000Z',
          scheduledEnd: '2026-09-17T10:45:00.000Z',
          actualCheckIn: null,
          actualCheckOut: null,
          lateMinutes: 0,
          totalHours: null,
          status: 'scheduled',
        }],
      })
      return
    }

    await fulfillJson(route, [])
  })

  await page.goto('/dtr')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByText('9d8b8278-c60e-64322-a275-cc3af019e4bb')).toBeVisible()

  await page.emulateMedia({ media: 'print' })

  await expect(page.locator('.dtr-print-heading')).toBeVisible()
  await expect(page.getByText('Daily Time Record').last()).toBeVisible()
  await expect(page.locator('.dtr-print-guard-id')).toBeHidden()
  await expect(page.getByRole('table')).toBeVisible()
})
