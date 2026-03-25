import { ComponentProps, FC } from 'react'
import ActiveIncidentsWidget from './ActiveIncidentsWidget'

export type ActiveIncidentsPanelProps = ComponentProps<typeof ActiveIncidentsWidget>

const ActiveIncidentsPanel: FC<ActiveIncidentsPanelProps> = (props) => {
  return <ActiveIncidentsWidget {...props} />
}

export default ActiveIncidentsPanel
