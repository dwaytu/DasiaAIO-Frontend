import { fireEvent, render, screen } from '@testing-library/react'
import Sidebar, { SidebarItem } from '../Sidebar'

jest.mock('../../hooks/useServiceHealth', () => ({
  useServiceHealth: () => ({
    services: {
      database: 'online',
      apiGateway: 'online',
      monitoringNodes: 'online',
      vehicleTelemetry: 'online',
      authenticationService: 'online',
      lastChecked: '12:00 PM',
    },
  }),
}))

jest.mock('../SidebarBrand', () => () => <div>SENTINEL</div>)

const items: SidebarItem[] = [
  { view: 'dashboard', label: 'Dashboard', group: 'Core' },
  { view: 'approvals', label: 'Approvals', group: 'Core' },
  { view: 'requests', label: 'Requests', group: 'Operations' },
  { view: 'schedule', label: 'Schedule', group: 'Core' },
  { view: 'calendar', label: 'Calendar', group: 'Core' },
  { view: 'analytics', label: 'Analytics', group: 'Intelligence' },
  { view: 'merit', label: 'Merit', group: 'Intelligence' },
  { view: 'allocation', label: 'Allocation', group: 'Operations' },
  { view: 'firearms', label: 'Firearms', group: 'Resources' },
  { view: 'settings', label: 'Settings', group: 'System' },
]

describe('Sidebar navigation state', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('keeps exactly the route-derived item active and reports navigation immediately', () => {
    const onNavigate = jest.fn()
    const props = {
      items,
      activeView: 'dashboard',
      onNavigate,
      onLogout: jest.fn(),
    }
    const { rerender } = render(<Sidebar {...props} />)

    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Approvals' })).not.toHaveAttribute('aria-current')

    fireEvent.click(screen.getByRole('button', { name: 'Schedule' }))
    expect(onNavigate).toHaveBeenCalledWith('schedule')

    rerender(<Sidebar {...props} activeView="schedule" />)
    expect(screen.getByRole('button', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Dashboard' })).not.toHaveAttribute('aria-current')
    expect(screen.getAllByRole('button', { current: 'page' })).toHaveLength(1)
  })

  it('allows an active group to collapse after automatic expansion', () => {
    const props = {
      items,
      activeView: 'analytics',
      onNavigate: jest.fn(),
      onLogout: jest.fn(),
    }
    const { rerender } = render(<Sidebar {...props} />)

    expect(screen.getByRole('button', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(screen.getByRole('button', { name: 'Intelligence' }))

    expect(document.getElementById('sidebar-group-intelligence')).toHaveClass('hidden')
    expect(screen.getByRole('button', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Intelligence' })).toHaveAttribute('aria-expanded', 'false')

    rerender(<Sidebar {...props} items={[...items]} />)
    expect(screen.getByRole('button', { name: 'Intelligence' })).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('sidebar-group-intelligence')).toHaveClass('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Intelligence' }))
    expect(screen.getByRole('button', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page')
    expect(document.getElementById('sidebar-group-intelligence')).not.toHaveClass('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Core' }))
    expect(document.getElementById('sidebar-group-core')).toHaveClass('hidden')

    rerender(<Sidebar {...props} activeView="dashboard" />)
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Core' })).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('sidebar-group-core')).not.toHaveClass('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Core' }))
    expect(screen.getByRole('button', { name: 'Core' })).toHaveAttribute('aria-expanded', 'false')
    expect(document.getElementById('sidebar-group-core')).toHaveClass('hidden')
  })

  it.each(['Operations', 'Resources', 'System'])('allows %s to expand and collapse independently of the active route', (groupName) => {
    render(
      <Sidebar
        items={items}
        activeView="analytics"
        onNavigate={jest.fn()}
        onLogout={jest.fn()}
      />,
    )

    const heading = screen.getByRole('button', { name: groupName })
    const groupItems = document.getElementById(`sidebar-group-${groupName.toLowerCase()}`)

    if (heading.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(heading)
    }
    expect(heading).toHaveAttribute('aria-expanded', 'true')
    expect(groupItems).not.toHaveClass('hidden')

    fireEvent.click(heading)
    expect(heading).toHaveAttribute('aria-expanded', 'false')
    expect(groupItems).toHaveClass('hidden')
  })
})
