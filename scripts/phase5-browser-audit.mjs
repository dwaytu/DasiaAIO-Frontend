import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:5173'
const apiBaseUrl = process.env.AUDIT_API_BASE_URL ?? 'http://127.0.0.1:5000'
const identifier = process.env.AUDIT_SUPERADMIN_IDENTIFIER ?? 'superadmin'
const password = process.env.AUDIT_SUPERADMIN_PASSWORD ?? 'password123'
const outputDir = 'test-results/phase5'

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const failures = []
const results = []

function recordDiagnostics(page, diagnostics) {
  page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') {
      diagnostics.requestFailures.push(`${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'failed'}`)
    }
  })
  page.on('response', (response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      diagnostics.apiErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`)
    }
  })
}

async function assertVisible(page, selector, message) {
  if (!(await selector.isVisible().catch(() => false))) failures.push(message)
}

async function runViewport(name, viewport) {
  const context = await browser.newContext({ viewport, acceptDownloads: true })
  const page = await context.newPage()
  const diagnostics = { pageErrors: [], consoleErrors: [], requestFailures: [], apiErrors: [] }
  recordDiagnostics(page, diagnostics)

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    const identifierInput = page.locator('#identifier')
    if (!(await identifierInput.isVisible({ timeout: 10_000 }).catch(() => false))) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20_000 })
    }
    await identifierInput.fill(identifier)
    await page.locator('#password').fill(password)
    await page.getByRole('button', { name: 'Login', exact: true }).click()
    await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15_000 })

    await page.goto(`${baseUrl}/analytics`, { waitUntil: 'networkidle', timeout: 20_000 })
    await assertVisible(page, page.getByText('Resource Availability', { exact: true }), `${name}: resource availability chart is missing`)
    await assertVisible(page, page.getByText('Guard Evaluation Trend', { exact: true }), `${name}: evaluation trend chart is missing`)
    await assertVisible(page, page.getByText('Guard Evaluation Distribution', { exact: true }), `${name}: evaluation distribution is missing`)

    const availabilityStyle = await page.locator('[aria-label^="Guards:"]').evaluate((element) => {
      const container = element.getBoundingClientRect()
      const available = element.firstElementChild?.getBoundingClientRect()
      const color = element.firstElementChild ? getComputedStyle(element.firstElementChild).backgroundColor : ''
      return { containerHeight: container.height, availableWidth: available?.width ?? 0, color }
    })
    if (availabilityStyle.containerHeight < 8) failures.push(`${name}: availability graph has no visible height`)
    if (availabilityStyle.availableWidth < 1) failures.push(`${name}: available guard segment is not rendered`)
    if (!availabilityStyle.color || availabilityStyle.color === 'rgba(0, 0, 0, 0)') failures.push(`${name}: availability graph has no visible color`)

    const apiCheck = await page.evaluate(async (apiUrl) => {
      const token = localStorage.getItem('token') ?? ''
      const response = await fetch(`${apiUrl}/api/analytics/evaluations?days=30`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await response.json().catch(() => null)
      return { status: response.status, body }
    }, apiBaseUrl)
    if (apiCheck.status !== 200) failures.push(`${name}: evaluation analytics API returned ${apiCheck.status}`)
    if (!apiCheck.body?.summary || !Array.isArray(apiCheck.body?.trend) || !Array.isArray(apiCheck.body?.summary?.rating_distribution)) {
      failures.push(`${name}: evaluation analytics API returned an invalid payload`)
    }

    await page.screenshot({ path: `${outputDir}/analytics-${name}.png`, fullPage: true })

    await page.goto(`${baseUrl}/performance`, { waitUntil: 'networkidle', timeout: 20_000 })
    await assertVisible(page, page.getByRole('heading', { name: 'Guard Performance Report' }), `${name}: performance report is missing`)
    await assertVisible(page, page.getByRole('button', { name: 'Print' }), `${name}: print control is missing`)
    const csv = page.getByRole('button', { name: 'CSV' })
    await assertVisible(page, csv, `${name}: CSV control is missing`)
    if (await csv.isEnabled().catch(() => false)) {
      const [download] = await Promise.all([page.waitForEvent('download'), csv.click()])
      if (await download.failure()) failures.push(`${name}: performance CSV download failed`)
    }
    await page.screenshot({ path: `${outputDir}/performance-${name}.png`, fullPage: true })

    await page.goto(`${baseUrl}/merit`, { waitUntil: 'networkidle', timeout: 20_000 })
    await assertVisible(page, page.getByRole('heading', { name: 'Guard Merit and Evaluation Center' }), `${name}: merit center is missing`)
    await assertVisible(page, page.getByRole('heading', { name: 'Guard Merit Score Rankings' }), `${name}: merit rankings are missing`)
    if (await page.getByLabel(/Evaluator Name/i).count()) failures.push(`${name}: evaluator name can still be spoofed in the form`)
    await page.screenshot({ path: `${outputDir}/merit-${name}.png`, fullPage: true })

    const layout = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyTextLength: document.body.innerText.trim().length,
    }))
    if (layout.scrollWidth > layout.width + 1) failures.push(`${name}: horizontal overflow ${layout.scrollWidth}px > ${layout.width}px`)
    if (layout.bodyTextLength < 80) failures.push(`${name}: page rendered insufficient content`)

    for (const [kind, entries] of Object.entries(diagnostics)) {
      for (const entry of entries) failures.push(`${name}: ${kind}: ${entry}`)
    }
    results.push({ name, viewport, apiStatus: apiCheck.status, availabilityStyle, layout, diagnostics })
  } catch (error) {
    await page.screenshot({ path: `${outputDir}/failure-${name}.png`, fullPage: true }).catch(() => {})
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    await context.close()
  }
}

try {
  await runViewport('desktop', { width: 1440, height: 900 })
  await runViewport('mobile', { width: 390, height: 844 })
} finally {
  await browser.close()
}

console.log(JSON.stringify({ baseUrl, results, failures }, null, 2))
if (failures.length > 0) process.exitCode = 1
