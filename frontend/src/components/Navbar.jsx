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
    <nav className="fixed top-0 left-0 right-0 z-50 navbar-bg border-b border-gray-800 h-16">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Camera className="text-indigo-500 w-6 h-6" />
          <span className="font-bold text-lg tracking-tight navbar-text">
            Vision<span className="text-indigo-400">AI</span>
          </span>
        </div>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/40'
                  : 'nav-link hover:bg-gray-800'}`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </div>

        {/* Lamp theme toggle */}
        <div className="flex items-center pl-4 border-l border-gray-700 ml-2">
          <LampToggle />
        </div>
      </div>
    </nav>
  )
}
