import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResourceManagementPanel from '../ResourceManagementPanel'
import { useOperationalMapData } from '../../../hooks/useOperationalMapData'

jest.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'viewer-1', role: 'superadmin' } }),
}))

jest.mock('../../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
}))

jest.mock('../../../hooks/useOperationalMapData', () => ({
  useOperationalMapData: jest.fn(),
}))

const mockOperationalMapData = useOperationalMapData as jest.MockedFunction<typeof useOperationalMapData>
const fetchMock = jest.fn()
const updateClientSiteMock = jest.fn()

const renderPanel = () => render(
  <ResourceManagementPanel
    users={[]}
    onDeleteUser={jest.fn()}
    canManageGuardAccounts
    canDeleteGuardAccounts
    isSupervisorViewer={false}
  />,
)

describe('ResourceManagementPanel resource editing', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    updateClientSiteMock.mockReset()
    updateClientSiteMock.mockResolvedValue(undefined)
    localStorage.setItem('token', 'test-token')
    Object.defineProperty(global, 'fetch', { configurable: true, value: fetchMock })
    mockOperationalMapData.mockReturnValue({
      clientSites: [{
        id: 'site-1',
        name: 'Tagum Operations Center',
        address: 'Pioneer Avenue',
        latitude: 7.4478,
        longitude: 125.8078,
        isActive: true,
      }],
      createClientSite: jest.fn(),
      updateClientSite: updateClientSiteMock,
      deleteClientSite: jest.fn(),
    } as unknown as ReturnType<typeof useOperationalMapData>)
  })

  it('opens an edit dialog and sends the full firearm update payload', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ firearms: [{ id: 'firearm-1', serialNumber: 'SN-100', model: 'Armscor', caliber: '9mm', status: 'available', licenseExpiryDate: '2028-06-09' }] }),
    })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ firearms: [] }) })
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Firearms' }))
    await screen.findByText('SN-100')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Edit Firearm')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Serial Number'))
    await user.type(screen.getByLabelText('Serial Number'), 'SN-101')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/firearms/firearm-1',
      expect.objectContaining({ method: 'PUT', body: expect.stringContaining('SN-101') }),
    ))
  })

  it('uses the API total and loads the next firearm page', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total: 110,
        page: 1,
        pageSize: 50,
        firearms: [{ id: 'firearm-1', serialNumber: 'SN-001', model: 'Armscor', caliber: '9mm', status: 'available' }],
      }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        total: 110,
        page: 2,
        pageSize: 50,
        firearms: [{ id: 'firearm-51', serialNumber: 'SN-051', model: 'Armscor', caliber: '9mm', status: 'allocated' }],
      }),
    })
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Firearms' }))
    await screen.findByText('SN-001')
    expect(screen.getByText('110 registered')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next firearm page' }))
    await screen.findByText('SN-051')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/firearms?page=2&page_size=50',
      expect.objectContaining({ headers: expect.anything() }),
    )
  })

  it('opens the client-site editor and uses the existing update hook', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Client Sites' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Edit Client Site')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Site Name'))
    await user.type(screen.getByLabelText('Site Name'), 'Tagum Control Center')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(updateClientSiteMock).toHaveBeenCalledWith(
      'site-1',
      expect.objectContaining({ name: 'Tagum Control Center' }),
    ))
  })

  it('opens an edit dialog and sends the vehicle update payload', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify([{ id: 'vehicle-1', license_plate: 'AC-01', plate_number: 'ABC-123', status: 'available' }]),
    })
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Vehicles' }))
    await screen.findByText('AC-01')
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByText('Edit Vehicle')).toBeInTheDocument()

    await user.clear(screen.getByLabelText('Plate Number'))
    await user.type(screen.getByLabelText('Plate Number'), 'XYZ-789')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/api/armored-cars/vehicle-1',
      expect.objectContaining({ method: 'PUT', body: expect.stringContaining('XYZ-789') }),
    ))
  })
})
