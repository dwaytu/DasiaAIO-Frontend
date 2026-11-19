import { expect, test, type Page } from '@playwright/test'

test.use({ serviceWorkers: 'block' })

const inventoryUpdatedAt = '2026-11-16T01:02:03.123456Z'
const approvedAt = '2026-11-18T10:30:00Z'

async function installInventory(
  page: Page,
  role: 'admin' | 'supervisor' | 'superadmin',
  { rejectFirst = false, legacyApproved = false, legacyServer = false } = {},
) {
  const approvals: unknown[] = []
  let documented = legacyApproved
  let returnedToStock = false
  await page.addInitScript((fixtureRole) => {
    localStorage.setItem('token', 'custody-test-token')
    localStorage.setItem('user', JSON.stringify({
      id: 'custody-test-user', username: 'Reviewer', role: fixtureRole, legalConsentAccepted: true,
    }))
  }, role)
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (path === '/api/firearms') {
      const firearms = [
        { id: 'review-item', serialNumber: 'REVIEW-1', model: 'Fixture', caliber: 'Fixture',
          status: returnedToStock ? 'available' : 'allocated', custodyReview: !returnedToStock,
          updatedAt: returnedToStock ? approvedAt : inventoryUpdatedAt,
          custodyReviewApprovedAt: documented && !returnedToStock ? approvedAt : null },
        { id: 'other-item', serialNumber: 'OTHER-2', model: 'Fixture', caliber: 'Fixture',
          status: 'maintenance', updatedAt: inventoryUpdatedAt },
      ]
      const filtered = url.searchParams.get('state') === 'custody_review' ? firearms.filter((item) => item.custodyReview) : firearms
      return route.fulfill({ json: { total: filtered.length, firearms: filtered } })
    }
    if (path === '/api/firearms/review-item/custody-review/approve' && request.method() === 'POST') {
      approvals.push(request.postDataJSON())
      if (rejectFirst && approvals.length === 1) {
        return route.fulfill({ status: 409, json: { error: 'The source record changed.' } })
      }
      documented = true
      if (legacyServer) return route.fulfill({ status: 201, json: { approvedAt } })
      returnedToStock = true
      return route.fulfill({ status: 201, json: { approvedAt, returnedToStock } })
    }
    if (path === '/api/firearm-allocations/summary') {
      return route.fulfill({ json: {
        totalFirearms: 2, availableFirearms: returnedToStock ? 1 : 0, allocatedFirearms: returnedToStock ? 0 : 1,
        activeCustody: 0, custodyReviewFirearms: returnedToStock ? 0 : 1,
        pendingCustodyReviewFirearms: documented ? 0 : 1, maintenanceFirearms: 1,
      } })
    }
    return route.fulfill({ json: [] })
  })
  return approvals
}

