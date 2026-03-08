import { OpsAlert } from '../components/dashboard/OpsAlertFeed'
import { OpsSummary } from './useOpsSummary'

export function getOpsAlerts(summary: OpsSummary): OpsAlert[] {
  const items: OpsAlert[] = []

  if (summary.guardsAbsentToday > 0) {
    items.push({
      id: 'absent-guards',
      severity: 'critical',
      title: 'Guards absent today',
      detail: `${summary.guardsAbsentToday} guards are marked absent or no-show.`,
    })
  }

  if (summary.overdueFirearmReturns > 0) {
    items.push({
      id: 'overdue-firearms',
      severity: 'warning',
      title: 'Overdue firearm returns',
      detail: `${summary.overdueFirearmReturns} firearm allocations are overdue.`,
    })
  }

  if (summary.pendingGuardApprovals > 0) {
    items.push({
      id: 'pending-approvals',
      severity: 'info',
      title: 'Pending guard approvals',
      detail: `${summary.pendingGuardApprovals} guard registrations are awaiting review.`,
    })
  }

  return items
}
