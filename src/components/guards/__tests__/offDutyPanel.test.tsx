import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OffDutyPanel from '../OffDutyPanel'
import { fetchJsonOrThrow } from '../../../utils/api'

jest.mock('../../../config', () => ({
  API_BASE_URL: 'https://example.test',
}))

jest.mock('../../../utils/api', () => ({
  fetchJsonOrThrow: jest.fn(),
  getAuthHeaders: () => ({ Authorization: 'Bearer token' }),
}))

const mockedFetchJsonOrThrow = fetchJsonOrThrow as jest.MockedFunction<typeof fetchJsonOrThrow>

describe('OffDutyPanel', () => {
  beforeEach(() => {
    mockedFetchJsonOrThrow.mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/availability/')) return { available: false }
      if (url.includes('/readiness?')) return { checkedItems: ['uniform'] }
      return {}
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('loads backend availability and readiness for the selected shift', async () => {
    const shift = {
      id: 'shift-1',
      client_site: 'Main Site',
      start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'scheduled',
    }

    render(<OffDutyPanel guardId="guard-1" scheduleItems={[shift]} />)

    expect(await screen.findByText('Not available')).toBeInTheDocument()
    expect(await screen.findByText('1/3 items ready')).toBeInTheDocument()
    expect(mockedFetchJsonOrThrow).toHaveBeenCalledWith(
      expect.stringContaining('/api/guard-replacement/guard/guard-1/readiness?shiftId=shift-1'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
      'Unable to load shift readiness.',
    )
  })

  it('persists a readiness change for the selected shift', async () => {
    const user = userEvent.setup()
    const shift = {
      id: 'shift-1',
      client_site: 'Main Site',
      start_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      status: 'scheduled',
    }

    render(<OffDutyPanel guardId="guard-1" scheduleItems={[shift]} />)
    const firearm = await screen.findByRole('checkbox', { name: 'Firearm' })
    await user.click(firearm)

    await waitFor(() => {
      expect(mockedFetchJsonOrThrow).toHaveBeenCalledWith(
        'https://example.test/api/guard-replacement/readiness',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ guardId: 'guard-1', shiftId: 'shift-1', checkedItems: ['uniform', 'firearm'] }),
        }),
        'Unable to save shift readiness.',
      )
    })
  })
})
