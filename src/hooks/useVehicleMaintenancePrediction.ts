import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL } from '../config'
import { fetchJsonOrThrow } from '../utils/api'

export type VehicleRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

export interface VehicleMaintenancePrediction {
  vehicleId: string
  licensePlate: string
  riskScore: number
  riskLevel: VehicleRiskLevel
  mileageSinceService: number
  daysSinceService: number
  maintenanceHistoryCount: number
  recommendedAction: string
  formula: string
  calculatedAt: string
}

interface UseVehicleMaintenancePredictionState {
  predictions: VehicleMaintenancePrediction[]
  loading: boolean
  error: string
  lastUpdated: string
  refresh: () => Promise<void>
}

export function useVehicleMaintenancePrediction(): UseVehicleMaintenancePredictionState {
  const [predictions, setPredictions] = useState<VehicleMaintenancePrediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState('')

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const data = await fetchJsonOrThrow<VehicleMaintenancePrediction[]>(
        `${API_BASE_URL}/api/ai/vehicle-maintenance-risk`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Failed to load predictive vehicle maintenance risk',
      )

      setPredictions(Array.isArray(data) ? data : [])
      setError('')
      setLastUpdated(new Date().toLocaleTimeString())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load predictive vehicle maintenance risk')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    predictions,
    loading,
    error,
    lastUpdated,
    refresh,
  }
}
