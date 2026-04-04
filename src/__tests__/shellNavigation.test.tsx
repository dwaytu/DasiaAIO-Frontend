import { getSidebarNav } from '../config/navigation'

describe('shell navigation chrome', () => {
  it('removes inbox and settings from elevated sidebar navigation', () => {
    const labels = getSidebarNav('admin').map((item) => item.label)

    expect(labels).not.toContain('Inbox')
    expect(labels).not.toContain('Settings')
    expect(labels).toContain('Dashboard')
  })

  it('removes inbox and settings from guard sidebar navigation variants', () => {
    const labels = getSidebarNav('guard', { homeView: 'overview' }).map((item) => item.label)

    expect(labels).not.toContain('Inbox')
    expect(labels).not.toContain('Settings')
    expect(labels).toContain('Calendar')
  })
})