import { FC } from 'react'
import CommandMetricCard from './CommandMetricCard'

export interface OperationalMetric {
  label: string
  value: number | string
  tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success'
  hint?: string
}

interface OperationalSummaryStripProps {
  metrics: OperationalMetric[]
}

const OperationalSummaryStrip: FC<OperationalSummaryStripProps> = ({ metrics }) => {
  return (
    <section aria-label="Operational summary strip" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {metrics.map((metric) => (
        <CommandMetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          tone={metric.tone}
          hint={metric.hint}
        />
      ))}
    </section>
  )
}

export default OperationalSummaryStrip
