import { expect, test, type Page } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

const inventoryUpdatedAt = '2026-11-16T01:02:03.123456Z'
const approvedAt = '2026-11-18T10:30:00Z'

async function installInventory(page: Page, role: 'admin' | 'supervisor' | 'superadmin', rejectFirst = false) {
  const approvals: unknown[] = []
  let approved = false
  await page.addInitScript((fixtureRole) => {
    localStorage.setItem('token', 'custody-test-token')
    localStorage.setItem('user', JSON.stringify({
      id: 'custody-test-user', username: 'Reviewer', role: fixtureRole, legalConsentAccepted: true,
    }))
  }, role)
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/firearms') {
      return route.fulfill({ json: { total: 2, firearms: [
        { id: 'review-item', serialNumber: 'REVIEW-1', model: 'Fixture', caliber: 'Fixture',
          status: 'allocated', custodyReview: true, updatedAt: inventoryUpdatedAt,
          custodyReviewApprovedAt: approved ? approvedAt : null },
        { id: 'other-item', serialNumber: 'OTHER-2', model: 'Fixture', caliber: 'Fixture',
          status: 'maintenance', updatedAt: inventoryUpdatedAt },
      ] } })
    }
    if (path === '/api/firearms/review-item/custody-review/approve' && request.method() === 'POST') {
      approvals.push(request.postDataJSON())
      if (rejectFirst && approvals.length === 1) {
        return route.fulfill({ status: 409, json: { error: 'The source record changed.' } })
      }
      approved = true
      return route.fulfill({ status: 201, json: { approvedAt } })
    }
    if (path === '/api/firearm-allocations/summary') {
      return route.fulfill({ json: {
        totalFirearms: 2, availableFirearms: 0, allocatedFirearms: 0,
        activeCustody: 0, custodyReviewFirearms: 1, maintenanceFirearms: 1,
      } })
    }
    return route.fulfill({ json: [] })
  })
  return approvals
}

test('admin approves a documented review without changing custody or inventory', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  const approvals = await installInventory(page, 'admin', true)
  await page.goto('/firearms')
  const row = page.getByRole('row').filter({ hasText: 'REVIEW-1' })
  const approve = row.getByRole('button', { name: 'Approve custody review for serial REVIEW-1' })
  await expect(page.getByRole('button', { name: /Approve custody review for serial/ })).toHaveCount(1)
  await approve.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Approve custody review' })
  await expect(dialog).toBeInViewport()
  await expect(dialog.getByRole('button', { name: 'Approve review' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(approve).toBeFocused()
  expect(approvals).toHaveLength(0)

  await approve.click()
  const reference = dialog.getByLabel('Source document reference')
  await reference.fill('   ')
  const submit = dialog.getByRole('button', { name: 'Approve review' })
  await expect(submit).toBeDisabled()
  await reference.fill('  Base log 123  ')
  await submit.click()
  await expect(dialog.getByRole('alert')).toContainText('The source record changed.')
  await expect(dialog).toBeVisible()
  await expect(reference).toHaveValue('  Base log 123  ')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(approve).toBeFocused()
  await page.reload()
  await approve.click()
  await reference.fill('Base log 123')
  await submit.click()
  await expect(dialog).toHaveCount(0)
  await expect(row.getByText('Review approved on', { exact: false })).toBeFocused()
  await expect(row.getByText('Review approved on', { exact: false })).toBeVisible()
  await expect(row.getByText('No verified active custody record')).toBeVisible()
  await expect(approve).toHaveCount(0)
  expect(approvals).toEqual(Array(2).fill({ sourceReference: 'Base log 123', inventoryUpdatedAt }))
  await page.reload()
  await expect(row.getByText('Review approved on', { exact: false })).toBeVisible()
  await expect(row.getByText('No verified active custody record')).toBeVisible()
})

for (const role of ['supervisor', 'superadmin'] as const) {
  test(`a ${role} can approve a flagged inventory record`, async ({ page }) => {
    const approvals = await installInventory(page, role)
    await page.goto('/firearms')
    const row = page.getByRole('row').filter({ hasText: 'REVIEW-1' })
    await expect(row.getByText('No verified active custody record')).toBeVisible()
    await row.getByRole('button', { name: /Approve custody review for serial/ }).click()
    const dialog = page.getByRole('dialog', { name: 'Approve custody review' })
    await expect(dialog).toContainText('Serial REVIEW-1')
    await dialog.getByLabel('Source document reference').fill('Base log 123')
    await dialog.getByRole('button', { name: 'Approve review' }).click()
    await expect(row.getByText('Review approved on', { exact: false })).toBeVisible()
    await expect(row.getByText('No verified active custody record')).toBeVisible()
    expect(approvals).toEqual([{ sourceReference: 'Base log 123', inventoryUpdatedAt }])
  })
}

for (const width of [1440, 390]) {
  test(`Resource Management shows approval next to Edit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const approvals = await installInventory(page, 'supervisor')
    await page.goto('/manage')
    await page.getByRole('navigation', { name: 'Resource tabs' }).getByRole('button', { name: 'Firearms' }).click()
    await page.getByRole('combobox', { name: 'Filter firearm inventory state' }).selectOption('custody_review')

    const row = page.getByRole('row').filter({ hasText: 'REVIEW-1' })
    const edit = row.getByRole('button', { name: 'Edit', exact: true })
    const approve = row.getByRole('button', { name: 'Approve custody review for serial REVIEW-1' })
    await expect(edit).toBeVisible()
    await expect(approve).toBeVisible()
    await approve.click()
    const dialog = page.getByRole('dialog', { name: 'Approve custody review' })
    await expect(dialog).toBeInViewport()
    await expect(dialog).toContainText('Serial REVIEW-1')
    await page.keyboard.press('Escape')
    await expect(approve).toBeFocused()
    expect(approvals).toHaveLength(0)
  })
}
