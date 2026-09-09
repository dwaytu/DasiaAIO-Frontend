import { expect, test, type Page, type Route } from '@playwright/test'

type RequestRecord = {
  id: string
  requestType: string
  status: string
  requesterId: string
  requesterName: string
  subject: string
  reason: string
  details?: string
  priority: string
  createdAt: string
  updatedAt: string
  decisionReason?: string
}

function installSession(page: Page, role: 'guard' | 'admin') {
  return page.addInitScript((sessionRole) => {
    localStorage.setItem('token', 'phase-4-browser-token')
    localStorage.setItem('user', JSON.stringify({
      id: sessionRole === 'guard' ? 'guard-1' : 'admin-1',
      email: `${sessionRole}@example.com`,
      username: sessionRole,
      fullName: sessionRole === 'guard' ? 'Test Guard' : 'Test Administrator',
      role: sessionRole,
      legalConsentAccepted: true,
    }))
    localStorage.setItem('dasi.toa.accepted.v1', 'accepted')
    localStorage.setItem('dasi.locationConsent.v1', 'accepted')
  }, role)
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

function installRequestApi(page: Page, initial: RequestRecord[] = []) {
  const requests = [...initial]
  const events = new Map<string, Array<Record<string, unknown>>>()

  return page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === '/api/operational-requests/resources/mine') {
      await fulfillJson(route, { firearmAllocations: [], equipment: [] })
      return
    }

    if (path === '/api/operational-requests' && request.method() === 'GET') {
      const pageNumber = Number(url.searchParams.get('page') ?? 1)
      const pageSize = Number(url.searchParams.get('pageSize') ?? 100)
      const status = url.searchParams.get('status')
      const filtered = requests.filter((item) => !status || item.status === status)
      await fulfillJson(route, {
        total: filtered.length,
        page: pageNumber,
        pageSize,
        items: filtered.slice((pageNumber - 1) * pageSize, pageNumber * pageSize),
      })
      return
    }

    if (path === '/api/operational-requests' && request.method() === 'POST') {
      const payload = request.postDataJSON()
      const now = new Date().toISOString()
      const created: RequestRecord = {
        id: `request-${requests.length + 1}`,
        requestType: payload.requestType,
        status: 'pending',
        requesterId: 'guard-1',
        requesterName: 'Test Guard',
        subject: payload.subject,
        reason: payload.reason,
        details: payload.details,
        priority: payload.priority,
        createdAt: now,
        updatedAt: now,
      }
      requests.unshift(created)
      events.set(created.id, [{
        id: `event-${created.id}-1`,
        requestId: created.id,
        actorUserId: 'guard-1',
        actorName: 'Test Guard',
        fromStatus: null,
        toStatus: 'pending',
        comment: created.reason,
        createdAt: now,
      }])
      await fulfillJson(route, { request: created }, 201)
      return
    }

    const actionMatch = path.match(/^\/api\/operational-requests\/([^/]+)\/(approve|reject|return-for-correction|cancel|start|complete)$/)
    if (actionMatch && request.method() === 'POST') {
      const [, id, action] = actionMatch
      const record = requests.find((item) => item.id === id)
      if (!record) {
        await fulfillJson(route, { message: 'Not found' }, 404)
        return
      }
      const statusByAction: Record<string, string> = {
        approve: 'approved',
        reject: 'rejected',
        'return-for-correction': 'needs_correction',
        cancel: 'cancelled',
        start: 'in_progress',
        complete: 'completed',
      }
      const payload = request.postDataJSON()
      record.status = statusByAction[action]
      record.decisionReason = payload.reason
      record.updatedAt = new Date().toISOString()
      events.set(id, [...(events.get(id) ?? []), {
        id: `event-${id}-${(events.get(id)?.length ?? 0) + 1}`,
        requestId: id,
        actorUserId: 'admin-1',
        actorName: 'Test Administrator',
        fromStatus: 'pending',
        toStatus: record.status,
        comment: payload.reason,
        createdAt: record.updatedAt,
      }])
      await fulfillJson(route, { request: record })
      return
    }

    const detailMatch = path.match(/^\/api\/operational-requests\/([^/]+)$/)
    if (detailMatch && request.method() === 'GET') {
      const record = requests.find((item) => item.id === detailMatch[1])
      await fulfillJson(route, record ? { request: record, events: events.get(record.id) ?? [] } : { message: 'Not found' }, record ? 200 : 404)
      return
    }

    await fulfillJson(route, [])
  })
}

