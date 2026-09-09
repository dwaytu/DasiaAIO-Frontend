import { mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:5173'
const superadminIdentifier = process.env.AUDIT_SUPERADMIN_IDENTIFIER ?? 'superadmin'
const superadminPassword = process.env.AUDIT_SUPERADMIN_PASSWORD ?? 'password123'
const guardIdentifier = process.env.AUDIT_GUARD_IDENTIFIER ?? 'guard'
const guardPassword = process.env.AUDIT_GUARD_PASSWORD ?? 'password123'
const outputDir = 'test-results/system-audit'

await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
const results = []

async function runViewport(name, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const pageErrors = []
  const apiErrors = []
  const apiFailures = []

  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      const detail = `${response.status()} ${response.request().method()} ${response.url()}`
      apiErrors.push(detail)
      if (response.status() >= 500) apiFailures.push(detail)
    }
  })

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#identifier').fill(superadminIdentifier)
  await page.locator('#password').fill(superadminPassword)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 15_000 })
  await page.waitForLoadState('networkidle')

  await page.goto(`${baseUrl}/performance`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Guard Performance Report' }).waitFor()
  const guardCountDetail = page.getByText(/guards? tracked$/).first()
  await guardCountDetail.waitFor()
  const trackedGuards = (await guardCountDetail.textContent())?.trim() ?? ''
  const alertText = await page.locator('[role="alert"]').allTextContents()

  const layout = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyTextLength: document.body.innerText.trim().length,
  }))

  await page.screenshot({
    path: `${outputDir}/performance-${name}.png`,
    fullPage: true,
  })

  results.push({ kind: 'performance', name, trackedGuards, alertText, layout, pageErrors, apiErrors, apiFailures })

  await page.goto(`${baseUrl}/dtr`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Daily Time Record' }).waitFor()
  const dtrEntries = page.getByRole('heading', { name: 'DTR Entries' })
  await dtrEntries.waitFor()
  const dtrEntryDetail = (await dtrEntries.textContent())?.trim() ?? ''
  await page.getByRole('button', { name: 'Print' }).waitFor()
  const csvButton = page.getByRole('button', { name: 'CSV' })
  await csvButton.waitFor()
  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    csvButton.click(),
  ])
  const csvDownloadFailure = await csvDownload.failure()
  const dtrLayout = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyTextLength: document.body.innerText.trim().length,
  }))
  const dtrAlertText = await page.locator('[role="alert"]').allTextContents()

  await page.screenshot({
    path: `${outputDir}/dtr-${name}.png`,
    fullPage: true,
  })

  results.push({
    kind: 'dtr',
    name,
    dtrEntryDetail,
    csvDownloadFailure,
    alertText: dtrAlertText,
    layout: dtrLayout,
    pageErrors,
    apiErrors,
    apiFailures,
  })

  await page.goto(`${baseUrl}/firearms/compliance`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: 'Firearm Compliance', exact: true }).waitFor()
  await page.getByRole('heading', { name: 'Firearm records', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Sync alerts' }).click()
  await page.getByText(/compliance notification.*created\./i).waitFor()
  const complianceLayout = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyTextLength: document.body.innerText.trim().length,
  }))
  const complianceAlertText = await page.locator('[role="alert"]').allTextContents()

  await page.screenshot({
    path: `${outputDir}/firearm-compliance-${name}.png`,
    fullPage: true,
  })

  results.push({
    kind: 'firearm-compliance',
    name,
    complianceDetail: 'Firearm Compliance',
    alertText: complianceAlertText,
    layout: complianceLayout,
    pageErrors,
    apiErrors,
    apiFailures,
  })
  await context.close()
}

async function runGuardDashboard(name, viewport) {
  const context = await browser.newContext({ viewport })
  const page = await context.newPage()
  const pageErrors = []
  const apiErrors = []
  const apiFailures = []

  page.on('pageerror', error => pageErrors.push(error.message))
  page.on('response', response => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      const detail = `${response.status()} ${response.request().method()} ${response.url()}`
      apiErrors.push(detail)
      if (response.status() >= 500) apiFailures.push(detail)
    }
  })

  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' })
  await page.locator('#identifier').fill(guardIdentifier)
  await page.locator('#password').fill(guardPassword)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL(url => !url.pathname.endsWith('/login'), { timeout: 15_000 })
  await page.getByText('Field Operations', { exact: true }).waitFor()
  await page.waitForLoadState('networkidle')

  const sosBox = await page.getByRole('button', { name: /Emergency SOS/ }).boundingBox()
  const contactBoxes = await page.locator('nav[aria-label="Emergency contacts"] a').evaluateAll(links =>
    links.map(link => {
      const box = link.getBoundingClientRect()
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }
    }),
  )
  const sosContactOverlaps = sosBox
    ? contactBoxes.filter(box =>
        Math.max(0, Math.min(sosBox.x + sosBox.width, box.right) - Math.max(sosBox.x, box.left)) > 0 &&
        Math.max(0, Math.min(sosBox.y + sosBox.height, box.bottom) - Math.max(sosBox.y, box.top)) > 0,
      ).length
    : 0

  const layout = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyTextLength: document.body.innerText.trim().length,
  }))

  await page.screenshot({
    path: `${outputDir}/guard-dashboard-${name}.png`,
    fullPage: true,
  })

  results.push({ kind: 'guard', name, layout, sosContactOverlaps, pageErrors, apiErrors, apiFailures, alertText: [] })
  await context.close()
}

try {
  await runViewport('desktop', { width: 1440, height: 900 })
  await runViewport('mobile', { width: 390, height: 844 })
  await runGuardDashboard('mobile', { width: 390, height: 844 })
  await runGuardDashboard('narrow-mobile', { width: 320, height: 700 })
} finally {
  await browser.close()
}

const failures = results.flatMap(result => [
  ...result.pageErrors.map(error => `${result.name} page error: ${error}`),
  ...result.apiErrors.map(error => `${result.name} API error: ${error}`),
  ...result.alertText.map(error => `${result.name} visible alert: ${error}`),
  ...(result.kind === 'performance' && !/^\d+ guards? tracked$/.test(result.trackedGuards)
    ? [`${result.name} invalid guard count detail: ${result.trackedGuards}`]
    : []),
  ...(result.kind === 'dtr' && result.dtrEntryDetail !== 'DTR Entries'
    ? [`${result.name} invalid DTR entry detail: ${result.dtrEntryDetail}`]
    : []),
  ...(result.kind === 'dtr' && result.csvDownloadFailure
    ? [`${result.name} CSV download failed: ${result.csvDownloadFailure}`]
    : []),
  ...(result.kind === 'firearm-compliance' && result.complianceDetail !== 'Firearm Compliance'
    ? [`${result.name} firearm compliance page did not render correctly`]
    : []),
  ...(result.layout.scrollWidth > result.layout.innerWidth + 1
    ? [`${result.name} horizontal overflow: ${result.layout.scrollWidth}px > ${result.layout.innerWidth}px`]
    : []),
  ...(result.layout.bodyTextLength === 0 ? [`${result.name} rendered an empty document`] : []),
  ...(result.kind === 'guard' && result.sosContactOverlaps > 0
    ? [`${result.name} SOS overlaps ${result.sosContactOverlaps} emergency contact controls`]
    : []),
])

console.log(JSON.stringify({ results, failures }, null, 2))
if (failures.length > 0) process.exitCode = 1
