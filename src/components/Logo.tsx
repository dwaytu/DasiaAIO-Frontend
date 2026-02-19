import { FC, MouseEvent } from 'react'

interface LogoProps {
  onClick?: (e: MouseEvent<HTMLDivElement>) => void
}

const Logo: FC<LogoProps> = ({ onClick }) => {
  return (
    <div 
      className="flex items-center justify-center"
      onClick={onClick} 
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <style>{`
        @keyframes logoPulse {
          0%, 100% {
            filter: drop-shadow(0 0 0px rgba(102, 126, 234, 0.4));
          }
          50% {
            filter: drop-shadow(0 0 20px rgba(102, 126, 234, 0.8)) drop-shadow(0 0 40px rgba(118, 75, 162, 0.6));
          }
        }
        .logo-pulse {
          animation: logoPulse 2.5s ease-in-out infinite;
        }
      `}</style>
      
      {/* Mobile Logo - Shield with Text Below */}
      <svg viewBox="0 0 200 280" width="90" height="auto" xmlns="http://www.w3.org/2000/svg" className="block md:hidden logo-pulse">
        <defs>
          <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:'#667eea',stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:'#764ba2',stopOpacity:1}} />
          </linearGradient>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
          </filter>
        </defs>
        
        {/* Shield */}
        <circle cx="100" cy="80" r="75" fill="white" filter="url(#shadow)"/>
        <path d="M 100 15 L 150 45 L 150 95 C 150 130 100 145 100 145 C 100 145 50 130 50 95 L 50 45 Z" 
              fill="url(#purpleGradient)" 
              filter="url(#shadow)"/>
        <path d="M 100 25 L 145 50 L 145 95 C 145 125 100 138 100 138 C 100 138 55 125 55 95 L 55 50 Z" 
              fill="none" 
              stroke="white" 
              strokeWidth="2" 
              opacity="0.3"/>
        <g transform="translate(100, 80)">
          <circle cx="0" cy="0" r="20" fill="white" opacity="0.1"/>
          <path d="M -6 1 L -1 6 L 8 -3" 
                stroke="white" 
                strokeWidth="2.5" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round"/>
        </g>
        <circle cx="75" cy="65" r="1.5" fill="white" opacity="0.5"/>
        <circle cx="125" cy="65" r="1.5" fill="white" opacity="0.5"/>
        
        {/* Text Below Shield */}
        <text x="100" y="180" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
              fontSize="11" fontWeight="700" fill="#333" letterSpacing="0.3" textAnchor="middle">
          Davao Security
        </text>
        <text x="100" y="195" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
              fontSize="11" fontWeight="700" fill="#333" letterSpacing="0.3" textAnchor="middle">
          Investigation
        </text>
        <text x="100" y="210" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
              fontSize="8" fontWeight="600" fill="#667eea" letterSpacing="0.2" textAnchor="middle">
          Agency Inc.
        </text>
      </svg>

      {/* Desktop Logo - Shield + Text */}
      <svg viewBox="0 0 520 200" width="280" height="auto" xmlns="http://www.w3.org/2000/svg" className="hidden md:block logo-pulse">
        <defs>
          <linearGradient id="purpleGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{stopColor:'#667eea',stopOpacity:1}} />
            <stop offset="100%" style={{stopColor:'#764ba2',stopOpacity:1}} />
          </linearGradient>
          <filter id="shadow2" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15"/>
          </filter>
        </defs>
        
        <circle cx="100" cy="100" r="95" fill="white" filter="url(#shadow2)"/>
        <path d="M 100 30 L 160 60 L 160 110 C 160 150 100 165 100 165 C 100 165 40 150 40 110 L 40 60 Z" 
              fill="url(#purpleGradient2)" 
              filter="url(#shadow2)"/>
        <path d="M 100 40 L 155 65 L 155 110 C 155 145 100 158 100 158 C 100 158 45 145 45 110 L 45 65 Z" 
              fill="none" 
              stroke="white" 
              strokeWidth="2" 
              opacity="0.3"/>
        <g transform="translate(100, 100)">
          <circle cx="0" cy="0" r="25" fill="white" opacity="0.1"/>
          <path d="M -8 2 L -2 8 L 10 -4" 
                stroke="white" 
                strokeWidth="3" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round"/>
        </g>
        <circle cx="70" cy="80" r="2" fill="white" opacity="0.5"/>
        <circle cx="130" cy="80" r="2" fill="white" opacity="0.5"/>
        
        <text x="220" y="65" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
              fontSize="24" fontWeight="700" fill="#333" letterSpacing="0.5">
          Davao Security &
        </text>
        <text x="220" y="95" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
              fontSize="24" fontWeight="700" fill="#333" letterSpacing="0.5">
          Investigation Agency
        </text>
        <text x="220" y="125" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
              fontSize="16" fontWeight="600" fill="#667eea" letterSpacing="0.3">
          Inc.
        </text>
      </svg>
    </div>
  )
}

export default Logo
