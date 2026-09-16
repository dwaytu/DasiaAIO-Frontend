import { FC } from 'react'

interface DeniedFallbackProps {
  title?: string
  reason?: string
}

const DeniedFallback: FC<DeniedFallbackProps> = ({
  title = 'Action unavailable',
  reason = 'Your role does not have permission for this action.',
}) => {
  return (
    <div className="soc-status-warning rounded px-3 py-2 text-sm" role="status" aria-live="polite">
      <p className="font-semibold">{title}</p>
      <p className="text-xs opacity-90">{reason}</p>
    </div>
  )
}

export default DeniedFallback
