import { can, Permission } from '../utils/permissions'
import { isElevatedRole, normalizeRole } from '../types/auth'

export interface NavItem {
  view: string
  label: string
  group: 'MAIN MENU' | 'OPERATIONS' | 'RESOURCES'
  permission?: Permission
}

const ELEVATED_NAV: NavItem[] = [
  { view: 'inbox', label: 'Inbox', group: 'MAIN MENU' },
  { view: 'dashboard', label: 'Dashboard', group: 'MAIN MENU' },
  { view: 'settings', label: 'Settings', group: 'MAIN MENU' },
  { view: 'approvals', label: 'Approvals', group: 'MAIN MENU', permission: 'approve_guards' },
  { view: 'calendar', label: 'Calendar', group: 'MAIN MENU' },
  { view: 'analytics', label: 'Analytics', group: 'MAIN MENU', permission: 'view_analytics' },
  { view: 'audit-log', label: 'System Audit Log', group: 'MAIN MENU', permission: 'view_audit_logs' },
  { view: 'trips', label: 'Trip Management', group: 'OPERATIONS' },
  { view: 'schedule', label: 'Schedule', group: 'OPERATIONS' },
  { view: 'missions', label: 'Missions', group: 'OPERATIONS' },
  { view: 'performance', label: 'Performance', group: 'OPERATIONS' },
  { view: 'merit', label: 'Merit Scores', group: 'OPERATIONS' },
  { view: 'firearms', label: 'Firearms', group: 'RESOURCES', permission: 'manage_firearms' },
  { view: 'allocation', label: 'Allocation', group: 'RESOURCES', permission: 'manage_allocations' },
  { view: 'permits', label: 'Permits', group: 'RESOURCES', permission: 'manage_permits' },
  { view: 'maintenance', label: 'Maintenance', group: 'RESOURCES', permission: 'manage_maintenance' },
  { view: 'armored-cars', label: 'Armored Cars', group: 'RESOURCES', permission: 'manage_armored_cars' },
]

const GUARD_NAV: NavItem[] = [
  { view: 'inbox', label: 'Inbox', group: 'MAIN MENU' },
  { view: 'dashboard', label: 'Dashboard', group: 'MAIN MENU' },
  { view: 'settings', label: 'Settings', group: 'MAIN MENU' },
  { view: 'calendar', label: 'Calendar', group: 'MAIN MENU' },
  { view: 'schedule', label: 'Schedule', group: 'MAIN MENU' },
  { view: 'firearms', label: 'Firearms', group: 'RESOURCES' },
  { view: 'permits', label: 'My Permits', group: 'RESOURCES' },
  { view: 'support', label: 'Contacts', group: 'RESOURCES' },
]

interface NavOptions {
  homeView?: 'dashboard' | 'users' | 'overview'
}

export function getSidebarNav(roleInput: unknown, options: NavOptions = {}): NavItem[] {
  const role = normalizeRole(roleInput)
  const homeView = options.homeView ?? 'dashboard'

  if (!isElevatedRole(role)) {
    if (homeView === 'dashboard') {
      return GUARD_NAV
    }

    return GUARD_NAV.map((item) => (item.view === 'dashboard' ? { ...item, view: homeView } : item))
  }

  const roleFiltered = ELEVATED_NAV.filter((item) => !item.permission || can(role, item.permission))
  if (homeView === 'dashboard') {
    return roleFiltered
  }

  return roleFiltered.map((item) => (item.view === 'dashboard' ? { ...item, view: homeView } : item))
}
