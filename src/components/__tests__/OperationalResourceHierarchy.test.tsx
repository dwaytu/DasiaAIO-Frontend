import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import FirearmAllocation from '../FirearmAllocation'
import FirearmInventory from '../FirearmInventory'
import FirearmMaintenance from '../FirearmMaintenance'
import { fetchJsonOrThrow } from '../../utils/api'
import { isAllocationPresentationEnabled } from '../../config'

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
  isAllocationPresentationEnabled: jest.fn(() => false),
}))

jest.mock('../layout/OperationalShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../config/navigation', () => ({
  getSidebarNav: jest.fn(() => []),
}))

jest.mock('../../utils/api', () => ({
  fetchJsonOrThrow: jest.fn(),
  getAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer test-token' })),
}))

const fetchJsonOrThrowMock = fetchJsonOrThrow as jest.MockedFunction<typeof fetchJsonOrThrow>
const user = { id: 'admin-1', username: 'admin', email: 'admin@example.test', role: 'admin' as const }

describe('operational resource hierarchy', () => {
  afterEach(() => {
    jest.mocked(isAllocationPresentationEnabled).mockReturnValue(false)
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  it('issues a saved allocation through the API even when the presentation flag is enabled', async () => {
    jest.mocked(isAllocationPresentationEnabled).mockReturnValue(true)
    let issued = false
    const existingAllocation = { id: 'prior-allocation', guardName: 'Previous Guard', status: 'returned', recordOrigin: 'application' }
    const newAllocation = { id: 'saved-allocation', guardName: 'Fixture Guard', status: 'active', recordOrigin: 'application' }
    fetchJsonOrThrowMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/api/firearm-allocation/issue')) {
        issued = true
        return {} as never
      }
      if (url.endsWith('/api/firearm-allocations/summary')) {
        return { eligibleGuards: 1, availableFirearms: issued ? 0 : 1 } as never
      }
      if (url.includes('/api/firearm-allocations/eligible-guards?')) {
        return { guards: [{ id: 'guard-1', fullName: 'Fixture Guard', guardCode: 'G-0142' }] } as never
      }
      if (url.includes('/api/firearms?')) return {
        firearms: [{ id: 'fixture-asset', serialNumber: 'TRAINING-ONLY', model: 'Inert fixture', status: issued ? 'allocated' : 'available' }],
      } as never
      if (url.includes('/api/firearm-allocations?')) return {
        allocations: issued ? [newAllocation, existingAllocation] : [existingAllocation],
        total: issued ? 2 : 1,
      } as never
      throw new Error(`Unexpected request: ${url}`)
    })
    const operator = userEvent.setup()
    render(<FirearmAllocation user={user} onLogout={jest.fn()} />)
    expect((await screen.findByText('Eligible for new issuance')).parentElement).toHaveTextContent('1')
    expect(await screen.findByRole('row', { name: /Previous Guard.*Returned/ })).toBeInTheDocument()
    expect(screen.queryByText('Application-recorded')).not.toBeInTheDocument()
    await operator.click(screen.getByRole('button', { name: 'Allocate firearm' }))
    const form = within(screen.getByRole('dialog', { name: 'Allocate firearm' }))
    const picker = form.getByRole('combobox', { name: 'Eligible guard' })
    await operator.type(picker, 'xture gua')
    await operator.keyboard('{ArrowDown}{Enter}')
    expect(picker).toHaveValue('G-0142 - Fixture Guard')
    await operator.selectOptions(form.getByLabelText('Available firearm'), 'fixture-asset')
    await operator.click(form.getByRole('button', { name: 'Allocate firearm' }))

    expect(fetchJsonOrThrowMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/firearm-allocation/issue',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ guardId: 'guard-1', firearmId: 'fixture-asset' }) }),
      'Unable to allocate firearm',
    )
    expect(await screen.findByText('Firearm allocated successfully.')).toBeInTheDocument()
    expect(await screen.findByRole('row', { name: /Fixture Guard.*Active/ })).toBeInTheDocument()
    expect(screen.queryByText('Application-recorded')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Allocate firearm' })).toBeDisabled()
    expect(screen.queryByRole('group', { name: 'Allocation register views' })).not.toBeInTheDocument()
  })

  it('returns active saved records through the API even when the presentation flag is enabled', async () => {
    jest.mocked(isAllocationPresentationEnabled).mockReturnValue(true)
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {})
    const allocation = {
      id: 'saved-allocation',
      guardId: 'fixture-guard',
      firearmId: 'fixture-asset',
      guardName: 'Fixture Guard',
      firearmSerialNumber: 'TRAINING-ONLY',
      allocationDate: '2026-11-18T08:00:00Z',
      status: 'active',
      recordOrigin: 'unknown',
    }
    fetchJsonOrThrowMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/api/firearm-allocation/return')) {
        allocation.status = 'returned'
        return {} as never
      }
      if (url.includes('/api/firearm-allocations?')) return { allocations: [{ ...allocation }], total: 1 } as never
      if (url.endsWith('/api/firearm-allocations/summary')) {
        if (allocation.status === 'returned') throw new Error('Summary refresh failed')
        return { eligibleGuards: null, availableFirearms: 0 } as never
      }
      return { users: [], firearms: [], total: 0 } as never
    })

    const operator = userEvent.setup()
    render(<FirearmAllocation user={user} onLogout={jest.fn()} />)
    const row = await screen.findByRole('row', { name: /Fixture Guard/ })
    expect(within(row).getByText('Active', { exact: true })).toBeInTheDocument()
    expect(within(row).queryByText(/unknown origin|documentation unverified/i)).not.toBeInTheDocument()
    await operator.click(within(row).getByRole('button', { name: 'Return' }))
    const dialog = within(screen.getByRole('dialog', { name: 'Return firearm' }))
    expect(dialog.getByText(/Confirm you received the firearm back/)).toBeInTheDocument()
    await operator.click(dialog.getByRole('button', { name: 'Return firearm' }))

    expect(fetchJsonOrThrowMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/firearm-allocation/return',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ allocationId: allocation.id }) }),
      'Unable to return firearm',
    )
    const returnedRow = within(await screen.findByRole('row', { name: /Fixture Guard.*Returned/ }))
    expect(returnedRow.queryByRole('button', { name: 'Return' })).not.toBeInTheDocument()
    expect(screen.getByText('Firearm returned successfully and is now available.')).toBeInTheDocument()
    expect(screen.queryByText('Summary refresh failed')).not.toBeInTheDocument()
    expect(errorLog).toHaveBeenCalledWith('Error refreshing firearm counts after return:', expect.any(Error))
  })

  it('shows saved allocation and inventory counts when eligibility is unavailable', async () => {
    fetchJsonOrThrowMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith('/api/firearm-allocations/summary')) {
        return { eligibleGuards: null, availableFirearms: 3, totalAllocationRecords: 42 } as never
      }
      if (url.includes('/api/firearm-allocations?')) return { allocations: [], total: 0 } as never
      if (url.includes('/api/firearms?')) return { firearms: [] } as never
      throw new Error(`Unexpected request: ${url}`)
    })

    render(<FirearmAllocation user={user} onLogout={jest.fn()} />)

    expect(await screen.findByText('Issuance eligibility is unavailable.')).toBeInTheDocument()
    expect(screen.getByText('Eligible for new issuance').parentElement).toHaveTextContent('Unavailable')
    expect(screen.getByText('Available firearms').parentElement).toHaveTextContent('3')
    expect(screen.getByText('Allocation records').parentElement).toHaveTextContent('42')
    expect(screen.getByRole('heading', { name: 'Allocation register' })).toBeInTheDocument()
    expect(fetchJsonOrThrowMock.mock.calls.some(([input]) => String(input).includes('/eligible-guards'))).toBe(false)
  })

  it('summarizes firearm maintenance workload before the records table', async () => {
    fetchJsonOrThrowMock.mockImplementation(async (url) => {
      if (String(url).endsWith('/api/firearm-maintenance')) {
        return {
          total: 3,
          maintenances: [
            { id: 'm-1', firearmId: 'f-1', maintenanceType: 'Inspection', description: 'Inspect', scheduledDate: '2026-09-20T08:00:00.000Z', status: 'pending' },
            { id: 'm-2', firearmId: 'f-2', maintenanceType: 'Repair', description: 'Repair', scheduledDate: '2026-09-21T08:00:00.000Z', status: 'in_progress' },
            { id: 'm-3', firearmId: 'f-3', maintenanceType: 'Cleaning', description: 'Clean', scheduledDate: '2026-09-18T08:00:00.000Z', status: 'completed' },
          ],
        } as never
      }

      return [
        { id: 'f-1', serialNumber: 'SN-001', model: 'Model A', status: 'maintenance' },
        { id: 'f-2', serialNumber: 'SN-002', model: 'Model B', status: 'maintenance' },
        { id: 'f-3', serialNumber: 'SN-003', model: 'Model C', status: 'available' },
      ] as never
    })

    render(<MemoryRouter><FirearmMaintenance user={user} onLogout={jest.fn()} /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'Maintenance controls' })).toBeInTheDocument()
    expect(screen.getByText('Pending').parentElement).toHaveTextContent('1')
    expect(screen.getByText('In progress').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Available firearms').parentElement).toHaveTextContent('1')
    expect(screen.queryByText(/marked Maintenance in Inventory/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Schedule maintenance' }))
    expect(screen.getByRole('heading', { name: 'Schedule firearm maintenance' })).toBeInTheDocument()
  })

  it('counts inventory beyond the first page and identifies headquarters returns and unexplained holds', async () => {
    const statuses = [
      ...Array(17).fill('available'), ...Array(33).fill('allocated'),
      ...Array(41).fill('Available '), ...Array(8).fill('maintenance'), ...Array(11).fill('allocated'),
    ]
    const inventory = statuses.map((status, index) => ({ id: `fixture-${index}`, serialNumber: `SN-${index}`, model: 'Fixture record', status }))
    fetchJsonOrThrowMock.mockImplementation(async (input) => {
      const url = new URL(String(input))
      if (url.pathname === '/api/firearm-maintenance') {
        return { total: 0, maintenances: [], returnedToHeadquartersIds: inventory.slice(91, 98).map(({ id }) => id) } as never
      }
      if (url.pathname === '/api/firearms') {
        const offset = (Number(url.searchParams.get('page')) - 1) * 50
        return { total: inventory.length, firearms: inventory.slice(offset, offset + 50) } as never
      }
      throw new Error(`Unexpected request: ${url}`)
    })

    render(<MemoryRouter><FirearmMaintenance user={user} onLogout={jest.fn()} /></MemoryRouter>)

    const available = await screen.findByText('Available firearms')
    expect(available.nextElementSibling).toHaveTextContent(/^58$/)
    expect(screen.getByText('No open maintenance records')).toBeInTheDocument()
    expect(screen.getByText('1 firearm is marked Maintenance in Inventory without an open maintenance record.')).toBeInTheDocument()
    expect(screen.getByText('7 firearms returned to headquarters')).toBeInTheDocument()
  })

  it('separates firearm allocation status from the allocation work area', async () => {
    const operator = userEvent.setup()
    fetchJsonOrThrowMock.mockImplementation(async (input) => {
      const url = String(input)
      const body = url.includes('/api/firearm-allocations/summary')
        ? {
          totalFirearms: 110,
          availableFirearms: 3,
          activeCustody: 1,
          verifiedActiveCustody: null,
          returnedAllocations: 1,
          importedOrUnverifiedAllocations: 1,
          registerBreakdown: [
            { origin: 'imported', active: 1, returned: 0, unverified: 0 },
            { origin: 'presentation', active: 0, returned: 1, unverified: 0 },
          ],
          totalAllocationRecords: 2,
          eligibleGuards: 1,
          custodyReviewFirearms: 47,
          maintenanceFirearms: 8,
        }
        : url.includes('/api/firearm-allocations/eligible-guards')
          ? { total: 1, guards: [{ id: 'g-1', fullName: 'Guard One', guardCode: 'G-001' }] }
          : url.includes('/api/firearm-allocations?')
            ? { total: 16, page: 1, pageSize: 15, allocations: [
              { id: 'a-1', guardId: 'g-1', firearmId: 'f-1', guardName: 'Guard One', firearmSerialNumber: 'SN-001', firearmModel: 'Model A', allocationDate: '2026-09-19T08:00:00.000Z', issueDateSource: 'mdr_import_recorded', recordOrigin: 'imported', status: 'active' },
              { id: 'a-2', guardId: 'g-1', firearmId: 'f-2', guardName: 'Guard One', firearmSerialNumber: 'SN-002', firearmModel: 'Model B', allocationDate: '2026-09-18T08:00:00.000Z', issueDateSource: 'presentation_recorded', recordOrigin: 'presentation', status: 'returned' },
            ] }
            : { total: 110, firearms: [
              { id: 'f-1', serialNumber: 'SN-001', model: 'Model A', status: 'allocated' },
              { id: 'f-2', serialNumber: 'SN-002', model: 'Model B', status: 'available' },
            ] }

      return body as never
    })

    render(<FirearmAllocation user={user} onLogout={jest.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Firearm allocations' })).toBeInTheDocument()
    expect(screen.queryByText('Verified active custody')).not.toBeInTheDocument()
    expect(screen.getByText('Eligible for new issuance').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Available firearms').parentElement?.parentElement).toHaveTextContent('3')
    expect(screen.getByText('Allocation records').parentElement?.parentElement).toHaveTextContent('2')
    expect(screen.getByText('Custody review').parentElement?.parentElement).toHaveTextContent('47')
    expect(screen.getByText('Maintenance').parentElement?.parentElement).toHaveTextContent('8')
    expect(screen.getByRole('heading', { name: 'Allocation register' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /^Issued$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /^Returned$/ })).toBeInTheDocument()
    expect(screen.getByText('Imported', { exact: true })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Register by origin and status' })).not.toBeInTheDocument()
    expect(screen.queryByText('Presentation / test')).not.toBeInTheDocument()
    expect(screen.getAllByText('Returned').length).toBeGreaterThan(0)

    await operator.click(screen.getByRole('button', { name: 'Next allocation page' }))
    await waitFor(() => expect(fetchJsonOrThrowMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/firearm-allocations?page=2&page_size=15',
      expect.objectContaining({ headers: expect.anything() }),
      'Failed to load firearm allocations',
    ))

    await operator.click(screen.getByRole('button', { name: 'Allocate firearm' }))
    expect(screen.getByRole('heading', { name: 'Allocate firearm' })).toBeInTheDocument()

    await operator.click(screen.getByRole('button', { name: 'Return' }))
    expect(screen.getByRole('dialog', { name: 'Return firearm' })).toBeInTheDocument()
    expect(screen.getByText(/closes the active custody record/i)).toBeInTheDocument()

    await operator.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Return firearm' })).not.toBeInTheDocument()
  })

  it('keeps imported custody-review records distinct from verified active custody', async () => {
    const operator = userEvent.setup()
    fetchJsonOrThrowMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('/api/firearm-allocations/summary')) {
        return {
          totalFirearms: 110,
          availableFirearms: 3,
          allocatedFirearms: 99,
          maintenanceFirearms: 8,
          activeCustody: 64,
          custodyReviewFirearms: 35,
          pendingCustodyReviewFirearms: 33,
          eligibleGuards: null,
        } as never
      }

      return {
        total: 35,
        page: 1,
        pageSize: 25,
        firearms: [{
          id: 'f-review-1',
          serialNumber: 'MDR-001',
          model: 'Service Pistol',
          caliber: '9mm',
          status: 'allocated',
          custodyReview: true,
          activeCustody: false,
          mdrRowRef: 'MDR row 14',
          sourceGuardText: 'Guard One',
          directGuardMatch: false,
        }],
      } as never
    })

    render(<FirearmInventory user={user} onLogout={jest.fn()} />)

    expect((await screen.findAllByText('Custody review')).length).toBeGreaterThan(1)
    expect(screen.getByText('Pending custody reviews').parentElement).toHaveTextContent('33')
    expect(screen.getByText(/35 imported firearm records/)).toBeInTheDocument()
    expect(screen.getAllByText(/No verified active custody record/i)).not.toHaveLength(0)
    expect(screen.getByText(/MDR source: MDR row 14; source guard: Guard One/i)).toBeInTheDocument()
    expect(screen.queryByText('Verified active custody')).not.toBeInTheDocument()

    await operator.selectOptions(screen.getByRole('combobox', { name: 'Filter firearm inventory state' }), 'custody_review')
    await waitFor(() => expect(fetchJsonOrThrowMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/firearms?page=1&page_size=25&state=custody_review',
      expect.objectContaining({ headers: expect.anything(), signal: expect.anything() }),
      'Unable to load firearm inventory',
    ))
  })

  it('shows the pending review count as unavailable when the server provides only the unverified total', async () => {
    fetchJsonOrThrowMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/api/firearm-allocations/summary')) {
        return { totalFirearms: 1, activeCustody: 0, custodyReviewFirearms: 1 } as never
      }
      return { firearms: [], total: 0 } as never
    })

    render(<FirearmInventory user={user} onLogout={jest.fn()} />)

    expect((await screen.findByText('Pending custody reviews')).parentElement).toHaveTextContent('Unavailable')
    expect(screen.getByText(/1 imported firearm record/)).toBeInTheDocument()
  })
})
