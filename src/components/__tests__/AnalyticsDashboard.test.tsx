import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AnalyticsDashboard from '../AnalyticsDashboard'

jest.mock('../../config', () => ({
  API_BASE_URL: 'http://localhost:5000',
}))

jest.mock('../layout/OperationalShell', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

jest.mock('../../config/navigation', () => ({
  getSidebarNav: jest.fn(() => []),
}))

jest.mock('../../utils/api', () => ({
  fetchJsonOrThrow: jest.fn(async () => ({
    overview: {
      total_guards: 2,
      active_guards: 1,
      total_missions: 2,
      completed_missions: 1,
      active_missions: 1,
      total_firearms: 2,
      allocated_firearms: 1,
      total_vehicles: 2,
      deployed_vehicles: 1,
    },
    performance_metrics: {
      mission_completion_rate: 50,
      average_mission_duration: 2,
      guard_attendance_rate: 50,
      firearm_availability_rate: 50,
      vehicle_utilization_rate: 50,
    },
    resource_utilization: {
      firearms_in_use: 1,
      firearms_available: 1,
      firearms_unavailable: 1,
      vehicles_deployed: 1,
      vehicles_available: 1,
      vehicles_unavailable: 1,
      guards_on_duty: 1,
      guards_available: 1,
      guards_unavailable: 0,
    },
    mission_stats: {
      total_missions_this_month: 2,
      completed_missions_this_month: 1,
      pending_missions: 1,
      average_guards_per_mission: 1,
      average_duration_hours: 2,
    },
    attendance_analytics: {
      period_days: 30,
      total_scheduled_shifts: 2,
      attended_shifts: 1,
      on_time_check_ins: 1,
      late_check_ins: 0,
      no_shows: 1,
      attendance_rate: 50,
    },
    attendance_trend: [{
      date: '2026-09-17',
      scheduled_shifts: 2,
      attended_shifts: 1,
      late_check_ins: 0,
      no_shows: 1,
    }],
    evaluation_analytics: {
      period_days: 30,
      total_evaluations: 1,
      guards_evaluated: 1,
      average_rating: 4,
      low_rating_count: 0,
      rating_distribution: [1, 2, 3, 4, 5].map(rating => ({ rating, count: rating === 4 ? 1 : 0 })),
    },
    evaluation_trend: [{ date: '2026-09-17', average_rating: 4, evaluation_count: 1 }],
  })),
  getAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer test-token' })),
}))

describe('AnalyticsDashboard printing', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('prints the rendered analytics report', async () => {
    const user = userEvent.setup()
    const printSpy = jest.spyOn(window, 'print').mockImplementation(() => undefined)

    render(
      <AnalyticsDashboard
        user={{ id: 'admin-1', email: 'admin@example.com', username: 'admin', role: 'admin' }}
        onLogout={jest.fn()}
        onViewChange={jest.fn()}
        activeView="analytics"
      />,
    )

    expect(await screen.findByText('Analytics Report')).toBeInTheDocument()
    expect(document.querySelector('.analytics-print-report')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Print analytics report' }))

    await waitFor(() => expect(printSpy).toHaveBeenCalledTimes(1))
  })
})
