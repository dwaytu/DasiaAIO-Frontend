import { startResolvedLocationWatch } from '../location'

describe('startResolvedLocationWatch', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  it('starts and clears browser watchPosition on web', async () => {
    const clearWatch = jest.fn()
    const watchPosition = jest.fn((onSuccess: (position: GeolocationPosition) => void) => {
      onSuccess({
        coords: {
          latitude: 7.4478,
          longitude: 125.8078,
          accuracy: 12,
          heading: null,
          speed: null,
          altitude: null,
          altitudeAccuracy: null,
        },
        timestamp: Date.now(),
      } as GeolocationPosition)

      return 42
    })

    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      writable: true,
      value: {
        watchPosition,
        clearWatch,
      },
    })

    const onLocation = jest.fn()
    const stop = await startResolvedLocationWatch('web', onLocation)

    expect(watchPosition).toHaveBeenCalledTimes(1)
    expect(onLocation).toHaveBeenCalledWith(expect.objectContaining({
      latitude: 7.4478,
      longitude: 125.8078,
      source: 'gps',
    }))

    stop()
    expect(clearWatch).toHaveBeenCalledWith(42)
  })

  it('throws when browser geolocation is unavailable', async () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      writable: true,
      value: undefined,
    })

    await expect(
      startResolvedLocationWatch('web', jest.fn()),
    ).rejects.toThrow('Geolocation is not supported on this platform.')
  })
})
