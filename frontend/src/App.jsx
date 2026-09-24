import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './context/ThemeContext'
import Navbar from './components/Navbar'
import AICursor from './components/AICursor'
import LiveStream from './pages/LiveStream'
import Upload from './pages/Upload'
import Evaluate from './pages/Evaluate'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-950 text-gray-100 theme-root">
        <AICursor />
        <Navbar />
        <main className="pt-16">
          <Routes>
            <Route path="/"          element={<Navigate to="/live" replace />} />
            <Route path="/live"      element={<LiveStream />} />
            <Route path="/upload"    element={<Upload />} />
            <Route path="/evaluate"  element={<Evaluate />} />
            <Route path="/dashboard" element={<Dashboard />} />
          </Routes>
        </main>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' },
          }}
        />
      </div>
    </ThemeProvider>
  )
}
