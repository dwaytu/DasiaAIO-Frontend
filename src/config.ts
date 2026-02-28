/**
 * API Configuration
 * For production on Railway, add `?api_host=https://backend-service:port` to the frontend URL
 * Or set VITE_API_URL environment variable
 */

function getDefaultAPIURL(): string {
  // If VITE_API_URL is explicitly set (e.g., in Railway production), use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  // For development and runtime detection
  if (typeof window !== 'undefined') {
    // Check URL query parameters for api_host (useful for Railway)
    const params = new URLSearchParams(window.location.search)
    const apiHostParam = params.get('api_host')
    if (apiHostParam) {
      return apiHostParam
    }

    const hostname = window.location.hostname
    const protocol = window.location.protocol
    
    // Check if it's a local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    const isLocalNetwork = 
      hostname === 'localhost' || 
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    
    // If running on local network, use port 5000 for backend
    if (isLocalNetwork) {
      return `${protocol}//${hostname}:5000`
    }
    
    // For Railway deployed frontend, VITE_API_URL must be set as a build-time variable
    // in the Railway service settings pointing to the backend service URL.
    // If it reaches here without VITE_API_URL set, log a warning.
    if (hostname.includes('.up.railway.app')) {
      console.warn('VITE_API_URL is not set. Set it in Railway frontend service variables to point to the backend URL.')
      return 'https://backend-production-0c47.up.railway.app'
    }
    
    // For other remote deployments, don't append a port (assume standard HTTPS)
    return `${protocol}//${hostname}`
  }

  // Fallback
  return 'http://localhost:5000'
}

export const API_BASE_URL = getDefaultAPIURL()
