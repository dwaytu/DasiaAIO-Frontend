import { FC } from 'react'
import OperationalMapPanel from './OperationalMapPanel'

interface OperationalMapProps {
  activeTrips: number
  activeGuards: number
}

const OperationalMap: FC<OperationalMapProps> = ({ activeTrips, activeGuards }) => {
  return <OperationalMapPanel activeTrips={activeTrips} activeGuards={activeGuards} />
}

export default OperationalMap