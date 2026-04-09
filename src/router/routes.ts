export const ROUTES = {
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  OVERVIEW: '/overview',
  FEEDBACK: '/feedback',
  FEEDBACK_DASHBOARD: '/feedback-dashboard',
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
  MDR_IMPORT: '/mdr-import',
  APPROVALS: '/approvals',
  SCHEDULE: '/schedule',
  MISSIONS: '/missions',
  TRIPS: '/trips',
  INBOX: '/inbox',
  MANAGE: '/manage',
  OPERATIONS_MAP: '/operations-map',
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
  'feedback': ROUTES.FEEDBACK,
  'feedback-dashboard': ROUTES.FEEDBACK_DASHBOARD,
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
  'mdr-import': ROUTES.MDR_IMPORT,
  'approvals': ROUTES.APPROVALS,
  'schedule': ROUTES.SCHEDULE,
  'missions': ROUTES.MISSIONS,
  'trips': ROUTES.TRIPS,
  'inbox': ROUTES.INBOX,
  'manage': ROUTES.MANAGE,
  'operations-map': ROUTES.OPERATIONS_MAP,
}

/**
 * URL-accessible elevated routes that are intentionally excluded from the elevated sidebar.
 * These paths are surfaced through header actions, role-specific deep links, or alias redirects.
 */
export const ELEVATED_URL_ONLY_ROUTES: RoutePath[] = [
  ROUTES.PERMITS,
  ROUTES.INBOX,
  ROUTES.PROFILE,
  ROUTES.SUPPORT,
  ROUTES.SHIFT_SWAPS,
  ROUTES.NOTIFICATIONS,
  ROUTES.TRIPS,
]