test('admin approval confirms stock and makes the firearm available', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  const approvals = await installInventory(page, 'admin', { rejectFirst: true })
  await page.goto('/firearms')
  const row = page.getByRole('row').filter({ hasText: 'REVIEW-1' })
  const approve = row.getByRole('button', { name: 'Approve custody review for serial REVIEW-1' })
  const pendingReviews = page.getByText('Pending custody reviews', { exact: true }).locator('..')
  await expect(pendingReviews.getByText('1', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Approve custody review for serial/ })).toHaveCount(1)
  await approve.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Approve custody review' })
  await expect(dialog).toBeInViewport()
  await expect(dialog.getByRole('button', { name: 'Approve and mark available' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(approve).toBeFocused()
  expect(approvals).toHaveLength(0)

  await approve.click()
  const reference = dialog.getByLabel('Source document reference')
  await reference.fill('   ')
  const submit = dialog.getByRole('button', { name: 'Approve and mark available' })
  const confirmedInStock = dialog.getByRole('checkbox', { name: 'I confirmed this firearm is physically back in stock' })
  await expect(submit).toBeDisabled()
  await reference.fill('  Base log 123  ')
  await expect(submit).toBeDisabled()
  await confirmedInStock.check()
  await submit.click()
  await expect(dialog.getByRole('alert')).toContainText('The source record changed.')
  await expect(dialog).toBeVisible()
  await expect(reference).toHaveValue('  Base log 123  ')
  await expect(pendingReviews.getByText('1', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(approve).toBeFocused()
  await page.reload()
  await approve.click()
  await reference.fill('Base log 123')
  await confirmedInStock.check()
  await submit.click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Firearm REVIEW-1 confirmed in stock and marked available.' })).toBeFocused()
  await expect(row.getByRole('cell', { name: /^available$/i })).toBeVisible()
  await expect(row.getByText('No verified active custody record')).toHaveCount(0)
  await expect(pendingReviews.getByText('0', { exact: true })).toBeVisible()
  await expect(page.getByRole('status').filter({ hasText: /1 imported firearm record/ })).toHaveCount(0)
  await expect(approve).toHaveCount(0)
  expect(approvals).toEqual(Array(2).fill({ sourceReference: 'Base log 123', inventoryUpdatedAt, confirmInStock: true }))
  await page.reload()
  await expect(row.getByRole('cell', { name: /^available$/i })).toBeVisible()
  await expect(pendingReviews.getByText('0', { exact: true })).toBeVisible()
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
    await dialog.getByRole('checkbox', { name: 'I confirmed this firearm is physically back in stock' }).check()
    await dialog.getByRole('button', { name: 'Approve and mark available' }).click()
    await expect(row.getByRole('cell', { name: /^available$/i })).toBeVisible()
    expect(approvals).toEqual([{ sourceReference: 'Base log 123', inventoryUpdatedAt, confirmInStock: true }])
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

    await expect(page.getByText('1 pending custody review', { exact: false })).toBeVisible()
    await approve.click()
    await dialog.getByLabel('Source document reference').fill('Base log 123')
    await dialog.getByRole('checkbox', { name: 'I confirmed this firearm is physically back in stock' }).check()
    await dialog.getByRole('button', { name: 'Approve and mark available' }).click()
    await expect(page.getByText('0 pending custody review', { exact: false })).toBeVisible()
    await expect(row).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: 'Firearm REVIEW-1 confirmed in stock and marked available.' })).toBeFocused()
    expect(approvals).toEqual([{ sourceReference: 'Base log 123', inventoryUpdatedAt, confirmInStock: true }])
  })
}

test('an earlier paperwork approval can be confirmed in stock', async ({ page }) => {
  const approvals = await installInventory(page, 'supervisor', { legacyApproved: true })
  await page.goto('/firearms')
  await page.getByRole('combobox', { name: 'Filter firearm inventory state' }).selectOption('custody_review')
  const row = page.getByRole('row').filter({ hasText: 'REVIEW-1' })
  await expect(row.getByText(/Review approved on/)).toBeVisible()
  await row.getByRole('button', { name: 'Confirm in stock for serial REVIEW-1' }).click()
  const dialog = page.getByRole('dialog', { name: 'Confirm firearm in stock' })
  await dialog.getByLabel('Source document reference').fill('Return log 456')
  await dialog.getByRole('checkbox', { name: 'I confirmed this firearm is physically back in stock' }).check()
  await dialog.getByRole('button', { name: 'Confirm and mark available' }).click()
  await expect(row).toHaveCount(0)
  await expect(page.getByRole('status').filter({ hasText: 'Firearm REVIEW-1 confirmed in stock and marked available.' })).toBeFocused()
  await page.getByRole('combobox', { name: 'Filter firearm inventory state' }).selectOption('')
  await expect(row.getByRole('cell', { name: /^available$/i })).toBeVisible()
  expect(approvals).toEqual([{ sourceReference: 'Return log 456', inventoryUpdatedAt, confirmInStock: true }])
})

test('a paperwork-only server response does not display the firearm as available', async ({ page }) => {
  await installInventory(page, 'admin', { legacyServer: true })
  await page.goto('/firearms')
  const row = page.getByRole('row').filter({ hasText: 'REVIEW-1' })
  await row.getByRole('button', { name: 'Approve custody review for serial REVIEW-1' }).click()
  const dialog = page.getByRole('dialog', { name: 'Approve custody review' })
  await dialog.getByLabel('Source document reference').fill('Return log 456')
  await dialog.getByRole('checkbox', { name: 'I confirmed this firearm is physically back in stock' }).check()
  await dialog.getByRole('button', { name: 'Approve and mark available' }).click()
  await expect(page.getByText('Review recorded. Stock confirmation is unavailable.')).toBeVisible()
  await expect(row.getByRole('cell', { name: /^custody review$/i })).toBeVisible()
})