test('guard submits a service request from the guard workspace', async ({ page }) => {
  await installSession(page, 'guard')
  await installRequestApi(page)
  await page.goto('/requests')

  await expect(page.getByRole('heading', { name: 'Operational Requests' })).toBeVisible()
  await page.getByRole('button', { name: 'New Request' }).click()
  await page.getByLabel('Subject').fill('Relief service request')
  await page.getByLabel('Reason and purpose').fill('Relief support is required for the next shift.')
  await page.getByRole('button', { name: 'Submit for Review' }).click()

  await expect(page.getByText('Request submitted for review.')).toBeVisible()
  const createdRequest = page.getByRole('button', { name: /Relief service request/ })
  await expect(createdRequest).toBeVisible()
  await expect(createdRequest).toContainText('Pending Review')
})

test('administrator reviews a pending request and sees its history', async ({ page }) => {
  const now = new Date().toISOString()
  await installSession(page, 'admin')
  await installRequestApi(page, [{
    id: 'request-approval-1',
    requestType: 'service',
    status: 'pending',
    requesterId: 'guard-1',
    requesterName: 'Test Guard',
    subject: 'Escort service request',
    reason: 'Client requested an additional escort.',
    priority: 'high',
    createdAt: now,
    updatedAt: now,
  }])
  await page.goto('/requests')

  await page.getByRole('button', { name: /Escort service request/ }).click()
  await page.getByRole('button', { name: 'Approve' }).click()
  await page.getByLabel('Approve note').fill('Staffing and schedule verified.')
  await page.getByRole('button', { name: 'Confirm' }).click()

  await expect(page.getByText('Approve recorded.')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Selected request details' }).getByText('Approved').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Request History' })).toBeVisible()
})

test('older requests remain reachable and filters reset pagination', async ({ page }) => {
  const now = new Date().toISOString()
  await installSession(page, 'admin')
  await installRequestApi(page, Array.from({ length: 101 }, (_, index) => ({
    id: `request-${index}`,
    requestType: 'service',
    status: index === 100 ? 'completed' : 'pending',
    requesterId: 'guard-1',
    requesterName: 'Test Guard',
    subject: `Service item ${index + 1}`,
    reason: 'Pagination regression fixture',
    priority: 'normal',
    createdAt: now,
    updatedAt: now,
  })))
  await page.goto('/requests')
  await expect(page.getByText('Page 1 of 5 (101 requests)')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous request page' })).toBeDisabled()
  for (let next = 2; next <= 5; next += 1) {
    await page.getByRole('button', { name: 'Next request page' }).click()
    await expect(page.getByText(`Page ${next} of 5 (101 requests)`)).toBeVisible()
  }
  await expect(page.getByRole('button', { name: /Service item 101/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next request page' })).toBeDisabled()
  await page.getByRole('combobox', { name: /^Status/ }).selectOption('completed')
  await expect(page.getByText('Page 1 of 1 (1 requests)')).toBeVisible()
  await expect(page.getByRole('button', { name: /Service item 101/ })).toBeVisible()
})

test('new request does not resubmit the selected correction request', async ({ page }) => {
  const now = new Date().toISOString()
  await installSession(page, 'guard')
  await installRequestApi(page, [{
    id: 'correction-request', requestType: 'service', status: 'needs_correction',
    requesterId: 'guard-1', requesterName: 'Test Guard', subject: 'Original request',
    reason: 'Correction required', priority: 'normal', createdAt: now, updatedAt: now,
  }])
  await page.goto('/requests')
  await page.getByRole('button', { name: /Original request/ }).click()
  await page.getByRole('button', { name: 'New Request' }).click()
  await expect(page.getByRole('heading', { name: 'Create Request' })).toBeVisible()
  await page.getByLabel('Subject').fill('Separate service request')
  await page.getByLabel('Reason and purpose').fill('This is a different request.')
  await page.getByRole('button', { name: 'Submit for Review' }).click()
  await expect(page.getByRole('button', { name: /Separate service request/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Original request/ })).toContainText('Needs Correction')
})
