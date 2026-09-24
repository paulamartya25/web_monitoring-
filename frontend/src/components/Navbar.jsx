import { NavLink } from 'react-router-dom'
import { Camera, Upload, BarChart3, Activity } from 'lucide-react'
import LampToggle from './LampToggle'

const links = [
  { to: '/live',      label: 'Live Stream', icon: Camera },
  { to: '/upload',    label: 'Upload',      icon: Upload },
  { to: '/evaluate',  label: 'Evaluate',    icon: BarChart3 },
  { to: '/dashboard', label: 'Dashboard',   icon: Activity },
]

export default function Navbar() {
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: 64,
      background: 'rgba(4,4,14,0.55)',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 1px 50px rgba(0,0,0,0.6), inset 0 -1px 0 rgba(255,255,255,0.05)',

    }}>
      {/* Top edge glow line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.6), rgba(6,182,212,0.6), rgba(139,92,246,0.6), transparent)',
        animation: 'gradientShift 4s ease infinite',
        backgroundSize: '200% 200%',
      }}/>

      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'logoPulse 3s ease-in-out infinite',
            flexShrink: 0,
          }}>
            <Camera style={{ color: '#fff', width: 18, height: 18 }} />
          </div>

          <span style={{
            fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px',
            background: 'linear-gradient(90deg, #e2e8f0 0%, #60a5fa 40%, #06b6d4 70%, #8b5cf6 100%)',
            backgroundSize: '200% 200%',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            animation: 'gradientShift 5s ease infinite',
          }}>
            Vision<span>AI</span>
          </span>

          {/* Live badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(16,185,129,0.1)',
            border: '1px solid rgba(16,185,129,0.35)',
            borderRadius: 99, padding: '2px 9px',
          }}>
            <span className="blue-pulse" style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#10b981', display: 'inline-block',
              boxShadow: '0 0 6px #10b981',
            }}/>
            <span style={{ color: '#10b981', fontSize: 10, fontWeight: 700 }}>LIVE</span>
          </div>
        </div>

        {/* Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 10,
              fontSize: 13, fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.2s',
              color:      isActive ? '#60a5fa' : '#334155',
              background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
              border:     isActive ? '1px solid rgba(59,130,246,0.35)' : '1px solid transparent',
              boxShadow:  isActive ? '0 0 14px rgba(59,130,246,0.18)' : 'none',
            })}>
              <Icon style={{ width: 15, height: 15 }} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Lamp toggle */}
        <div style={{
          paddingLeft: 16,
          borderLeft: '1px solid rgba(59,130,246,0.15)',
          marginLeft: 8,
        }}>
          <LampToggle />
        </div>
      </div>
    </nav>
  )
}
