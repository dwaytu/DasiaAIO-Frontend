import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:5173'
const outputDir = path.resolve('output/playwright/module-captures-2026-10-23')
fs.mkdirSync(outputDir, { recursive: true })

const credentials = {
  superadmin: { identifier: 'superadmin', password: 'password123' },
  admin: { identifier: 'admin', password: 'password123' },
  supervisor: { identifier: 'supervisor', password: 'password123' },
  guard: { identifier: 'guard', password: 'password123' },
}

const elevatedRoutes = [
  ['dashboard', '/dashboard'], ['approvals', '/approvals'], ['requests', '/requests'],
  ['schedule', '/schedule'], ['calendar', '/calendar'], ['allocation', '/allocation'],
  ['feedback-dashboard', '/feedback-dashboard'], ['analytics', '/analytics'], ['dtr', '/dtr'],
  ['merit', '/merit'], ['audit', '/audit'], ['manage', '/manage'], ['mdr-import', '/mdr-import'],
  ['operations-map', '/operations-map'], ['firearms', '/firearms'],
  ['firearm-compliance', '/firearms/compliance'], ['guard-license-compliance', '/guards/compliance'],
  ['maintenance', '/maintenance'], ['armored-cars', '/armored-cars'], ['settings', '/settings'],
  ['performance', '/performance'], ['permits', '/permits'], ['inbox', '/inbox'],
  ['profile', '/profile'], ['support', '/support'], ['shift-swaps', '/shift-swaps'],
  ['notifications', '/notifications'], ['missions', '/missions'], ['trips', '/trips'], ['feedback', '/feedback'],
]

const guardRoutes = [
  ['overview', '/overview'], ['calendar', '/calendar'], ['permits', '/permits'], ['inbox', '/inbox'],
  ['profile', '/profile'], ['settings', '/settings'], ['support', '/support'], ['requests', '/requests'],
  ['feedback', '/feedback'],
]

function fileSafe(name) {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')
}

async function agreeToTerms(page) {
  const terms = page.getByLabel(/terms of agreement/i).first()
  if (await terms.isVisible().catch(() => false)) await terms.check().catch(() => terms.click())
  const location = page.getByLabel(/consent to location processing/i).first()
  if (await location.isVisible().catch(() => false)) await location.check().catch(() => location.click())
  const agree = page.getByRole('button', { name: /agree and continue/i }).first()
  if (await agree.isVisible().catch(() => false)) {
    await agree.click()
    await page.waitForTimeout(650)
  }
}

async function login(page, role) {
  const account = credentials[role]
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
  await page.getByLabel(/email.*username.*phone|identifier/i).fill(account.identifier)
  await page.getByLabel('Password').fill(account.password)
  await page.getByRole('button', { name: /^login$/i }).click()
  await page.waitForTimeout(900)
  await agreeToTerms(page)
  if (page.url().includes('/login')) throw new Error(`${role} login did not complete`)
}

async function waitForPage(page) {
  await page.waitForTimeout(750)
  await page.locator('main, [role="main"], body').first().waitFor({ state: 'visible', timeout: 12_000 })
}

async function captureRoute(page, role, module, route, report) {
  const prefix = `${role}-${fileSafe(module)}`
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded' })
    await waitForPage(page)
    await page.screenshot({ path: path.join(outputDir, `${prefix}-full.png`), fullPage: true })

    const scrollTargets = await page.evaluate(() => {
      const viewportWidth = window.innerWidth
      return Array.from(document.querySelectorAll('.soc-scroll-area, main *'))
        .filter((element) => {
          const style = window.getComputedStyle(element)
          const bounds = element.getBoundingClientRect()
          return (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            element.scrollHeight > element.clientHeight + 20 &&
            bounds.width >= viewportWidth * 0.4 &&
            bounds.height >= 160
          )
        })
        .map((element) => ({ className: element.className, height: element.clientHeight, contentHeight: element.scrollHeight }))
    })
    const scrollAreaMetrics = await page.locator('.soc-scroll-area').evaluateAll((elements) => elements.map((node) => {
      const bounds = node.getBoundingClientRect()
      return { height: node.clientHeight, contentHeight: node.scrollHeight, width: node.clientWidth, overflowY: getComputedStyle(node).overflowY, top: bounds.top }
    }))
    const scrollable = scrollTargets.length > 0
    if (scrollable) {
      await page.evaluate(() => {
        const viewportWidth = window.innerWidth
        Array.from(document.querySelectorAll('.soc-scroll-area, main *'))
          .filter((element) => {
            const style = window.getComputedStyle(element)
            const bounds = element.getBoundingClientRect()
            return (
              (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
              element.scrollHeight > element.clientHeight + 20 &&
              bounds.width >= viewportWidth * 0.4 &&
              bounds.height >= 160
            )
          })
          .forEach((element) => { element.scrollTop = element.scrollHeight })
      })
      await page.waitForTimeout(250)
      await page.screenshot({ path: path.join(outputDir, `${prefix}-scrolled-lower-section.png`) })
      await page.evaluate(() => {
        document.querySelectorAll('.soc-scroll-area, main *').forEach((element) => { element.scrollTop = 0 })
      })
    }
    report.captures.push({ role, module, requestedRoute: route, resolvedRoute: new URL(page.url()).pathname, scrollable, scrollTargets, scrollAreaMetrics, status: 'captured' })
  } catch (error) {
    await page.screenshot({ path: path.join(outputDir, `${prefix}-error.png`), fullPage: true }).catch(() => {})
    report.captures.push({ role, module, requestedRoute: route, resolvedRoute: new URL(page.url()).pathname, status: 'failed', error: error.message })
  }
}

async function runRole(browser, role, routes, report) {
  const context = await browser.newContext({ viewport: { width: 1536, height: 600 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  page.on('pageerror', (error) => report.pageErrors.push({ role, message: error.message }))
  try {
    await login(page, role)
    for (const [module, route] of routes) await captureRoute(page, role, module, route, report)
  } finally {
    await context.close()
  }
}

const browser = await chromium.launch({ headless: true })
const report = { generatedAt: new Date().toISOString(), baseUrl, captures: [], pageErrors: [] }
try {
  await runRole(browser, 'superadmin', elevatedRoutes, report)
  await runRole(browser, 'admin', [['dashboard', '/dashboard']], report)
  await runRole(browser, 'supervisor', [['dashboard', '/dashboard']], report)
  await runRole(browser, 'guard', guardRoutes, report)
} finally {
  await browser.close()
}

fs.writeFileSync(path.join(outputDir, 'capture-report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify({ outputDir, captured: report.captures.filter((item) => item.status === 'captured').length, failed: report.captures.filter((item) => item.status === 'failed').length }, null, 2))
