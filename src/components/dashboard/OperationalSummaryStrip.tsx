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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <CommandMetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          tone={metric.tone}
          hint={metric.hint}
        />
      ))}
    </div>
  )
}

export default OperationalSummaryStrip
