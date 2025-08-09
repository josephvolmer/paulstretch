import React from 'react'

interface ClayMascotProps {
  className?: string
  animated?: boolean
}

export const ClayMascot: React.FC<ClayMascotProps> = ({ className = '', animated = true }) => {
  return (
    <svg
      width="80"
      height="80"
      viewBox="0 0 100 100"
      className={`${className} ${animated ? 'animate-bounce-slow' : ''}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Clay body */}
      <ellipse
        cx="50"
        cy="65"
        rx="25"
        ry="20"
        fill="#D2691E"
        stroke="#A0522D"
        strokeWidth="2"
        className={animated ? 'animate-wiggle' : ''}
      />
      
      {/* Clay head */}
      <circle
        cx="50"
        cy="35"
        r="22"
        fill="#DEB887"
        stroke="#A0522D"
        strokeWidth="2"
      />
      
      {/* Eyes */}
      <circle cx="42" cy="33" r="3" fill="#000" />
      <circle cx="58" cy="33" r="3" fill="#000" />
      <circle cx="43" cy="32" r="1" fill="#FFF" />
      <circle cx="59" cy="32" r="1" fill="#FFF" />
      
      {/* Happy mouth */}
      <path
        d="M 40 40 Q 50 46 60 40"
        stroke="#000"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      
      {/* Arms */}
      <ellipse
        cx="25"
        cy="60"
        rx="8"
        ry="15"
        fill="#D2691E"
        stroke="#A0522D"
        strokeWidth="2"
        transform="rotate(-30 25 60)"
        className={animated ? 'animate-wave-left' : ''}
      />
      <ellipse
        cx="75"
        cy="60"
        rx="8"
        ry="15"
        fill="#D2691E"
        stroke="#A0522D"
        strokeWidth="2"
        transform="rotate(30 75 60)"
        className={animated ? 'animate-wave-right' : ''}
      />
      
      {/* Headphones */}
      <path
        d="M 25 30 Q 50 15 75 30"
        stroke="#333"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      <rect x="20" y="28" width="10" height="15" rx="5" fill="#333" />
      <rect x="70" y="28" width="10" height="15" rx="5" fill="#333" />
      
      {/* Musical notes floating around */}
      <text x="15" y="20" fontSize="12" fill="#6B46C1" className={animated ? 'animate-float-1' : ''}>♪</text>
      <text x="80" y="25" fontSize="10" fill="#8B5CF6" className={animated ? 'animate-float-2' : ''}>♫</text>
      <text x="85" y="50" fontSize="11" fill="#6B46C1" className={animated ? 'animate-float-3' : ''}>♪</text>
    </svg>
  )
}