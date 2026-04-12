import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PanicButton from '../PanicButton'
import { resolveLocationWithFallback } from '../../../utils/location'
import { enqueueOfflineAction } from '../../../utils/offlineQueue'

jest.mock('../../../config', () => ({
  API_BASE_URL: 'https://example.test',
  detectRuntimePlatform: () => 'capacitor',
}))

jest.mock('../../../utils/location', () => ({
  resolveLocationWithFallback: jest.fn(async () => ({
    latitude: 7.123456,
    longitude: 125.654321,
    accuracyMeters: 9,
    heading: null,
    speedKph: null,
    source: 'capacitor',
  })),
}))

jest.mock('../../../utils/api', () => ({
  getAuthToken: () => 'token',
}))

jest.mock('../../../utils/offlineQueue', () => ({
  enqueueOfflineAction: jest.fn(async () => undefined),
}))

const mockedResolveLocationWithFallback = resolveLocationWithFallback as jest.MockedFunction<typeof resolveLocationWithFallback>
const mockedEnqueueOfflineAction = enqueueOfflineAction as jest.MockedFunction<typeof enqueueOfflineAction>

describe('PanicButton', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: jest.fn().mockResolvedValue({ ok: true, status: 201 }),
    })

    Object.defineProperty(globalThis.navigator, 'geolocation', {
      configurable: true,
      writable: true,
      value: {
        getCurrentPosition: jest.fn(),
      },
    })

    Object.defineProperty(globalThis.navigator, 'vibrate', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('uses shared location resolver instead of direct navigator geolocation', async () => {
    const user = userEvent.setup()

    render(<PanicButton userId="guard-1" userDisplayName="Guard One" />)

    await user.click(screen.getByRole('button', { name: /emergency sos/i }))

    await waitFor(() => {
      expect(mockedResolveLocationWithFallback).toHaveBeenCalledWith('capacitor')
    })

    expect((navigator.geolocation as Geolocation).getCurrentPosition).not.toHaveBeenCalled()

    const fetchMock = globalThis.fetch as jest.Mock
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit
    const body = JSON.parse(String(requestInit.body)) as { location: string }
    expect(body.location).toContain('7.123456, 125.654321')
  })

  it('queues SOS payload offline when incident post fails', async () => {
    const user = userEvent.setup()
    ;(globalThis.fetch as jest.Mock).mockRejectedValueOnce(new Error('offline'))

    render(<PanicButton userId="guard-1" userDisplayName="Guard One" />)

    await user.click(screen.getByRole('button', { name: /emergency sos/i }))

    await waitFor(() => {
      expect(mockedEnqueueOfflineAction).toHaveBeenCalledTimes(1)
    })

    const queuedPayload = mockedEnqueueOfflineAction.mock.calls[0][0]
    const queuedBody = queuedPayload.body as { location?: unknown }
    expect(queuedBody.location).toEqual(expect.any(String))
    expect(String(queuedBody.location)).toContain('7.123456, 125.654321')
  })
})
