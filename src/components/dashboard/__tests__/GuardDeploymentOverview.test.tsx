import { render, screen, within } from '@testing-library/react'
import GuardDeploymentOverview from '../GuardDeploymentOverview'

it('shows guards as available by default and distinguishes opt-outs from missing data', () => {
  const shifts = [
    { id: 'default', guard_name: 'Default Guard', availability_available: null },
    { id: 'on', guard_name: 'Opted In Guard', availability_available: true },
    { id: 'off', guard_name: 'Opted Out Guard', availability_available: false },
    { id: 'missing', guard_name: 'Missing Data Guard' },
  ].map((shift) => ({ ...shift, status: 'scheduled' }))

  render(<GuardDeploymentOverview shifts={shifts} />)

  expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Guard', 'Site', 'Status', 'Callout'])
  expect(within(screen.getByRole('row', { name: /Default Guard/ })).getByText('Available')).toBeInTheDocument()
  expect(within(screen.getByRole('row', { name: /Opted In Guard/ })).getByText('Available')).toBeInTheDocument()
  expect(within(screen.getByRole('row', { name: /Opted Out Guard/ })).getByText('Unavailable')).toBeInTheDocument()
  expect(within(screen.getByRole('row', { name: /Missing Data Guard/ })).getByText('Not reported')).toBeInTheDocument()
})
