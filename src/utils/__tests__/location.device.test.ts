import { resolveDeviceLocation, resolveLocationWithFallback } from '../location'

describe('resolveDeviceLocation', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('returns GPS position on web when geolocation succeeds', async () => {
    const getCurrentPosition = jest.fn((onSuccess: PositionCallback) => {
      onSuccess({
        coords: {
          latitude: 7.4478,
          longitude: 125.8078,
          accuracy: 10,
          heading: 90,
          speed: 1.5,
          altitude: null,
          altitudeAccuracy: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition)
    })

    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      writable: true,
      value: { getCurrentPosition },
    })

    Object.defineProperty(globalThis.window, 'isSecureContext', {
      configurable: true,
      writable: true,
      value: true,
    })

    const result = await resolveDeviceLocation('web')

    expect(result.source).toBe('gps')
    expect(result.latitude).toBe(7.4478)
    expect(result.longitude).toBe(125.8078)
    expect(result.accuracyMeters).toBe(10)
  })

  it('throws when browser geolocation is denied — never falls back to IP', async () => {
    const getCurrentPosition = jest.fn(
      (_onSuccess: PositionCallback, onError?: PositionErrorCallback) => {
        onError?.({
          code: 1,
          message: 'User denied Geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        })
      },
    )

    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      writable: true,
      value: { getCurrentPosition },
    })

    Object.defineProperty(globalThis.window, 'isSecureContext', {
      configurable: true,
      writable: true,
      value: true,
    })

    await expect(resolveDeviceLocation('web')).rejects.toThrow()
  })

  it('throws on non-secure context — never falls back to IP', async () => {
    Object.defineProperty(globalThis.window, 'isSecureContext', {
      configurable: true,
      writable: true,
      value: false,
    })

    await expect(resolveDeviceLocation('web')).rejects.toThrow(
      'Device geolocation is not available on this platform.',
    )
  })
})

describe('resolveLocationWithFallback (PanicButton path)', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('falls back to IP when device geolocation fails and returns source "ip"', async () => {
    // Make device geolocation fail
    Object.defineProperty(globalThis.window, 'isSecureContext', {
      configurable: true,
      writable: true,
      value: false,
    })

    // Mock fetch for IP fallback
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ loc: '7.45,125.81' }),
    })
    globalThis.fetch = mockFetch

    const result = await resolveLocationWithFallback('web')

    expect(result.source).toBe('ip')
    expect(result.latitude).toBeCloseTo(7.45)
    expect(result.longitude).toBeCloseTo(125.81)
  })
})
