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
      {/* Mobile Logo - Text Only */}
      <svg viewBox="0 0 200 180" width="200" xmlns="http://www.w3.org/2000/svg" className="block md:hidden">
        <text x="100" y="58" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
          fontSize="22" fontWeight="700" fill="#111827" letterSpacing="0.5" textAnchor="middle">
          Davao Security
        </text>
        <text x="100" y="92" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
          fontSize="22" fontWeight="700" fill="#111827" letterSpacing="0.5" textAnchor="middle">
          Investigation
        </text>
        <text x="100" y="130" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
          fontSize="18" fontWeight="600" fill="#4f46e5" letterSpacing="0.3" textAnchor="middle">
          Agency Inc.
        </text>
      </svg>

      {/* Desktop Logo - Text Only */}
      <svg viewBox="0 0 520 200" width="360" xmlns="http://www.w3.org/2000/svg" className="hidden md:block">
        <text x="0" y="80" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
              fontSize="32" fontWeight="700" fill="#333" letterSpacing="0.5">
          Davao Security &
        </text>
        <text x="0" y="120" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
              fontSize="32" fontWeight="700" fill="#333" letterSpacing="0.5">
          Investigation Agency
        </text>
        <text x="0" y="155" fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" 
              fontSize="20" fontWeight="600" fill="#667eea" letterSpacing="0.3">
          Inc.
        </text>
      </svg>
    </div>
  )
}

export default Logo
