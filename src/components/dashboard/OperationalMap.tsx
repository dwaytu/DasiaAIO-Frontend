import { FC } from 'react'
import OperationalMapPanel from './OperationalMapPanel'

interface OperationalMapProps {
  recentVehicleReports: number
  recentGuardReports: number
}

const OperationalMap: FC<OperationalMapProps> = ({ recentVehicleReports, recentGuardReports }) => {
  return <OperationalMapPanel recentVehicleReports={recentVehicleReports} recentGuardReports={recentGuardReports} />
}

export default OperationalMap
