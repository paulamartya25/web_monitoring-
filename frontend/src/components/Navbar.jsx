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
      background: 'rgba(9,6,3,0.65)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(245,158,11,0.15)',
      boxShadow: '0 4px 40px rgba(0,0,0,0.4), inset 0 -1px 0 rgba(245,158,11,0.08)',
    }}>
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">

        {/* Animated logo */}
        <div className="flex items-center gap-2.5">
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 14px rgba(245,158,11,0.5)',
            animation: 'logoPulse 3s ease-in-out infinite',
          }}>
            <Camera style={{ color: '#090603', width: 18, height: 18 }} />
          </div>
          <span style={{
            fontWeight: 800, fontSize: 18, letterSpacing: '-0.5px',
            background: 'linear-gradient(90deg, #fef3c7, #f59e0b)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Vision<span style={{
              background: 'linear-gradient(90deg,#f59e0b,#ef4444)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>AI</span>
          </span>
          {/* Live indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 99, padding: '2px 8px',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: '#10b981',
              display: 'inline-block', animation: 'amberPulse 1.5s ease-in-out infinite',
            }} />
            <span style={{ color: '#10b981', fontSize: 10, fontWeight: 700 }}>LIVE</span>
          </div>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className="nav-link-item"
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 10,
                fontSize: 13, fontWeight: 600,
                transition: 'all 0.2s',
                textDecoration: 'none',
                color: isActive ? '#f59e0b' : '#92400e',
                background: isActive ? 'rgba(245,158,11,0.12)' : 'transparent',
                border: isActive ? '1px solid rgba(245,158,11,0.35)' : '1px solid transparent',
                boxShadow: isActive ? '0 0 12px rgba(245,158,11,0.15)' : 'none',
              })}
            >
              <Icon style={{ width: 15, height: 15 }} />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Lamp toggle */}
        <div style={{
          paddingLeft: 16,
          borderLeft: '1px solid rgba(245,158,11,0.15)',
          marginLeft: 8,
        }}>
          <LampToggle />
        </div>
      </div>
    </nav>
  )
}
