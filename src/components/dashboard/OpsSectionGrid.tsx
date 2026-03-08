import { FC, ReactNode } from 'react'

interface OpsSectionGridProps {
  children: ReactNode
}

const OpsSectionGrid: FC<OpsSectionGridProps> = ({ children }) => {
  return <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">{children}</div>
}

export default OpsSectionGrid
