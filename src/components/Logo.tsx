import { FC, MouseEvent } from 'react'
import { useTheme } from '../context/ThemeProvider'

interface LogoProps {
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  size?: 'sm' | 'md' | 'lg'
  horizontal?: boolean
  logoOnly?: boolean
}

const Logo: FC<LogoProps> = ({ onClick, size = 'md', horizontal = false, logoOnly = false }) => {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  
  const sizeMap = {
    sm: { logoWidth: 52, fontSize: 'text-xl', gap: 'gap-2.5' },
    md: { logoWidth: 72, fontSize: 'text-2xl', gap: 'gap-3' },
    lg: { logoWidth: 120, fontSize: 'text-4xl', gap: 'gap-5' }
  }
  
  const config = sizeMap[size]

  return (
    <div
      className={`flex ${horizontal ? 'flex-row items-center' : 'flex-col items-center justify-center'} ${config.gap}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Circuit Shield SVG */}
      <svg
        viewBox="0 0 200 230"
        width={config.logoWidth}
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-lg flex-shrink-0"
        style={{ 
          filter: isDark 
            ? 'drop-shadow(0 0 8px rgba(0,180,220,0.4))' 
            : 'drop-shadow(0 0 12px rgba(59,130,246,0.3))'
        }}
      >
        <defs>
          {/* Dark Mode Gradients */}
          <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#00D4F0" />
            <stop offset="55%"  stopColor="#0098C8" />
            <stop offset="100%" stopColor="#005A82" />
          </linearGradient>
          <linearGradient id="shieldGradDark" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#00C4E8" />
            <stop offset="100%" stopColor="#004E72" />
          </linearGradient>
          
          {/* Light Mode Gradients */}
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3B82F6" />
            <stop offset="55%"  stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
          <linearGradient id="shieldGradLight" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"   stopColor="#60A5FA" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
          <clipPath id="innerShieldClip">
            <path d="M100,212 C84,200 36,174 32,144 L32,72 C32,53 65,30 100,19 C135,30 168,53 168,72 L168,144 C164,174 116,200 100,212 Z" />
          </clipPath>
        </defs>

        {/* Outer shield border */}
        <path
          d="M100,225 C78,211 18,178 14,144 L14,64 C14,42 57,16 100,4 C143,16 186,42 186,64 L186,144 C182,178 122,211 100,225 Z"
          fill="none"
          stroke={isDark ? "url(#shieldGradDark)" : "url(#shieldGradLight)"}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Inner shield border */}
        <path
          d="M100,212 C84,200 36,174 32,144 L32,72 C32,53 65,30 100,19 C135,30 168,53 168,72 L168,144 C164,174 116,200 100,212 Z"
          fill="none"
          stroke={isDark ? "url(#shieldGradDark)" : "url(#shieldGradLight)"}
          strokeWidth="2"
          strokeLinejoin="round"
          opacity="0.8"
        />

        {/* Circuit traces clipped to inner shield */}
        <g clipPath="url(#innerShieldClip)" 
           stroke={isDark ? "url(#tealGrad)" : "url(#blueGrad)"} 
           fill={isDark ? "url(#tealGrad)" : "url(#blueGrad)"}>

          {/* x=48 â€“ far left, short */}
          <line x1="48" y1="192" x2="48" y2="162" strokeWidth="1.8" />
          <circle cx="48" cy="192" r="3.5" />
          <circle cx="48" cy="162" r="3.5" />

          {/* x=63 â€“ medium */}
          <line x1="63" y1="196" x2="63" y2="128" strokeWidth="1.8" />
          <circle cx="63" cy="196" r="3.5" />
          <circle cx="63" cy="160" r="2.8" opacity="0.7" />
          <circle cx="63" cy="128" r="3.5" />

          {/* x=78 â€“ tall */}
          <line x1="78" y1="196" x2="78" y2="90" strokeWidth="1.8" />
          <circle cx="78" cy="196" r="3.5" />
          <circle cx="78" cy="148" r="2.8" opacity="0.7" />
          <circle cx="78" cy="90"  r="3.5" />

          {/* x=91 â€“ very tall */}
          <line x1="91" y1="196" x2="91" y2="68" strokeWidth="1.8" />
          <circle cx="91" cy="196" r="3.5" />
          <circle cx="91" cy="155" r="2.8" opacity="0.7" />
          <circle cx="91" cy="115" r="2.8" opacity="0.7" />
          <circle cx="91" cy="68"  r="3.5" />

          {/* x=100 â€“ centre, tallest */}
          <line x1="100" y1="196" x2="100" y2="50" strokeWidth="2" />
          <circle cx="100" cy="196" r="3.5" />
          <circle cx="100" cy="166" r="2.8" opacity="0.7" />
          <circle cx="100" cy="126" r="3.5" />
          <circle cx="100" cy="86"  r="2.8" opacity="0.7" />
          <circle cx="100" cy="50"  r="3.5" />

          {/* x=109 â€“ mirror of 91 */}
          <line x1="109" y1="196" x2="109" y2="68" strokeWidth="1.8" />
          <circle cx="109" cy="196" r="3.5" />
          <circle cx="109" cy="155" r="2.8" opacity="0.7" />
          <circle cx="109" cy="115" r="2.8" opacity="0.7" />
          <circle cx="109" cy="68"  r="3.5" />

          {/* x=122 â€“ mirror of 78 */}
          <line x1="122" y1="196" x2="122" y2="90" strokeWidth="1.8" />
          <circle cx="122" cy="196" r="3.5" />
          <circle cx="122" cy="148" r="2.8" opacity="0.7" />
          <circle cx="122" cy="90"  r="3.5" />

          {/* x=137 â€“ mirror of 63 */}
          <line x1="137" y1="196" x2="137" y2="128" strokeWidth="1.8" />
          <circle cx="137" cy="196" r="3.5" />
          <circle cx="137" cy="160" r="2.8" opacity="0.7" />
          <circle cx="137" cy="128" r="3.5" />

          {/* x=152 â€“ far right, short */}
          <line x1="152" y1="192" x2="152" y2="162" strokeWidth="1.8" />
          <circle cx="152" cy="192" r="3.5" />
          <circle cx="152" cy="162" r="3.5" />

        </g>
      </svg>

      {/* Text */}
      {!logoOnly && (horizontal ? (
        <div className="text-left">
          <h1
            className={`${config.fontSize} font-black tracking-tight text-white leading-none`}
            style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif", letterSpacing: '-0.5px' }}
          >
            Sentinel
          </h1>
        </div>
      ) : (
        <div
          className="rounded-xl px-4 py-2 text-center"
          style={{
            background: 'rgba(0,150,200,0.1)',
            border: '1px solid rgba(0,200,240,0.25)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <h1
            className={`${config.fontSize} font-black tracking-widest text-white leading-tight`}
            style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}
          >
            SENTINEL
          </h1>
          <p
            className="text-xs font-semibold tracking-wider"
            style={{ color: '#5DD8F0', fontFamily: "'Inter', sans-serif", letterSpacing: '1px' }}
          >
            Integrated Security Operations
          </p>
        </div>
      ))}
    </div>
  )
}

export default Logo
