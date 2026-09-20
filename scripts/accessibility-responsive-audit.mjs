import { chromium } from 'playwright'

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://localhost:5173'
const waitMs = Number(process.env.AUDIT_A11Y_WAIT_MS ?? 1200)
const viewports = (process.env.AUDIT_A11Y_VIEWPORTS ?? '320x844,375x844,768x1024,1280x900')
  .split(',')
  .map((value) => value.trim().match(/^(\d+)x(\d+)$/))
  .filter(Boolean)
  .map(([, width, height]) => ({ width: Number(width), height: Number(height), name: `${width}x${height}` }))

const roles = [
  {
    name: 'superadmin',
    identifier: process.env.AUDIT_SUPERADMIN_IDENTIFIER ?? 'superadmin',
    password: process.env.AUDIT_SUPERADMIN_PASSWORD ?? 'password123',
    routes: ['/dashboard', '/approvals', '/analytics', '/audit', '/manage', '/operations-map', '/firearms/compliance', '/settings', '/inbox'],
  },
  {
    name: 'admin',
    identifier: process.env.AUDIT_ADMIN_IDENTIFIER ?? 'admin',
    password: process.env.AUDIT_ADMIN_PASSWORD ?? 'password123',
    routes: ['/dashboard', '/approvals', '/schedule', '/allocation', '/firearms/compliance', '/manage', '/settings', '/inbox'],
  },
  {
    name: 'supervisor',
    identifier: process.env.AUDIT_SUPERVISOR_IDENTIFIER ?? 'supervisor',
    password: process.env.AUDIT_SUPERVISOR_PASSWORD ?? 'password123',
    routes: ['/dashboard', '/schedule', '/missions', '/allocation', '/firearms/compliance', '/operations-map', '/settings', '/inbox'],
  },
  {
    name: 'guard',
    identifier: process.env.AUDIT_GUARD_IDENTIFIER ?? 'guard',
    password: process.env.AUDIT_GUARD_PASSWORD ?? 'password123',
    routes: ['/overview', '/calendar', '/feedback', '/inbox', '/profile', '/settings', '/support'],
  },
]

const browser = await chromium.launch({ headless: true })
const failures = []
let routeChecks = 0
let rateLimitWarnings = 0

function addFailure(role, viewport, route, message) {
  failures.push(`${role} ${viewport} ${route}: ${message}`)
}

function accessibleName(element) {
  return (element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || '').replace(/\s+/g, ' ').trim()
}

async function login(page, account) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
  await page.locator('#identifier').fill(account.identifier)
  await page.locator('#password').fill(account.password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForTimeout(600)
  if (page.url().includes('/login')) throw new Error('login did not complete')
}

