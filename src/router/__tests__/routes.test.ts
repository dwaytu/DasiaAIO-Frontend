import { ROUTES, VIEW_TO_ROUTE } from '../routes'

describe('ROUTES', () => {
  it('exports all expected route paths', () => {
    expect(ROUTES.LOGIN).toBe('/login')
    expect(ROUTES.DASHBOARD).toBe('/dashboard')
    expect(ROUTES.OVERVIEW).toBe('/overview')
    expect(ROUTES.CALENDAR).toBe('/calendar')
    expect(ROUTES.PERFORMANCE).toBe('/performance')
    expect(ROUTES.MERIT).toBe('/merit')
    expect(ROUTES.FIREARMS).toBe('/firearms')
    expect(ROUTES.ALLOCATION).toBe('/allocation')
    expect(ROUTES.PERMITS).toBe('/permits')
    expect(ROUTES.MAINTENANCE).toBe('/maintenance')
    expect(ROUTES.ARMORED_CARS).toBe('/armored-cars')
    expect(ROUTES.PROFILE).toBe('/profile')
    expect(ROUTES.SETTINGS).toBe('/settings')
    expect(ROUTES.ANALYTICS).toBe('/analytics')
    expect(ROUTES.AUDIT).toBe('/audit')
    expect(ROUTES.SHIFT_SWAPS).toBe('/shift-swaps')
    expect(ROUTES.NOTIFICATIONS).toBe('/notifications')
    expect(ROUTES.SUPPORT).toBe('/support')
  })

  it('has only string values starting with /', () => {
    for (const value of Object.values(ROUTES)) {
      expect(typeof value).toBe('string')
      expect(value).toMatch(/^\//)
    }
  })
})

describe('VIEW_TO_ROUTE', () => {
  it('maps activeView keys from App.tsx to route paths', () => {
    expect(VIEW_TO_ROUTE['dashboard']).toBe(ROUTES.DASHBOARD)
    expect(VIEW_TO_ROUTE['overview']).toBe(ROUTES.OVERVIEW)
    expect(VIEW_TO_ROUTE['calendar']).toBe(ROUTES.CALENDAR)
    expect(VIEW_TO_ROUTE['performance']).toBe(ROUTES.PERFORMANCE)
    expect(VIEW_TO_ROUTE['merit']).toBe(ROUTES.MERIT)
    expect(VIEW_TO_ROUTE['firearms']).toBe(ROUTES.FIREARMS)
    expect(VIEW_TO_ROUTE['allocation']).toBe(ROUTES.ALLOCATION)
    expect(VIEW_TO_ROUTE['permits']).toBe(ROUTES.PERMITS)
    expect(VIEW_TO_ROUTE['maintenance']).toBe(ROUTES.MAINTENANCE)
    expect(VIEW_TO_ROUTE['armored-cars']).toBe(ROUTES.ARMORED_CARS)
    expect(VIEW_TO_ROUTE['profile']).toBe(ROUTES.PROFILE)
    expect(VIEW_TO_ROUTE['settings']).toBe(ROUTES.SETTINGS)
    expect(VIEW_TO_ROUTE['analytics']).toBe(ROUTES.ANALYTICS)
    expect(VIEW_TO_ROUTE['audit-log']).toBe(ROUTES.AUDIT)
    expect(VIEW_TO_ROUTE['support']).toBe(ROUTES.SUPPORT)
  })

  it('all values are valid ROUTES entries', () => {
    const routeValues = new Set(Object.values(ROUTES))
    for (const value of Object.values(VIEW_TO_ROUTE)) {
      expect(routeValues.has(value)).toBe(true)
    }
  })
})
