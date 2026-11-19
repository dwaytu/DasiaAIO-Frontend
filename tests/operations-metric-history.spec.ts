import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'block', hasTouch: true })

test('plots only observed checks and reveals the selected reading', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.clock.install({ time: new Date('2026-11-19T12:00:00Z') })
  await page.clock.pauseAt(new Date('2026-11-19T12:00:01Z'))
  await page.addInitScript(() => {
    localStorage.setItem('token', 'fixture-token')
    localStorage.setItem('user', JSON.stringify({
      id: 'viewer', role: 'supervisor', username: 'Fixture Supervisor', legalConsentAccepted: true,
    }))
  })

  let nextReading = false
  await page.route('**/api/**', async (route) => {
    switch (new URL(route.request().url()).pathname) {
      case '/api/health/system':
        return route.fulfill({ json: { services: { database: 'up', api: 'up', websocket: { status: nextReading ? 'down' : 'up' } } } })
      case '/api/firearm-allocations/overdue':
        return route.fulfill({ json: nextReading ? [{ id: 'overdue-fixture' }] : [] })
      case '/api/incidents/active':
        return route.fulfill({ json: { total: nextReading ? 1 : 52, incidents: [] } })
      default:
        return route.fulfill({ json: [] })
    }
  })

  await page.goto('/dashboard')
  const system = page.getByRole('button', { name: 'System readings' })
  const threat = page.getByRole('button', { name: 'Threat readings' })
  const incidents = page.getByRole('button', { name: 'Incidents readings' })
  const tooltip = page.getByRole('tooltip')

  for (const [trigger, label] of [[system, '5 / 5 services online'], [threat, '0 active alerts'], [incidents, '52 active incidents']] as const) {
    await trigger.hover()
    await expect(tooltip).toContainText(label)
    await expect(trigger.locator('polyline')).toHaveCount(0)
  }
  const firstCheck = await tooltip.locator('time').getAttribute('datetime')

  nextReading = true
  await page.clock.fastForward(16_000)
  for (const trigger of [system, threat, incidents]) {
    await expect(trigger.locator('polyline')).toHaveCount(1)
  }

  await system.locator('svg').hover({ position: { x: 90, y: 10 } })
  await expect(tooltip).toContainText('3 / 5 services online')
  await system.locator('svg').hover({ position: { x: 4, y: 10 } })
  await expect(tooltip).toContainText('5 / 5 services online')
  await tooltip.hover()
  await expect(tooltip).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tooltip).toHaveCount(0)

  await system.focus()
  await page.keyboard.press('Tab')
  await expect(threat).toBeFocused()
  await expect(tooltip).toContainText('1 active alert')
  await threat.press('ArrowLeft')
  await expect(tooltip).toContainText('0 active alerts')
  await threat.press('Escape')
  await expect(tooltip).toHaveCount(0)

  await incidents.locator('svg').hover({ position: { x: 4, y: 10 } })
  await expect(tooltip.locator('time')).toHaveAttribute('datetime', firstCheck!)
  await expect(tooltip).toContainText('52 active incidents')
  await page.screenshot({ path: testInfo.outputPath('desktop.png') })

  await page.setViewportSize({ width: 390, height: 844 })
  await incidents.tap()
  await expect(tooltip).toContainText('1 active incident')
  await expect(tooltip).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath('mobile.png') })
})
