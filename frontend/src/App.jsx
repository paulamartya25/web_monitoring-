import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from './context/ThemeContext'
import Navbar from './components/Navbar'
import AICursor from './components/AICursor'
import NeuralBackground from './components/NeuralBackground'
import LiveStream from './pages/LiveStream'
import Upload from './pages/Upload'
import Evaluate from './pages/Evaluate'
import Dashboard from './pages/Dashboard'

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-gray-950 text-gray-100" style={{ position: 'relative' }}>
        <NeuralBackground />
        <AICursor />
        <Navbar />
        <main className="pt-16" style={{ position: 'relative', zIndex: 1 }}>
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
            style: { background: '#17100a', color: '#fef3c7', border: '1px solid #2a1d10' },
          }}
        />
      </div>
    </ThemeProvider>
  )
}
