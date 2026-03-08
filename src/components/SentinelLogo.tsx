import { FC } from 'react'
import { useTheme } from '../context/ThemeProvider'

interface SentinelLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  stacked?: boolean
  className?: string
}

const sizeMap = {
  sm: { icon: 'h-8 w-8', wordmark: 'text-lg' },
  md: { icon: 'h-10 w-10', wordmark: 'text-xl' },
  lg: { icon: 'h-14 w-14', wordmark: 'text-3xl' },
}

const SentinelLogo: FC<SentinelLogoProps> = ({ size = 'md', showText = true, stacked = false, className = '' }) => {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const cfg = sizeMap[size]

  return (
    <div className={`inline-flex ${stacked ? 'flex-col items-center gap-3' : 'items-center gap-3'} ${className}`}>
      <svg
        viewBox="0 0 64 64"
        className={cfg.icon}
        role="img"
        aria-label="Sentinel shield logo"
      >
        <defs>
          <linearGradient id="sentinel-shield" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={dark ? '#22d3ee' : '#1d4ed8'} />
            <stop offset="100%" stopColor={dark ? '#0ea5e9' : '#0f766e'} />
          </linearGradient>
        </defs>

        <path
          d="M32 4L54 13V31C54 44 45 55 32 60C19 55 10 44 10 31V13L32 4Z"
          fill="none"
          stroke="url(#sentinel-shield)"
          strokeWidth="2.5"
        />
        <path
          d="M32 14L44 19V30C44 38 39 45 32 49C25 45 20 38 20 30V19L32 14Z"
          fill="none"
          stroke="url(#sentinel-shield)"
          strokeWidth="2"
          opacity="0.9"
        />
        <circle cx="32" cy="32" r="5" fill="url(#sentinel-shield)" />
        <path d="M32 20V44" stroke="url(#sentinel-shield)" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 32H44" stroke="url(#sentinel-shield)" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {showText && (
        <div className={stacked ? 'text-center' : ''}>
          <p className={`${cfg.wordmark} font-black uppercase tracking-[0.22em] text-text-primary leading-none`}>SENTINEL</p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">Security Operations Platform</p>
        </div>
      )}
    </div>
  )
}

export default SentinelLogo
