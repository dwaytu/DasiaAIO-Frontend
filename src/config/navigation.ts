import { can, Permission } from '../utils/permissions'
import { isElevatedRole, normalizeRole } from '../types/auth'

export interface NavItem {
  view: string
  label: string
  group: 'Core' | 'Intelligence' | 'Operations' | 'Resources' | 'Field' | 'System'
  permission?: Permission
}

export const MOBILE_BOTTOM_NAV_VIEWS = ['dashboard', 'approvals', 'schedule', 'inbox'] as const

export function getMobileBottomNavViews(items: Array<Pick<NavItem, 'view'>>): string[] {
  const hasApprovalAccess = items.some((item) => item.view === 'approvals')

  return MOBILE_BOTTOM_NAV_VIEWS.filter((view) => view !== 'approvals' || hasApprovalAccess)
}

const SUPERADMIN_NAV: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', group: 'Core' },
  { view: 'approvals', label: 'Approvals', group: 'Core', permission: 'approve_guards' },
  { view: 'requests', label: 'Requests', group: 'Core', permission: 'manage_requests' },
  { view: 'schedule', label: 'Schedule', group: 'Core' },
  { view: 'calendar', label: 'Calendar', group: 'Core' },
  { view: 'allocation', label: 'Allocation', group: 'Operations', permission: 'manage_allocations' },
  { view: 'feedback-dashboard', label: 'Feedback', group: 'Intelligence' },
  { view: 'analytics', label: 'Analytics', group: 'Intelligence', permission: 'view_analytics' },
  { view: 'dtr', label: 'DTR Report', group: 'Intelligence', permission: 'view_analytics' },
  { view: 'merit', label: 'Merit', group: 'Intelligence', permission: 'manage_evaluations' },
  { view: 'audit', label: 'Audit', group: 'Intelligence', permission: 'view_audit_logs' },
  { view: 'manage', label: 'Management', group: 'Operations' },
  { view: 'mdr-import', label: 'MDR Import', group: 'Operations' },
  { view: 'operations-map', label: 'Operations Map', group: 'Operations' },
  { view: 'firearms', label: 'Firearms', group: 'Resources', permission: 'manage_firearms' },
  { view: 'firearm-compliance', label: 'Firearm Compliance', group: 'Resources', permission: 'manage_firearms' },
  { view: 'guard-compliance', label: 'Guard License Compliance', group: 'Resources' },
  { view: 'maintenance', label: 'Maintenance', group: 'Resources', permission: 'manage_maintenance' },
  { view: 'armored-cars', label: 'Armored Cars', group: 'Resources', permission: 'manage_armored_cars' },
  { view: 'settings', label: 'Settings', group: 'System' },
]

const ADMIN_NAV: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', group: 'Core' },
  { view: 'approvals', label: 'Approvals', group: 'Core', permission: 'approve_guards' },
  { view: 'requests', label: 'Requests', group: 'Core', permission: 'manage_requests' },
  { view: 'schedule', label: 'Schedule', group: 'Core' },
  { view: 'calendar', label: 'Calendar', group: 'Core' },
  { view: 'allocation', label: 'Allocation', group: 'Operations', permission: 'manage_allocations' },
  { view: 'dtr', label: 'DTR Report', group: 'Operations', permission: 'view_analytics' },
  { view: 'merit', label: 'Merit', group: 'Operations', permission: 'manage_evaluations' },
  { view: 'manage', label: 'Management', group: 'Operations' },
  { view: 'mdr-import', label: 'MDR Import', group: 'Operations' },
  { view: 'operations-map', label: 'Operations Map', group: 'Operations' },
  { view: 'firearms', label: 'Firearms', group: 'Resources', permission: 'manage_firearms' },
  { view: 'firearm-compliance', label: 'Firearm Compliance', group: 'Resources', permission: 'manage_firearms' },
  { view: 'guard-compliance', label: 'Guard License Compliance', group: 'Resources' },
  { view: 'armored-cars', label: 'Armored Cars', group: 'Resources', permission: 'manage_armored_cars' },
  { view: 'maintenance', label: 'Maintenance', group: 'Resources', permission: 'manage_maintenance' },
  { view: 'settings', label: 'Settings', group: 'System' },
]

const SUPERVISOR_NAV: NavItem[] = [
  { view: 'dashboard', label: 'Dashboard', group: 'Core' },
  { view: 'schedule', label: 'Schedule', group: 'Core' },
  { view: 'calendar', label: 'Calendar', group: 'Core' },
  { view: 'missions', label: 'Missions', group: 'Field' },
  { view: 'requests', label: 'Requests', group: 'Operations', permission: 'manage_requests' },
  { view: 'allocation', label: 'Allocation', group: 'Operations', permission: 'manage_allocations' },
  { view: 'dtr', label: 'DTR Report', group: 'Operations', permission: 'view_analytics' },
  { view: 'merit', label: 'Merit', group: 'Operations', permission: 'manage_evaluations' },
  { view: 'maintenance', label: 'Maintenance', group: 'Resources', permission: 'manage_maintenance' },
  { view: 'firearm-compliance', label: 'Firearm Compliance', group: 'Resources', permission: 'manage_firearms' },
  { view: 'guard-compliance', label: 'Guard License Compliance', group: 'Resources' },
  { view: 'operations-map', label: 'Operations Map', group: 'Operations' },
  { view: 'settings', label: 'Settings', group: 'System' },
]

interface NavOptions {
  homeView?: 'dashboard' | 'users' | 'overview'
}

export function getSidebarNav(roleInput: unknown, options: NavOptions = {}): NavItem[] {
  const role = normalizeRole(roleInput)
  const homeView = options.homeView ?? 'dashboard'

  if (role == null) return []

  if (!isElevatedRole(role)) return []

  // Sidebar nav is limited to high-frequency destinations. URL-only flows are documented in ELEVATED_URL_ONLY_ROUTES.

  const roleNav =
    role === 'superadmin' ? SUPERADMIN_NAV : role === 'admin' ? ADMIN_NAV : SUPERVISOR_NAV

  const filtered = roleNav.filter((item) => !item.permission || can(role, item.permission))

  if (homeView === 'dashboard') return filtered

  return filtered.map((item) => (item.view === 'dashboard' ? { ...item, view: homeView } : item))
}
