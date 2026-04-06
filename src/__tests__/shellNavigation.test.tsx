import { getSidebarNav } from '../config/navigation'

describe('shell navigation chrome', () => {
  it('returns role-specific sidebar items for admin', () => {
    const labels = getSidebarNav('admin').map((item) => item.label)

    expect(labels).toContain('Dashboard')
    expect(labels).toContain('Approvals')
    expect(labels).toContain('Schedule')
    expect(labels).toContain('Calendar')
    expect(labels).not.toContain('Inbox')
    expect(labels).not.toContain('Settings')
  })

  it('returns empty sidebar for guard (uses bottom nav)', () => {
    const items = getSidebarNav('guard', { homeView: 'overview' })

    expect(items).toEqual([])
  })

  it('returns superadmin nav with Settings and Audit', () => {
    const labels = getSidebarNav('superadmin').map((item) => item.label)

    expect(labels).toContain('Settings')
    expect(labels).toContain('Audit')
    expect(labels).toContain('Analytics')
    expect(labels).toContain('Calendar')
    expect(labels).toHaveLength(9)
  })

  it('returns supervisor nav with Missions', () => {
    const labels = getSidebarNav('supervisor').map((item) => item.label)

    expect(labels).toContain('Missions')
    expect(labels).toContain('Approvals')
    expect(labels).toContain('Calendar')
    expect(labels).not.toContain('Firearms')
    expect(labels).toHaveLength(6)
  })

  it('applies homeView override for elevated roles', () => {
    const items = getSidebarNav('admin', { homeView: 'users' })
    const first = items[0]

    expect(first.view).toBe('users')
    expect(first.label).toBe('Dashboard')
  })
})