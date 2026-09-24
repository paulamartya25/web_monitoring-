import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { Download, RefreshCw, Bell, Cpu, Zap, Target, AlertTriangle, Activity, Eye, TrendingUp } from 'lucide-react'

const AMBER   = '#f59e0b'
const AMBER_D = '#d97706'
const COLORS  = [AMBER, '#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4']

const WARM_CARD  = { background: '#17100a', border: '1px solid #2a1d10', borderRadius: 14 }
const WARM_INNER = { background: '#1e160a', borderRadius: 10 }

function StatCard({ label, value, icon: Icon, accent, sub }) {
  return (
    <div style={WARM_CARD} className="p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span style={{ color: '#92400e' }} className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        <div style={{ background: accent ? `${accent}20` : '#2a1d10', borderRadius: 8, padding: '5px 7px' }}>
          <Icon style={{ color: accent || AMBER }} className="w-4 h-4" />
        </div>
      </div>
      <div style={{ color: '#fef3c7' }} className="text-3xl font-bold tracking-tight">{value ?? '—'}</div>
      {sub && <div style={{ color: '#78350f' }} className="text-xs">{sub}</div>}
    </div>
  )
}

function AlertCard({ title, detail, count, severity, time }) {
  const severityColor = severity === 'critical' ? '#ef4444' : severity === 'warning' ? AMBER : '#10b981'
  return (
    <div style={{ ...WARM_INNER, border: `1px solid ${severityColor}30` }} className="p-3 flex items-start gap-3">
      <div style={{ background: `${severityColor}20`, borderRadius: 8, padding: 6 }}>
        <AlertTriangle style={{ color: severityColor }} className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p style={{ color: '#fef3c7' }} className="text-sm font-semibold truncate">{title}</p>
        <p style={{ color: '#92400e' }} className="text-xs mt-0.5 truncate">{detail}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span style={{ background: `${severityColor}20`, color: severityColor, borderRadius: 99 }}
            className="text-xs px-2 py-0.5 font-bold">{count} detected</span>
          <span style={{ color: '#78350f' }} className="text-xs">{time}</span>
        </div>
      </div>
      <button
        style={{ background: AMBER_D, color: '#0c0804', borderRadius: 7, fontSize: 11, fontWeight: 700 }}
        className="px-3 py-1.5 shrink-0 hover:opacity-90 transition-opacity"
      >Review →</button>
    </div>
  )
}

