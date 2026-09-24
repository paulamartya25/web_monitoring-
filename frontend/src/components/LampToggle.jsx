import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'

export default function LampToggle() {
  const { isDark, toggle } = useTheme()
  const [swinging, setSwinging] = useState(false)

  const handleClick = () => {
    setSwinging(true)
    setTimeout(() => setSwinging(false), 900)
    toggle()
  }

  return (
    <button
      onClick={handleClick}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      className="relative flex flex-col items-center group select-none"
      style={{ width: 36, height: 58, background: 'none', border: 'none', cursor: 'none' }}
    >
      {/* Hanging cord */}
      <div
        className="transition-colors duration-300"
        style={{
          width: 2,
          height: 18,
          background: isDark ? '#6b7280' : '#9ca3af',
          borderRadius: 2,
          transformOrigin: 'top center',
          animation: swinging ? 'lampSwing 0.9s ease-out' : 'none',
        }}
      />

      {/* Lamp body */}
      <div
        style={{
          transformOrigin: 'top center',
          animation: swinging ? 'lampSwing 0.9s ease-out' : 'none',
          position: 'relative',
        }}
      >
        {/* Glow halo (light mode only) */}
        {!isDark && (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(251,191,36,0) 70%)',
              filter: 'blur(6px)',
              pointerEvents: 'none',
            }}
          />
        )}

        <svg width="34" height="40" viewBox="0 0 34 40" fill="none">
          {/* Lamp shade */}
          <path
            d="M5 16 L29 16 L24 6 L10 6 Z"
            fill={isDark ? '#374151' : '#fbbf24'}
            stroke={isDark ? '#4b5563' : '#f59e0b'}
            strokeWidth="1.2"
          />
          {/* Shade bottom ring */}
          <ellipse cx="17" cy="16" rx="12" ry="2.5"
            fill={isDark ? '#4b5563' : '#f59e0b'} />

          {/* Bulb */}
          <ellipse cx="17" cy="25" rx="7" ry="8"
            fill={isDark ? '#1f2937' : '#fef08a'}
            stroke={isDark ? '#374151' : '#fde68a'}
            strokeWidth="1"
          />

          {/* Filament (visible in dark) */}
          {isDark && (
            <path
              d="M14 22 Q17 20 20 22 Q17 24 14 22"
              stroke="#6b7280" strokeWidth="0.8" fill="none"
            />
          )}

          {/* Inner bulb glow */}
          {!isDark && (
            <ellipse cx="17" cy="24" rx="4" ry="4.5"
              fill="rgba(255,255,200,0.8)" />
          )}

          {/* Cap / base */}
          <rect x="13" y="32" width="8" height="4" rx="1.5"
            fill={isDark ? '#4b5563' : '#d97706'}
          />
          <rect x="14.5" y="35.5" width="5" height="2" rx="1"
            fill={isDark ? '#374151' : '#b45309'}
          />
        </svg>
      </div>

      {/* Tooltip label */}
      <span
        className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap
          opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        style={{ color: isDark ? '#9ca3af' : '#6b7280', fontSize: 10 }}
      >
        {isDark ? '☀️ Light' : '🌙 Dark'}
      </span>
    </button>
  )
}
