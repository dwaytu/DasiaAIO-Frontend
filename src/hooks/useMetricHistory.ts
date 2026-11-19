import { useEffect, useState } from 'react'

export interface MetricReading {
  checkedAt: number
  value: number
}

export function useMetricHistory(checkedAt: number | null, value: number) {
  const [readings, setReadings] = useState<MetricReading[]>([])

  useEffect(() => {
    if (checkedAt === null) return

    setReadings((previous) => {
      if (previous[previous.length - 1]?.checkedAt === checkedAt) return previous
      return [...previous.slice(-6), { checkedAt, value }]
    })
  }, [checkedAt, value])

  return readings
}
