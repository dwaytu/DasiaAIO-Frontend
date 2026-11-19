import { render, screen, within } from '@testing-library/react'
import GuardLicenseComplianceReport from '../GuardLicenseComplianceReport'
import { fetchJsonOrThrow } from '../../utils/api'

jest.mock('../../config', () => ({ API_BASE_URL: 'http://localhost:5000' }))
jest.mock('../../config/navigation', () => ({ getSidebarNav: () => [] }))
jest.mock('../../utils/api', () => ({ fetchJsonOrThrow: jest.fn(), getAuthHeaders: () => ({}) }))
jest.mock('../layout/OperationalShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

afterEach(() => {
  jest.useRealTimers()
  jest.clearAllMocks()
})

it('shows calendar time remaining beside the expiry date and omits the issued column', async () => {
  jest.useFakeTimers({ now: new Date(2026, 0, 31, 12) })
  const longExpiry = new Date(2027, 8, 30, 12)
  const cases = [
    { guardName: 'Long term', expiry: longExpiry, status: 'compliant', expected: '1 year, 8 months' },
    { guardName: 'Month end', expiry: new Date(2026, 1, 28, 12), status: 'expiring_soon', expected: '1 month' },
    { guardName: 'Near expiry', expiry: new Date(2026, 1, 14, 12), status: 'expiring_soon', expected: 'Less than 1 month' },
    { guardName: 'Same day', expiry: new Date(2026, 0, 31, 23), status: 'expiring_soon', expected: 'Expires today' },
    { guardName: 'Earlier today', expiry: new Date(2026, 0, 31, 8), status: 'expired', expected: 'Expired' },
    { guardName: 'Past expiry', expiry: new Date(2026, 0, 30, 12), status: 'expired', expected: 'Expired' },
    { guardName: 'Missing expiry', expiry: null, status: 'no_license', expected: 'Not provided' },
  ]
  jest.mocked(fetchJsonOrThrow).mockResolvedValue({
    total: cases.length,
    page: 1,
    pageSize: 50,
    summary: { totalGuards: cases.length, compliant: 1, expired: 2, expiringSoon: 3, noLicense: 1 },
    items: cases.map(({ guardName, expiry, status }) => ({
      guardId: guardName,
      guardName,
      licenseNumber: 'LICENSE-FIXTURE',
      licenseIssuedDate: '2025-01-01T12:00:00Z',
      licenseExpiryDate: expiry?.toISOString(),
      licenseDaysRemaining: guardName === 'Long term' ? 607 : undefined,
      complianceStatus: status,
    })),
  })

  render(<GuardLicenseComplianceReport user={{ role: 'admin' }} onLogout={jest.fn()} />)

  const table = within(await screen.findByRole('table'))
  expect(table.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
    'Guard', 'License number', 'Expiry', 'Compliance',
  ])
  for (const { guardName, expected } of cases) {
    const cells = within(table.getByRole('row', { name: new RegExp(guardName) })).getAllByRole('cell')
    expect(cells).toHaveLength(4)
    expect(cells[2]).toHaveTextContent(expected)
  }
  expect(table.getByRole('cell', { name: `${longExpiry.toLocaleDateString()} (1 year, 8 months)` })).toBeInTheDocument()
  expect(table.queryByText(/607d/)).not.toBeInTheDocument()
})
