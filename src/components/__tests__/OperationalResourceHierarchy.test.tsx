import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FirearmAllocation from '../FirearmAllocation'
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
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input)
      const body = url.endsWith('/api/firearm-allocations')
        ? { allocations: [
          { id: 'a-1', guardId: 'g-1', firearmId: 'f-1', allocationDate: '2026-09-19T08:00:00.000Z', status: 'active' },
          { id: 'a-2', guardId: 'g-1', firearmId: 'f-2', allocationDate: '2026-09-18T08:00:00.000Z', status: 'returned' },
        ] }
        : url.endsWith('/api/users')
          ? { users: [{ id: 'g-1', full_name: 'Guard One', role: 'guard' }] }
          : { firearms: [
            { id: 'f-1', serialNumber: 'SN-001', model: 'Model A', status: 'allocated' },
            { id: 'f-2', serialNumber: 'SN-002', model: 'Model B', status: 'available' },
          ] }

      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })

    render(<FirearmAllocation user={user} onLogout={jest.fn()} />)

    expect(await screen.findByRole('heading', { name: 'Firearm allocations' })).toBeInTheDocument()
    expect(screen.getByText('Active custody').parentElement).toHaveTextContent('1')
    expect(screen.getByText('Eligible guards').parentElement).toHaveTextContent('1 firearms available')
    expect(screen.getByRole('heading', { name: 'Allocation register' })).toBeInTheDocument()

    await operator.click(screen.getByRole('button', { name: 'Allocate firearm' }))
    expect(screen.getByRole('heading', { name: 'Create allocation' })).toBeInTheDocument()

    await operator.click(screen.getByRole('button', { name: 'Return' }))
    expect(screen.getByRole('dialog', { name: 'Return firearm?' })).toBeInTheDocument()
    expect(screen.getByText(/Historical issuance records will remain available/i)).toBeInTheDocument()

    await operator.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog', { name: 'Return firearm?' })).not.toBeInTheDocument()
  })
})
