import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FirearmAllocation from '../FirearmAllocation'
import FirearmInventory from '../FirearmInventory'
import FirearmMaintenance from '../FirearmMaintenance'
import { fetchJsonOrThrow } from '../../utils/api'

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
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
const user = { id: 'admin-1', username: 'admin', role: 'admin' }

describe('operational resource hierarchy', () => {
  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
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

    render(<FirearmMaintenance user={user} onLogout={jest.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Maintenance controls' })).toBeInTheDocument()
    expect(screen.getByText('Pending').parentElement).toHaveTextContent('1')
    expect(screen.getByText('In progress').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Available firearms').parentElement).toHaveTextContent('1')

    await userEvent.click(screen.getByRole('button', { name: 'Schedule maintenance' }))
    expect(screen.getByRole('heading', { name: 'Schedule firearm maintenance' })).toBeInTheDocument()
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
          returnedAllocations: 1,
          totalAllocationRecords: 2,
          eligibleGuards: 1,
          custodyReviewFirearms: 47,
          maintenanceFirearms: 8,
        }
        : url.includes('/api/firearm-allocations/eligible-guards')
          ? { total: 1, guards: [{ id: 'g-1', fullName: 'Guard One', guardCode: 'G-001' }] }
          : url.includes('/api/firearm-allocations?')
            ? { total: 16, page: 1, pageSize: 15, allocations: [
              { id: 'a-1', guardId: 'g-1', firearmId: 'f-1', guardName: 'Guard One', firearmSerialNumber: 'SN-001', firearmModel: 'Model A', allocationDate: '2026-09-19T08:00:00.000Z', issueDateSource: 'mdr_import_recorded', status: 'active' },
              { id: 'a-2', guardId: 'g-1', firearmId: 'f-2', guardName: 'Guard One', firearmSerialNumber: 'SN-002', firearmModel: 'Model B', allocationDate: '2026-09-18T08:00:00.000Z', status: 'returned' },
            ] }
            : { total: 110, firearms: [
              { id: 'f-1', serialNumber: 'SN-001', model: 'Model A', status: 'allocated' },
              { id: 'f-2', serialNumber: 'SN-002', model: 'Model B', status: 'available' },
            ] }

      return body as never
    })

    render(<FirearmAllocation user={user} onLogout={jest.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Firearm allocations' })).toBeInTheDocument()
    expect(screen.getAllByText('Active custody')[0].parentElement?.parentElement).toHaveTextContent('1')
    expect(screen.getByText('Eligible guards').parentElement?.parentElement).toHaveTextContent('1')
    expect(screen.getByText('Available firearms').parentElement?.parentElement).toHaveTextContent('3')
    expect(screen.getByText('Allocation records').parentElement?.parentElement).toHaveTextContent('2')
    expect(screen.getByText('Custody review').parentElement?.parentElement).toHaveTextContent('47')
    expect(screen.getByText('Maintenance').parentElement?.parentElement).toHaveTextContent('8')
    expect(screen.getByRole('heading', { name: 'Allocation register' })).toBeInTheDocument()
    expect(screen.getByText('Issue date not verified')).toBeInTheDocument()
    expect(screen.getByText(/MDR record imported/i)).toBeInTheDocument()
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
    expect(screen.getByText('35')).toBeInTheDocument()
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
})
