import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

test('chart bars reveal full names on hover and keyboard focus', async ({ page }) => {
  const name = 'Fixture Guard With A Long Name'
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fixture-token')
    localStorage.setItem('user', JSON.stringify({ id: 'viewer', role: 'admin', username: 'Fixture Operator', legalConsentAccepted: true }))
  })
  await page.route('**/api/**', (route) => {
    if (!route.request().url().includes('/api/analytics/guard-performance-report')) return route.fulfill({ json: [] })
    return route.fulfill({ json: {
      period: {},
      summary: { totalGuards: 1, averageAttendanceRate: 100, totalCompletedShifts: 4, averageClientRating: 5, totalLateCheckIns: 0, totalNoShows: 0, totalReplacementFrequency: 1, averageMeritScore: 100, totalIncidentReports: 2 },
      guards: [{ guardId: 'fixture', guardName: name, totalShifts: 4, attendedShifts: 4, attendanceRate: 100, completedShifts: 4, lateCheckIns: 0, noShows: 0, incidentReportsSubmitted: 2, averageClientRating: 5, evaluationCount: 1, meritScore: 100, replacementFrequency: 1, shiftsReplaced: 0 }],
    } })
  })
  await page.goto('/performance')
  const chart = page.getByRole('group', { name: 'Attendance Rate by Guard' })
  const bar = chart.getByRole('img', { name: `${name}, 100%` })
  await expect(chart).not.toContainText(name)
  await bar.hover()
  await expect(page.getByRole('tooltip')).toHaveText(`${name} · 100%`)
  await page.getByRole('heading', { name: 'Attendance Rate by Guard' }).hover()
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await bar.focus()
  await expect(page.getByRole('tooltip')).toHaveText(`${name} · 100%`)
  await expect(page.getByRole('columnheader', { name: 'Shifts covered' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Shifts replaced' })).toBeVisible()
})
