import { FC } from 'react'

interface SectionBadgeProps {
  label: string
}

const SectionBadge: FC<SectionBadgeProps> = ({ label }) => {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)' }}>
      {label}
    </span>
  )
}

export default SectionBadge
