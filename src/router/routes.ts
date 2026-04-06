export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  OVERVIEW: '/overview',
  CALENDAR: '/calendar',
  PERFORMANCE: '/performance',
  MERIT: '/merit',
  FIREARMS: '/firearms',
  ALLOCATION: '/allocation',
  PERMITS: '/permits',
  MAINTENANCE: '/maintenance',
  ARMORED_CARS: '/armored-cars',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  ANALYTICS: '/analytics',
  AUDIT: '/audit',
  SHIFT_SWAPS: '/shift-swaps',
  NOTIFICATIONS: '/notifications',
  SUPPORT: '/support',
  APPROVALS: '/approvals',
  SCHEDULE: '/schedule',
  MISSIONS: '/missions',
  TRIPS: '/trips',
  INBOX: '/inbox',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/**
 * Maps legacy activeView string keys (used in App.tsx's setActiveView/viewRegistry)
 * to the new URL-based route paths.
 *
 * Keys here match the string literals passed to setActiveView() throughout
 * App.tsx and SuperadminDashboard.tsx. Legacy notifications intent now resolves
 * to inbox to avoid dead-end routing.
 */
export const VIEW_TO_ROUTE: Record<string, RoutePath> = {
  'dashboard': ROUTES.DASHBOARD,
  'overview': ROUTES.OVERVIEW,
  'calendar': ROUTES.CALENDAR,
  'performance': ROUTES.PERFORMANCE,
  'merit': ROUTES.MERIT,
  'firearms': ROUTES.FIREARMS,
  'allocation': ROUTES.ALLOCATION,
  'permits': ROUTES.PERMITS,
  'maintenance': ROUTES.MAINTENANCE,
  'armored-cars': ROUTES.ARMORED_CARS,
  'profile': ROUTES.PROFILE,
  'settings': ROUTES.SETTINGS,
  'analytics': ROUTES.ANALYTICS,
  'audit-log': ROUTES.AUDIT,
  'shift-swaps': ROUTES.SHIFT_SWAPS,
  'notifications': ROUTES.INBOX,
  'support': ROUTES.SUPPORT,
  'approvals': ROUTES.APPROVALS,
  'schedule': ROUTES.SCHEDULE,
  'missions': ROUTES.MISSIONS,
  'trips': ROUTES.TRIPS,
  'inbox': ROUTES.INBOX,
}
