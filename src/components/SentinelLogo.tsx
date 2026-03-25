import { FC, useId } from 'react'

type LogoVariant = 'IconOnly' | 'FullLogo'

interface SentinelLogoProps {
  size?: number
  className?: string
  variant?: LogoVariant
  animated?: boolean
}

const iconClasses =
  'text-sky-700 dark:text-cyan-300 [--logo-iris-start:#1d4ed8] [--logo-iris-end:#0ea5e9] [--logo-beam-start:#22d3ee] [--logo-beam-end:#0ea5e9] dark:[--logo-iris-start:#67e8f9] dark:[--logo-iris-end:#22d3ee] dark:[--logo-beam-start:#67e8f9] dark:[--logo-beam-end:#22d3ee]'

const ReticleEyeIcon: FC<{ size: number; className?: string; animated?: boolean }> = ({ size, className = '', animated = false }) => {
  const uid = useId().replace(/:/g, '')
  const irisId = `sentinel-iris-${uid}`
  const beamId = `sentinel-beam-${uid}`
  const eyeGlowId = `sentinel-eye-glow-${uid}`
  const beamGlowId = `sentinel-beam-glow-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Sentinel Target and Scope icon"
      className={`${iconClasses} ${className}`.trim()}
      fill="none"
    >
      <defs>
        <linearGradient id={irisId} x1="35" y1="35" x2="65" y2="65" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--logo-iris-start)" />
          <stop offset="100%" stopColor="var(--logo-iris-end)" />
        </linearGradient>

        <linearGradient id={beamId} x1="50" y1="50" x2="80" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="var(--logo-beam-start)" stopOpacity="0" />
          <stop offset="60%" stopColor="var(--logo-beam-start)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--logo-beam-end)" stopOpacity="0.72" />
        </linearGradient>

        <filter id={eyeGlowId} x="-45%" y="-45%" width="190%" height="190%" colorInterpolationFilters="sRGB">
          <feGaussianBlur stdDeviation="1.15" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id={beamGlowId} x="-70%" y="-70%" width="240%" height="240%" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="0" stdDeviation="1.8" floodColor="#22d3ee" floodOpacity="0.35" />
          <feDropShadow dx="0" dy="0" stdDeviation="2.4" floodColor="#0ea5e9" floodOpacity="0.2" />
        </filter>
      </defs>

      {animated && (
        <>
          <circle
            cx="50"
            cy="50"
            r="12"
            stroke="var(--logo-beam-start)"
            strokeWidth="1.5"
            fill="none"
            opacity="0.42"
            className="sentinel-scan-ring sentinel-scan-ring-1"
          />
          <circle
            cx="50"
            cy="50"
            r="18"
            stroke="var(--logo-beam-end)"
            strokeWidth="1.25"
            fill="none"
            opacity="0.36"
            className="sentinel-scan-ring sentinel-scan-ring-2"
          />

          <g opacity="0.68" className="dark:opacity-95" filter={`url(#${beamGlowId})`}>
            <path d="M50 50 L50 18 A32 32 0 0 1 76 32 Z" fill={`url(#${beamId})`} transform="rotate(-18 50 50)" opacity="0.2" />
            <path d="M50 50 L50 18 A32 32 0 0 1 76 32 Z" fill={`url(#${beamId})`} transform="rotate(-9 50 50)" opacity="0.34" />
            <g className="sentinel-beam-sweep" style={{ transformOrigin: '50px 50px' }}>
              <path d="M50 50 L50 18 A32 32 0 0 1 76 32 Z" fill={`url(#${beamId})`} opacity="0.96" />
            </g>
          </g>
        </>
      )}

      <line x1="6" y1="50" x2="28" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="72" y1="50" x2="94" y2="50" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="6" x2="50" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="50" y1="72" x2="50" y2="94" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />

      <circle
        cx="50"
        cy="50"
        r="32"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeDasharray="14 6 4 6"
        strokeLinecap="round"
        opacity="0.95"
      />

      <line x1="50" y1="12" x2="50" y2="16" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="50" y1="84" x2="50" y2="88" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="12" y1="50" x2="16" y2="50" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <line x1="84" y1="50" x2="88" y2="50" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />

      <path
        d="M26 50C32 41.5 40.4 37 50 37C59.6 37 68 41.5 74 50C68 58.5 59.6 63 50 63C40.4 63 32 58.5 26 50Z"
        stroke="currentColor"
        strokeWidth="2"
        fill="rgba(255,255,255,0.06)"
      />

      <circle
        cx="50"
        cy="50"
        r="10"
        fill={`url(#${irisId})`}
        filter={`url(#${eyeGlowId})`}
        className={animated ? 'sentinel-iris-pulse' : ''}
      />
      <circle cx="50" cy="50" r="4.2" fill="#0f172a" />
      <circle cx="47.2" cy="47.2" r="1.6" fill="#ffffff" />
      {animated && (
        <circle
          cx="50"
          cy="50"
          r="6"
          fill="none"
          stroke="var(--logo-beam-start)"
          strokeWidth="1.2"
          opacity="0.45"
          className="sentinel-focus-ring-pulse"
        />
      )}
    </svg>
  )
}

export const IconOnly: FC<Pick<SentinelLogoProps, 'size' | 'className' | 'animated'>> = ({ size = 40, className, animated = false }) => (
  <ReticleEyeIcon size={size} className={className} animated={animated} />
)

export const FullLogo: FC<Pick<SentinelLogoProps, 'size' | 'className' | 'animated'>> = ({ size = 40, className, animated = false }) => {
  const textSizeClass = size >= 56 ? 'text-2xl' : size >= 44 ? 'text-xl' : 'text-lg'
  return (
    <div className={`inline-flex flex-col items-center gap-2 ${className ?? ''}`.trim()}>
      <ReticleEyeIcon size={size} animated={animated} />
      <span className={`${textSizeClass} font-black uppercase tracking-[0.24em] text-text-primary leading-none`}>
        SENTINEL
      </span>
    </div>
  )
}

const SentinelLogo: FC<SentinelLogoProps> = ({ size = 40, className, variant = 'FullLogo', animated = false }) => {
  if (variant === 'IconOnly') {
    return <IconOnly size={size} className={className} animated={animated} />
  }
  return <FullLogo size={size} className={className} animated={animated} />
}

export default SentinelLogo
