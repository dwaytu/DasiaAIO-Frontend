import { getSidebarNav } from '../config/navigation'

describe('shell navigation chrome', () => {
  it('returns role-specific sidebar items for admin', () => {
    const labels = getSidebarNav('admin').map((item) => item.label)

    expect(labels).toContain('Dashboard')
    expect(labels).toContain('Approvals')
    expect(labels).toContain('Schedule')
    expect(labels).toContain('Calendar')
    expect(labels).toContain('Settings')
    expect(labels).toContain('Operations Map')
    expect(labels).toContain('MDR Import')
    expect(labels).not.toContain('Inbox')
    expect(labels).not.toContain('Audit')
    expect(labels).toHaveLength(12)
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
    expect(labels).toContain('Feedback')
    expect(labels).toHaveLength(13)
  })

  it('returns supervisor nav with Missions', () => {
    const labels = getSidebarNav('supervisor').map((item) => item.label)

    expect(labels).toContain('Missions')
    expect(labels).toContain('Approvals')
    expect(labels).toContain('Calendar')
    expect(labels).toContain('Operations Map')
    expect(labels).toContain('Settings')
    expect(labels).not.toContain('Firearms')
    expect(labels).toHaveLength(8)
  })

  it('fails closed for malformed roles', () => {
    expect(getSidebarNav('unknown-role')).toEqual([])
    expect(getSidebarNav('')).toEqual([])
    expect(getSidebarNav(null)).toEqual([])
  })

  it('applies homeView override for elevated roles', () => {
    const items = getSidebarNav('admin', { homeView: 'users' })
    const first = items[0]

    expect(first.view).toBe('users')
    expect(first.label).toBe('Dashboard')
  })
})