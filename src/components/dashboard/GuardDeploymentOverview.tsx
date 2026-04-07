import { FC } from 'react'

interface GuardDeploymentOverviewProps {
  shifts: any[]
}

const GuardDeploymentOverview: FC<GuardDeploymentOverviewProps> = ({ shifts }) => {
  const deployed = shifts.filter((shift) => shift.status === 'in_progress')
  const scheduled = shifts.filter((shift) => shift.status === 'scheduled')
  const absent = shifts.filter((shift) => shift.status === 'absent' || shift.status === 'no_show')

  return (
    <section className="command-panel p-4 md:p-5" aria-label="Guard deployment overview">
      <div className="mb-4 border-b border-border-subtle pb-3">
        <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">Guard Deployment Overview</h3>
        <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Current field allocation and readiness snapshot</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded border border-success-border bg-success-bg p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Deployed</p>
          <p className="mt-1 text-2xl font-black text-text-primary">{deployed.length}</p>
        </div>
        <div className="rounded border border-info-border bg-info-bg p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Scheduled</p>
          <p className="mt-1 text-2xl font-black text-text-primary">{scheduled.length}</p>
        </div>
        <div className="rounded border border-danger-border bg-danger-bg p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Absent</p>
          <p className="mt-1 text-2xl font-black text-text-primary">{absent.length}</p>
        </div>
      </div>

      <div className="mt-3 max-h-44 overflow-y-auto rounded border border-border-subtle">
        <table className="w-full min-w-[420px]">
          <thead className="thead-glass">
            <tr>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Guard</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Site</th>
              <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Status</th>
            </tr>
          </thead>
          <tbody>
            {shifts.slice(0, 8).map((shift, index) => (
              <tr key={shift.id || index} className="border-t border-border-subtle hover:bg-surface-hover/60">
                <td className="px-3 py-2 text-sm font-medium text-text-primary">{shift.guard_name || shift.guard_username || 'Unknown guard'}</td>
                <td className="px-3 py-2 text-sm text-text-primary">{shift.client_site || 'Unassigned site'}</td>
                <td className="px-3 py-2 text-sm text-text-primary uppercase">{shift.status || 'scheduled'}</td>
              </tr>
            ))}
            {shifts.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-sm text-text-secondary" colSpan={3}>No deployment records available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default GuardDeploymentOverview
