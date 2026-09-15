import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Download, RefreshCw } from 'lucide-react'

const COLORS = ['#6366f1','#22d3ee','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16']

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
        <span>{icon}</span> {label}
      </div>
      <div className="text-2xl font-bold text-white">{value ?? '—'}</div>
    </div>
  )
}

export default function Dashboard() {
  const [detections, setDetections] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchDetections = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/detect/log', { params: { limit: 500 } })
      setDetections(res.data.detections || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchDetections() }, [])

  // ── Computed stats ──────────────────────────────────────────────
  const totalDetections = detections.length

  const classFreq = detections.reduce((acc, d) => {
    acc[d.class_name] = (acc[d.class_name] || 0) + 1
    return acc
  }, {})
  const classData = Object.entries(classFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  const uniqueClasses = Object.keys(classFreq).length

  const avgConf = detections.length
    ? (detections.reduce((s, d) => s + d.confidence, 0) / detections.length * 100).toFixed(1)
    : 0

  // Detections over time (by minute)
  const timeData = detections.reduce((acc, d) => {
    if (!d.timestamp) return acc
    const min = d.timestamp.slice(0, 16)
    acc[min] = (acc[min] || 0) + 1
    return acc
  }, {})
  const timeChartData = Object.entries(timeData)
    .sort()
    .slice(-20)
    .map(([time, count]) => ({ time: time.slice(11), count }))

  // Source breakdown
  const sourceFreq = detections.reduce((acc, d) => {
    acc[d.source] = (acc[d.source] || 0) + 1
    return acc
  }, {})
  const sourceData = Object.entries(sourceFreq).map(([name, value]) => ({ name, value }))

  // CSV export
  const exportCSV = () => {
    const headers = ['id','timestamp','source','filename','class_name','confidence','activity_label']
    const rows = detections.map(d => headers.map(h => JSON.stringify(d[h] ?? '')).join(','))
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'detections.csv'; a.click()
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Overview of all detection activity</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchDetections} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm bg-gray-800 px-3 py-2 rounded-lg border border-gray-700 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={exportCSV} className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-sm bg-indigo-600/10 px-3 py-2 rounded-lg border border-indigo-600/30 transition-colors">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Detections" value={totalDetections} icon="🎯" />
        <StatCard label="Unique Classes"   value={uniqueClasses}   icon="🏷️" />
        <StatCard label="Avg Confidence"   value={`${avgConf}%`}   icon="📊" />
        <StatCard label="Sources"          value={Object.keys(sourceFreq).join(', ') || '—'} icon="📁" />
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Top classes bar chart */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Top Detected Classes</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={classData} margin={{ top: 0, right: 10, left: -10, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detections over time */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Detections Over Time</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={timeChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
              <Line type="monotone" dataKey="count" stroke="#22d3ee" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Source pie + recent detections table */}
      <div className="grid grid-cols-3 gap-5">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Detection Sources</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={sourceData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recent detections */}
        <div className="col-span-2 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <div className="p-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">Recent Detections</span>
          </div>
          <div className="overflow-y-auto max-h-56 scrollbar-thin">
            <table className="w-full text-xs">
              <thead className="bg-gray-800/50 sticky top-0">
                <tr className="text-left text-gray-500">
                  <th className="px-3 py-2">Class</th>
                  <th className="px-3 py-2">Confidence</th>
                  <th className="px-3 py-2">Activity</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {detections.slice(0, 50).map((d, i) => (
                  <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30">
                    <td className="px-3 py-1.5 font-medium text-white capitalize">{d.class_name}</td>
                    <td className={`px-3 py-1.5 font-bold ${d.confidence >= 0.7 ? 'text-green-400' : d.confidence >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {(d.confidence * 100).toFixed(0)}%
                    </td>
                    <td className="px-3 py-1.5 text-gray-400">{d.activity_label || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500 capitalize">{d.source}</td>
                    <td className="px-3 py-1.5 text-gray-600">{d.timestamp?.slice(11, 19) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
