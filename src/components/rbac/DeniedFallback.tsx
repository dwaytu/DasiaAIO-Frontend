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
    <div className="rounded border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" role="status" aria-live="polite">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-amber-100/90">{reason}</p>
    </div>
  )
}

export default DeniedFallback
