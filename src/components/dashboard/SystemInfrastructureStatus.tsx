import { FC } from 'react'

export type ServiceStatus = 'online' | 'offline'

export interface ServiceHealthItem {
  name: string
  status: ServiceStatus
  detail: string
}

interface SystemInfrastructureStatusProps {
  services: ServiceHealthItem[]
}

const statusClass: Record<ServiceStatus, string> = {
  online: 'text-success-text',
  offline: 'text-danger-text',
}

const dotClass: Record<ServiceStatus, string> = {
  online: 'status-light status-light-success status-light-pulse',
  offline: 'status-light status-light-danger',
}

const SystemInfrastructureStatus: FC<SystemInfrastructureStatusProps> = ({ services }) => {
  return (
    <section className="command-panel p-4 md:p-5" aria-label="System infrastructure status">
      <div className="mb-4 border-b border-border-subtle pb-3">
        <h3 className="text-base font-bold uppercase tracking-wide text-text-primary">System Infrastructure Status</h3>
        <p className="text-xs uppercase tracking-[0.16em] text-text-tertiary">Platform service health overview</p>
      </div>

      <ul className="space-y-2">
        {services.map((service) => (
          <li key={service.name} className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text-primary">{service.name}</p>
                <p className="text-xs text-text-tertiary">{service.detail}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={dotClass[service.status]} aria-hidden="true" />
                <span className={`text-xs font-semibold uppercase tracking-wide ${statusClass[service.status]}`}>{service.status}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default SystemInfrastructureStatus
