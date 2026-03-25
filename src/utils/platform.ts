export type RuntimePlatform = 'web' | 'capacitor' | 'tauri'

const hasWindow = typeof window !== 'undefined'

export const detectRuntimePlatform = (): RuntimePlatform => {
  if (!hasWindow) return 'web'

  const windowWithRuntime = window as typeof window & {
    Capacitor?: { isNativePlatform?: () => boolean }
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }

  if (windowWithRuntime.Capacitor?.isNativePlatform?.()) {
    return 'capacitor'
  }

  if (windowWithRuntime.__TAURI__ || windowWithRuntime.__TAURI_INTERNALS__) {
    return 'tauri'
  }

  return 'web'
}

export const applyPlatformDomAttributes = (): RuntimePlatform => {
  if (!hasWindow) return 'web'

  const platform = detectRuntimePlatform()
  const root = window.document.documentElement
  const body = window.document.body

  root.dataset.platform = platform
  body.dataset.platform = platform

  body.classList.remove('platform-web', 'platform-mobile', 'platform-desktop')

  if (platform === 'capacitor') {
    body.classList.add('platform-mobile')
  } else if (platform === 'tauri') {
    body.classList.add('platform-desktop')
  } else {
    body.classList.add('platform-web')
  }

  return platform
}
