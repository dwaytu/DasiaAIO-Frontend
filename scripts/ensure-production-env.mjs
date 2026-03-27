const REQUIRED_VARS = ['VITE_API_BASE_URL', 'VITE_APP_VERSION']
const DISALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0'])
const DISALLOWED_EXACT = new Set(['10.0.2.2'])

const mode = process.argv[2] || 'release'

function fail(message) {
  console.error(`\n[release-check] ${message}\n`)
  process.exit(1)
}

function isPrivateHost(hostname) {
  if (hostname.startsWith('192.168.')) return true
  if (hostname.startsWith('10.')) return true
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true
  return false
}

for (const key of REQUIRED_VARS) {
  const value = process.env[key]
  if (!value || !value.trim()) {
    fail(`${key} is required for ${mode} builds.`)
  }
}

const apiBaseUrl = process.env.VITE_API_BASE_URL.trim()
let parsed

try {
  parsed = new URL(apiBaseUrl)
} catch {
  fail(`VITE_API_BASE_URL must be a valid URL. Received: ${apiBaseUrl}`)
}

if (parsed.protocol !== 'https:') {
  fail(`VITE_API_BASE_URL must use HTTPS for ${mode}. Received protocol: ${parsed.protocol}`)
}

if (DISALLOWED_HOSTS.has(parsed.hostname) || DISALLOWED_EXACT.has(parsed.hostname) || isPrivateHost(parsed.hostname)) {
  fail(`VITE_API_BASE_URL points to a local/private host (${parsed.hostname}). Refusing ${mode} build.`)
}

const appVersion = process.env.VITE_APP_VERSION.trim().toLowerCase()
if (!appVersion || appVersion === 'dev' || appVersion === 'development') {
  fail(`VITE_APP_VERSION must be a release version and cannot be '${process.env.VITE_APP_VERSION}'.`)
}

if (!/^v?\d+\.\d+\.\d+([-.][0-9a-zA-Z.]+)?$/.test(process.env.VITE_APP_VERSION.trim())) {
  fail(`VITE_APP_VERSION should follow semantic versioning (for example v1.2.3). Received: ${process.env.VITE_APP_VERSION}`)
}

console.log(`[release-check] Production env validated for ${mode}.`)
