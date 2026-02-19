import { FC } from 'react'

interface SectionBadgeProps {
  label: string
}

const SectionBadge: FC<SectionBadgeProps> = ({ label }) => {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
      {label}
    </span>
  )
}

export default SectionBadge
