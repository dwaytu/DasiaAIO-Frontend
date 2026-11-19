import { getSidebarNav } from '../navigation'
import { can } from '../../utils/permissions'

describe('supervisor management access', () => {
  it('shows Management while limiting account creation to guards', () => {
    const navigation = getSidebarNav('supervisor')

    expect(navigation).toEqual(expect.arrayContaining([
      expect.objectContaining({ view: 'manage', label: 'People & Resources' }),
    ]))
    expect(can('supervisor', 'create_guard_accounts')).toBe(true)
    expect(can('supervisor', 'manage_users')).toBe(false)
  })
})

it.each(['admin', 'supervisor'])('includes every %s sidebar destination for superadmins', (role) => {
  expect(getSidebarNav('superadmin').map(({ view }) => view))
    .toEqual(expect.arrayContaining(getSidebarNav(role).map(({ view }) => view)))
})