for (const account of roles) {
  const page = await browser.newPage()
  await login(page, account)

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    for (const route of account.routes) {
      routeChecks += 1
      const pageErrors = []
      const consoleErrors = []
      const onPageError = (error) => pageErrors.push(error.message)
      const onConsole = (message) => {
        if (message.type() !== 'error') return
        if (/\b429\b/.test(message.text())) {
          rateLimitWarnings += 1
          return
        }
        consoleErrors.push(message.text())
      }
      page.on('pageerror', onPageError)
      page.on('console', onConsole)

      try {
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
        await page.waitForTimeout(waitMs)

        const report = await page.evaluate(() => {
          const visible = (element) => {
            const style = window.getComputedStyle(element)
            const rect = element.getBoundingClientRect()
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
          }

          const unnamed = [...document.querySelectorAll('button, a, input, select, textarea')]
            .filter(visible)
            .filter((element) => {
              if (element.matches('input[type="hidden"]')) return false
              const name = element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent || ''
              if (name.trim()) return false
              if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
                if (element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`)) return false
                if (element.closest('label')) return false
              }
              return true
            })
            .map((element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`)

          const unlabeledFields = [...document.querySelectorAll('input, select, textarea')]
            .filter(visible)
            .filter((element) => !element.matches('input[type="hidden"]'))
            .filter((element) => {
              if (element.getAttribute('aria-label') || element.getAttribute('aria-labelledby')) return false
              if (element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`)) return false
              return !element.closest('label')
            })
            .map((element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`)

          const dialogsWithTransparentSurface = [...document.querySelectorAll('[role="dialog"]')]
            .filter(visible)
            .filter((dialog) => {
              const background = window.getComputedStyle(dialog).backgroundColor
              return background === 'transparent' || background.endsWith(', 0)')
            })
            .map((dialog) => dialog.getAttribute('aria-label') || dialog.getAttribute('aria-labelledby') || 'dialog')

          const guardSticky = document.querySelector('.guard-sticky-region')
          const main = document.querySelector('main')
          const stickyBottom = guardSticky ? guardSticky.getBoundingClientRect().top : 0
          const mainBottomPadding = main ? Number.parseFloat(window.getComputedStyle(main).paddingBottom) || 0 : 0
          const visibleMainCount = [...document.querySelectorAll('main')].filter(visible).length
          const visibleNavigationLabels = [...document.querySelectorAll('nav')]
            .filter(visible)
            .map((nav) => nav.getAttribute('aria-label') || nav.getAttribute('aria-labelledby') || '')
            .filter(Boolean)
          const duplicateNavigationLabels = [...new Set(visibleNavigationLabels)]
            .filter((label) => visibleNavigationLabels.filter((candidate) => candidate === label).length > 1)
          const skipLink = document.querySelector('a.skip-link[href^="#"]')
          const skipLinkTarget = skipLink?.getAttribute('href')?.slice(1)
          const hasWorkingSkipLink = Boolean(skipLinkTarget && document.getElementById(skipLinkTarget))

          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            unnamed,
            unlabeledFields,
            dialogsWithTransparentSurface,
            stickyBottom,
            mainBottomPadding,
            visibleMainCount,
            duplicateNavigationLabels,
            hasWorkingSkipLink,
          }
        })

        if (report.scrollWidth > report.innerWidth + 1) addFailure(account.name, viewport.name, route, `horizontal overflow ${report.scrollWidth}px > ${report.innerWidth}px`)
        if (report.unnamed.length) addFailure(account.name, viewport.name, route, `unnamed controls: ${report.unnamed.join(', ')}`)
        if (report.unlabeledFields.length) addFailure(account.name, viewport.name, route, `unlabeled fields: ${report.unlabeledFields.join(', ')}`)
        if (report.dialogsWithTransparentSurface.length) addFailure(account.name, viewport.name, route, `transparent dialogs: ${report.dialogsWithTransparentSurface.join(', ')}`)
        if (report.visibleMainCount !== 1) addFailure(account.name, viewport.name, route, `expected one visible main landmark, found ${report.visibleMainCount}`)
        if (report.duplicateNavigationLabels.length) addFailure(account.name, viewport.name, route, `duplicate navigation landmarks: ${report.duplicateNavigationLabels.join(', ')}`)
        if (!report.hasWorkingSkipLink) addFailure(account.name, viewport.name, route, 'missing or broken skip-to-content link')
        if (account.name === 'guard' && report.stickyBottom > 0 && report.mainBottomPadding < 100) {
          addFailure(account.name, viewport.name, route, `guard main bottom padding is only ${report.mainBottomPadding}px`)
        }
        if (pageErrors.length) addFailure(account.name, viewport.name, route, `page errors: ${pageErrors.join(' | ')}`)
        if (consoleErrors.length) addFailure(account.name, viewport.name, route, `console errors: ${consoleErrors.join(' | ')}`)
      } catch (error) {
        addFailure(account.name, viewport.name, route, error instanceof Error ? error.message : String(error))
      } finally {
        page.removeListener('pageerror', onPageError)
        page.removeListener('console', onConsole)
      }
    }
  }

  await page.close()
}

await browser.close()
console.log(JSON.stringify({ routeChecks, rateLimitWarnings, failures }, null, 2))
if (failures.length) process.exitCode = 1
