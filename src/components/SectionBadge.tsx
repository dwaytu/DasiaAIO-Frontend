import { FC } from 'react'

interface SectionBadgeProps {
  label: string
}

const SectionBadge: FC<SectionBadgeProps> = ({ label }) => {
  return (
    <span className="soc-section-badge">
      {label}
    </span>
  )
}

export default SectionBadge
