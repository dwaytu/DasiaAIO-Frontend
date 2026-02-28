/**
 * API Configuration
 * For production on Railway, add `?api_host=https://backend-service:port` to the frontend URL
 * Or set VITE_API_URL environment variable
 */

function getDefaultAPIURL(): string {
  // Build-time: VITE_API_URL is baked in by Vite from the ARG in Dockerfile / Railway build variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  if (typeof window !== 'undefined') {
    // Allow runtime override via query param (e.g. for testing)
    const apiHostParam = new URLSearchParams(window.location.search).get('api_host')
    if (apiHostParam) return apiHostParam

    const { hostname, protocol } = window.location

    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1' ||
        hostname.startsWith('192.168.') || hostname.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
      return `${protocol}//${hostname}:5000`
    }

    // Railway production — hardcoded fallback in case build arg was missing
    if (hostname.includes('.up.railway.app')) {
      return 'https://backend-production-0c47.up.railway.app'
    }
  }

  return 'http://localhost:5000'
}

export const API_BASE_URL = getDefaultAPIURL()
