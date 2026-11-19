import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block', timezoneId: 'Asia/Manila' })

test('shows missed check-in and assigns only the confirmed candidate to the selected shift', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.setFixedTime(new Date('2026-11-19T17:39:00+08:00'))
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fixture-token')
    localStorage.setItem('user', JSON.stringify({ id: 'viewer', role: 'supervisor', username: 'Fixture Supervisor', legalConsentAccepted: true }))
  })

  const start = '2026-11-19T10:34:00+08:00'
  const end = '2026-11-19T22:35:00+08:00'
  const version = '2026-11-19T09:00:00+08:00'
  const target = {
    id: 'target', guard_id: 'original', guard_name: 'Original Guard', client_site: 'Fixture Post',
    start_time: start, end_time: end, updated_at: version, status: 'scheduled', missed_check_in: true,
    replacement_eligible: true, replacement_status: 'not_needed', replacement_site_id: 'site',
  }
  const unassigned = { ...target, id: 'unassigned', guard_name: 'Unassigned Guard', client_site: 'n/a', replacement_site_id: null }
  const assignments: unknown[] = []
  const suggestions: (string | null)[][] = []
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    switch (url.pathname) {
      case '/api/guard-replacement/shifts': {
        const assigned = { ...target, guard_id: 'replacement', guard_name: 'Replacement Guard', missed_check_in: false, replacement_eligible: false, replacement_status: 'accepted' }
        return route.fulfill({ json: { total: 2, shifts: [unassigned, assignments.length ? assigned : target] } })
      }
      case '/api/analytics/replacement-suggestions': {
        suggestions.push([url.searchParams.get('post_id'), url.searchParams.get('shift_id')])
        return route.fulfill({ json: [{ guardId: 'replacement', guardName: 'Replacement Guard', reliabilityScore: 95, distanceKm: 99, distanceKnown: false, availability: true }] })
      }
      case '/api/guard-replacement/confirm-replacement':
        assignments.push(request.postDataJSON())
        return route.fulfill({ json: { shiftId: 'target', guardId: 'replacement' } })
      default:
        return route.fulfill({ json: [] })
    }
  })

  await page.goto('/dashboard')
  const todaysShifts = page.getByRole('region', { name: "Today's shift operations" })
  const original = todaysShifts.getByRole('listitem').filter({ hasText: 'Original Guard' })
  await expect(original.getByText('Missed check-in')).toBeVisible()

  const replacementPanel = page.getByRole('region', { name: 'Smart guard replacement suggestions' })
  await expect(replacementPanel.getByText(/Set an active client site/)).toBeVisible()
  expect(suggestions).toEqual([])
  await replacementPanel.getByLabel('Shift needing coverage').selectOption('target')
  await expect(replacementPanel.getByText('Distance unavailable')).toBeVisible()
  expect(suggestions).toEqual([['site', 'target']])

  await replacementPanel.getByRole('button', { name: 'Choose replacement: Replacement Guard' }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm replacement' })
  const submit = dialog.getByRole('button', { name: 'Confirm replacement' })
  await expect(dialog).toBeInViewport()
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(dialog).toBeInViewport()
  await expect(dialog).toContainText('Fixture Post')
  await expect(submit).toBeDisabled()
  expect(assignments).toEqual([])
  await dialog.getByRole('checkbox', { name: /confirmed by phone/ }).check()
  await submit.click()

  await expect(replacementPanel.getByRole('status')).toHaveText('Replacement assigned to Replacement Guard at Fixture Post.')
  await expect(todaysShifts.getByText('Replacement Guard')).toBeVisible()
  await expect(original).toHaveCount(0)
  expect(assignments).toEqual([{ shiftId: 'target', originalGuardId: 'original', replacementGuardId: 'replacement', shiftUpdatedAt: version, confirmedAvailable: true }])
})