export default function Dashboard() {
  const [detections, setDetections] = useState([])
  const [loading, setLoading]       = useState(false)
  const [tab, setTab]               = useState('attention')

  const fetchDetections = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/detect/log', { params: { limit: 500 } })
      setDetections(res.data.detections || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchDetections() }, [])

  const now       = new Date()
  const hour      = now.getHours()
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr   = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })

  const totalDetections = detections.length
  const classFreq = detections.reduce((acc, d) => { acc[d.class_name] = (acc[d.class_name] || 0) + 1; return acc }, {})
  const classData = Object.entries(classFreq).sort((a,b) => b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}))
  const uniqueClasses = Object.keys(classFreq).length
  const avgConf = detections.length
    ? (detections.reduce((s,d) => s + d.confidence, 0) / detections.length * 100).toFixed(1)
    : 0
  const alerts = detections.filter(d => d.activity_label?.includes('🚨') || d.activity_label?.includes('Speeding') || d.activity_label?.includes('Parked'))
  const highConf = detections.filter(d => d.confidence >= 0.8).length
  const sourceFreq = detections.reduce((acc,d) => { acc[d.source]=(acc[d.source]||0)+1; return acc },{})
  const sourceData = Object.entries(sourceFreq).map(([name,value])=>({name,value}))

  const timeData = detections.reduce((acc,d) => {
    if (!d.timestamp) return acc
    const min = d.timestamp.slice(0,16)
    acc[min] = (acc[min]||0)+1
    return acc
  }, {})
  const timeChartData = Object.entries(timeData).sort().slice(-15).map(([time,count])=>({time:time.slice(11),count}))

  const exportCSV = () => {
    const headers = ['id','timestamp','source','class_name','confidence','activity_label']
    const rows = detections.map(d => headers.map(h => JSON.stringify(d[h]??'')).join(','))
    const blob = new Blob([[headers.join(','),...rows].join('\n')],{type:'text/csv'})
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download='detections.csv'; a.click()
  }

  const tooltipStyle = { background: '#1e160a', border: '1px solid #2a1d10', borderRadius: 10, color: '#fef3c7', fontSize: 12 }

  return (
    <div style={{ background: '#090603', minHeight: '100vh' }}>
      {/* ── Header greeting bar ── */}
      <div style={{ background: '#120d06', borderBottom: '1px solid #2a1d10' }} className="px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="amber-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display:'inline-block' }} />
              <p style={{ color: '#92400e' }} className="text-xs font-medium">
                YOLOv8s · CUDA active · 56.01% mAP · {uniqueClasses} classes
              </p>
            </div>
            <h1 style={{ color: '#fef3c7' }} className="text-xl font-bold">{greeting}, Amartya</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchDetections}
              style={{ background: '#1e160a', border: '1px solid #2a1d10', color: '#b45309', borderRadius: 9 }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 hover:border-amber-600 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button onClick={exportCSV}
              style={{ background: `${AMBER_D}`, color: '#090603', borderRadius: 9, fontWeight: 700 }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 hover:opacity-90 transition-opacity">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
            <div style={{ color: '#b45309', fontFamily: 'monospace', fontSize: 13 }}>{dateStr}</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-5 gap-4">
          <StatCard label="Total Detections" value={totalDetections} icon={Target}   accent={AMBER}     sub="all time" />
          <StatCard label="High Confidence"  value={highConf}        icon={Zap}      accent="#10b981"   sub="≥ 80% conf" />
          <StatCard label="Active Alerts"    value={alerts.length}   icon={Bell}     accent="#ef4444"   sub="speeding + parked" />
          <StatCard label="Avg Confidence"   value={`${avgConf}%`}   icon={TrendingUp} accent="#3b82f6" sub="across all detections" />
          <StatCard label="Model"            value="YOLOv8s"         icon={Cpu}      accent="#8b5cf6"   sub="56.01% mAP@0.5" />
        </div>

        {/* ── Tabs ── */}
        <div style={{ borderBottom: '1px solid #2a1d10' }} className="flex items-center gap-0">
          {[['attention','🔔 Attention'],['figures','📊 Figures']].map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{
                color: tab === key ? AMBER : '#92400e',
                borderBottom: tab === key ? `2px solid ${AMBER}` : '2px solid transparent',
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                background: 'none',
                transition: 'all 0.15s',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── ATTENTION TAB ── */}
        {tab === 'attention' && (
          <div className="grid grid-cols-3 gap-5">
            {/* Needs attention */}
            <div className="col-span-2 space-y-3">
              {/* Critical section */}
              <div style={WARM_CARD} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid #2a1d10' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ background:'#ef444420', color:'#ef4444', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
                      CRITICAL
                    </span>
                    <span style={{ color:'#92400e', fontSize:12 }}>Needs your attention</span>
                  </div>
                  <span style={{ background: '#ef444420', color:'#ef4444', borderRadius:99, fontSize:11, fontWeight:700, padding:'2px 10px' }}>
                    {Math.max(0, alerts.length)} items
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  {alerts.length === 0 ? (
                    <div className="py-8 text-center">
                      <p style={{ color: '#92400e' }} className="text-sm">✅ No critical alerts right now</p>
                      <p style={{ color: '#78350f' }} className="text-xs mt-1">Run the Live Stream to detect vehicles</p>
                    </div>
                  ) : (
                    alerts.slice(0,5).map((d,i) => (
                      <AlertCard key={i}
                        title={`${d.class_name} — ${d.activity_label}`}
                        detail={`Confidence: ${(d.confidence*100).toFixed(0)}% · Source: ${d.source}`}
                        count={1} severity="critical"
                        time={d.timestamp?.slice(11,19) || '—'} />
                    ))
                  )}
                </div>
              </div>

              {/* Warning section */}
              <div style={WARM_CARD} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: '1px solid #2a1d10' }}>
                  <div className="flex items-center gap-2">
                    <span style={{ background:`${AMBER}20`, color:AMBER, borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
                      RECENT
                    </span>
                    <span style={{ color:'#92400e', fontSize:12 }}>High-confidence detections</span>
                  </div>
                  <span style={{ background:`${AMBER}20`, color:AMBER, borderRadius:99, fontSize:11, fontWeight:700, padding:'2px 10px' }}>
                    {highConf}
                  </span>
                </div>
                <div className="p-3 space-y-2">
                  {detections.filter(d=>d.confidence>=0.8).slice(0,4).map((d,i) => (
                    <div key={i} style={WARM_INNER} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize:20 }}>
                          {d.class_name==='car'?'🚗':d.class_name==='truck'?'🚛':d.class_name==='pedestrian'||d.class_name==='person'?'🧍':d.class_name==='bus'?'🚌':'📦'}
                        </span>
                        <div>
                          <p style={{ color:'#fef3c7' }} className="text-sm font-semibold capitalize">{d.class_name}</p>
                          <p style={{ color:'#92400e' }} className="text-xs">{d.source} · {d.timestamp?.slice(11,19)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {d.activity_label && (
                          <span style={{ background:'#2a1d10', color:'#b45309', borderRadius:6, fontSize:11 }} className="px-2 py-0.5">{d.activity_label}</span>
                        )}
                        <span style={{ color:'#10b981', fontWeight:700, fontSize:13 }}>{(d.confidence*100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                  {detections.filter(d=>d.confidence>=0.8).length === 0 && (
                    <p style={{ color:'#78350f' }} className="text-xs text-center py-4">No detections yet — upload an image or start live stream</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right column — quick stats + source breakdown */}
            <div className="space-y-4">
              {/* Model status card */}
              <div style={WARM_CARD} className="p-4">
                <p style={{ color:'#92400e' }} className="text-xs font-semibold uppercase tracking-wider mb-3">System Status</p>
                {[
                  { label: 'Model',       val: 'YOLOv8s VisDrone', ok: true },
                  { label: 'GPU',         val: 'CUDA Active',       ok: true },
                  { label: 'mAP@0.5',     val: '56.01%',            ok: true },
                  { label: 'Classes',     val: '10 (VisDrone)',     ok: true },
                  { label: 'API Status',  val: 'Running :8000',     ok: true },
                  { label: 'Tests',       val: '51 / 51 passing',   ok: true },
                ].map(({ label, val, ok }) => (
                  <div key={label} className="flex items-center justify-between py-2"
                    style={{ borderBottom: '1px solid #2a1d10' }}>
                    <span style={{ color:'#92400e' }} className="text-xs">{label}</span>
                    <div className="flex items-center gap-1.5">
                      <span style={{ width:6, height:6, borderRadius:'50%', background: ok?'#10b981':'#ef4444', display:'inline-block' }} />
                      <span style={{ color:'#fef3c7' }} className="text-xs font-medium">{val}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Source pie */}
              <div style={WARM_CARD} className="p-4">
                <p style={{ color:'#92400e' }} className="text-xs font-semibold uppercase tracking-wider mb-2">Detection Sources</p>
                {sourceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" outerRadius={55} dataKey="value"
                        label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}
                        style={{ fontSize: 10, fill: '#b45309' }}>
                        {sourceData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p style={{ color:'#78350f' }} className="text-xs text-center py-8">No data yet</p>
                )}
              </div>

              {/* Top class */}
              {classData[0] && (
                <div style={{ ...WARM_CARD, background: `${AMBER}12`, border:`1px solid ${AMBER}30` }} className="p-4">
                  <p style={{ color: AMBER_D }} className="text-xs font-semibold uppercase tracking-wider mb-2">Most Detected</p>
                  <p style={{ color:'#fef3c7' }} className="text-2xl font-bold capitalize">{classData[0].name}</p>
                  <p style={{ color: AMBER_D }} className="text-sm">{classData[0].count} detections</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FIGURES TAB ── */}
        {tab === 'figures' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-5">
              {/* Bar chart */}
              <div style={WARM_CARD} className="p-5">
                <p style={{ color:'#fef3c7' }} className="text-sm font-semibold mb-4">Top Detected Classes</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={classData} margin={{ top:0, right:10, left:-10, bottom:40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a1d10" />
                    <XAxis dataKey="name" tick={{ fill:'#92400e', fontSize:10 }} angle={-35} textAnchor="end" />
                    <YAxis tick={{ fill:'#92400e', fontSize:10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill={AMBER} radius={[5,5,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line chart */}
              <div style={WARM_CARD} className="p-5">
                <p style={{ color:'#fef3c7' }} className="text-sm font-semibold mb-4">Detections Over Time</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={timeChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a1d10" />
                    <XAxis dataKey="time" tick={{ fill:'#92400e', fontSize:10 }} />
                    <YAxis tick={{ fill:'#92400e', fontSize:10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="count" stroke={AMBER} strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Detection table */}
            <div style={WARM_CARD} className="overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid #2a1d10' }}>
                <p style={{ color:'#fef3c7' }} className="text-sm font-semibold">All Detections</p>
                <span style={{ background:`${AMBER}20`, color:AMBER, borderRadius:99, fontSize:11, fontWeight:700, padding:'2px 10px' }}>
                  {totalDetections} total
                </span>
              </div>
              <div className="overflow-y-auto max-h-64 scrollbar-thin">
                <table className="w-full text-xs">
                  <thead style={{ background:'#1e160a' }} className="sticky top-0">
                    <tr style={{ color:'#92400e' }} className="text-left">
                      <th className="px-4 py-2">Class</th>
                      <th className="px-4 py-2">Confidence</th>
                      <th className="px-4 py-2">Activity</th>
                      <th className="px-4 py-2">Source</th>
                      <th className="px-4 py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detections.slice(0,50).map((d,i) => (
                      <tr key={i} style={{ borderTop:'1px solid #2a1d10' }}
                        className="hover:bg-opacity-50 transition-colors"
                        onMouseEnter={e=>e.currentTarget.style.background='#1e160a'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td className="px-4 py-1.5" style={{ color:'#fef3c7', fontWeight:600 }}>{d.class_name}</td>
                        <td className="px-4 py-1.5" style={{ color: d.confidence>=0.7?'#10b981':d.confidence>=0.5?AMBER:'#ef4444', fontWeight:700 }}>
                          {(d.confidence*100).toFixed(0)}%
                        </td>
                        <td className="px-4 py-1.5" style={{ color:'#b45309' }}>{d.activity_label||'—'}</td>
                        <td className="px-4 py-1.5" style={{ color:'#78350f' }}>{d.source}</td>
                        <td className="px-4 py-1.5" style={{ color:'#78350f', fontFamily:'monospace' }}>{d.timestamp?.slice(11,19)||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detections.length===0 && (
                  <p style={{ color:'#78350f' }} className="text-center py-10 text-xs">No detections yet — upload an image or run live stream</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
