import { FC, MouseEvent } from 'react'

interface LogoProps {
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
  size?: 'sm' | 'md' | 'lg'
  horizontal?: boolean
}

const Logo: FC<LogoProps> = ({ onClick, size = 'md', horizontal = false }) => {
  const sizeMap = {
    sm: { shieldWidth: 60, fontSize: 'text-lg', gap: 'gap-2' },
    md: { shieldWidth: 80, fontSize: 'text-2xl', gap: 'gap-3' },
    lg: { shieldWidth: 120, fontSize: 'text-4xl', gap: 'gap-4' }
  }
  
  const config = sizeMap[size]

  return (
    <div 
      className={`flex ${horizontal ? 'flex-row items-center' : 'flex-col items-center justify-center'} ${config.gap}`}
      onClick={onClick} 
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {/* Shield Logo */}
      <svg 
        viewBox="0 0 100 120" 
        width={config.shieldWidth} 
        xmlns="http://www.w3.org/2000/svg" 
        className="drop-shadow-md flex-shrink-0"
      >
        <defs>
          <linearGradient id="shieldBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:'#1E40AF',stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:'#1E3A8A',stopOpacity:1}} />
          </linearGradient>
          <pattern id="diagonalStripes" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#60A5FA" strokeWidth="4" />
          </pattern>
          <filter id="shieldShadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.4"/>
          </filter>
        </defs>
        
        {/* Shield Background */}
        <path 
          d="M 50 5 L 90 27 L 90 65 C 90 95 50 115 50 115 C 50 115 10 95 10 65 L 10 27 Z" 
          fill="url(#shieldBlue)"
          filter="url(#shieldShadow)"
        />
        
        {/* Diagonal Stripes */}
        <path 
          d="M 50 5 L 90 27 L 90 65 C 90 95 50 115 50 115 C 50 115 10 95 10 65 L 10 27 Z" 
          fill="url(#diagonalStripes)"
          opacity="0.6"
        />
        
        {/* Shield Border */}
        <path 
          d="M 50 8 L 87 28 L 87 65 C 87 92 50 110 50 110 C 50 110 13 92 13 65 L 13 28 Z" 
          fill="none" 
          stroke="rgba(255,255,255,0.3)" 
          strokeWidth="1.5"
        />
      </svg>

      {/* Text Content */}
      {horizontal ? (
        <div className="text-left">
          <h1 
            className={`${config.fontSize} font-black tracking-tight text-white drop-shadow-lg`}
            style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif", letterSpacing: '-0.5px' }}
          >
            Sentinel
          </h1>
        </div>
      ) : (
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-center transition-all hover:bg-white/15 hover:border-white/30">
          <h1 
            className={`${config.fontSize} font-black tracking-tight text-white drop-shadow-lg`}
            style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif", letterSpacing: '-0.5px' }}
          >
            SENTINEL
          </h1>
          <p 
            className="text-sm font-medium text-cyan-200 drop-shadow-md"
            style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif", letterSpacing: '0.5px' }}
          >
            Integrated Security Operations
          </p>
        </div>
      )}
    </div>
  )
}

export default Logo
