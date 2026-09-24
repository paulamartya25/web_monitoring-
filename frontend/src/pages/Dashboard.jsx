import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Download, RefreshCw, Bell, Cpu, Zap, Target, AlertTriangle, TrendingUp, Shield, Eye, Radio } from 'lucide-react'

/* ─── palette ─────────────────────────────────────────────── */
const BLUE   = '#3b82f6'
const CYAN   = '#06b6d4'
const PURPLE = '#8b5cf6'
const GREEN  = '#10b981'
const RED    = '#ef4444'
const COLORS = [BLUE, CYAN, PURPLE, '#f59e0b', RED, '#ec4899', GREEN, '#f97316', '#84cc16', '#06b6d4']

/* ─── shared card styles — VIVID GLASS ─────────────────────── */
const card = (glowColor = BLUE) => ({
  background:     'rgba(2,2,10,0.42)',
  backdropFilter: 'blur(22px)',
  WebkitBackdropFilter: 'blur(22px)',
  border:         '1px solid rgba(255,255,255,0.10)',
  borderRadius:   16,
  position:       'relative',
  overflow:       'hidden',
  transition:     'transform 0.25s, box-shadow 0.25s, border-color 0.25s',
})

const hoverCard = (el, glowColor = BLUE) => {
  el.style.transform   = 'translateY(-4px) scale(1.015)'
  el.style.boxShadow   = `0 12px 50px rgba(0,0,0,0.7), 0 0 40px ${glowColor}40`

  el.style.borderColor = `${glowColor}55`
}
const leaveCard = (el) => {
  el.style.transform   = ''
  el.style.boxShadow   = ''
  el.style.borderColor = 'rgba(59,130,246,0.18)'
}

const tooltip = { background:'#060c1a', border:'1px solid rgba(59,130,246,0.25)', borderRadius:10, color:'#e2e8f0', fontSize:12 }

/* ─── animated counter ─────────────────────────────────────── */
function useCount(target, duration = 1100) {
  const [val, setVal] = useState(0)
  const prevRef = useRef(0)
  useEffect(() => {
    const end = parseFloat(target) || 0
    const start = prevRef.current
    const t0 = performance.now()
    const tick = now => {
      const p = Math.min((now - t0) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3)
      setVal(start + (end - start) * ease)
      if (p < 1) requestAnimationFrame(tick)
      else { prevRef.current = end; setVal(end) }
    }
    requestAnimationFrame(tick)
  }, [target])
  return val
}

/* ─── typewriter ───────────────────────────────────────────── */
function useTypewriter(text, speed = 40) {
  const [out, setOut] = useState('')
  useEffect(() => {
    let i = 0; setOut('')
    const id = setInterval(() => { i++; setOut(text.slice(0, i)); if (i >= text.length) clearInterval(id) }, speed)
    return () => clearInterval(id)
  }, [text])
  return out
}

/* ─── stat card ────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, color, sub, delay = 0 }) {
  const numVal  = parseFloat(value) || 0
  const isFloat = String(value).includes('.')
  const counted = useCount(numVal)
  const suffix  = typeof value === 'string' ? value.replace(/[\d.]/g, '') : ''

  return (
    <div style={{ ...card(color), padding: '18px 20px', animation: `fadeInUp 0.5s ease ${delay}s both` }}
      onMouseEnter={e => hoverCard(e.currentTarget, color)}
      onMouseLeave={e => leaveCard(e.currentTarget)}>

      {/* Corner orb */}
      <div style={{
        position:'absolute', top:-30, right:-30,
        width:90, height:90, borderRadius:'50%',
        background:`radial-gradient(circle, ${color}22 0%, transparent 70%)`,
        pointerEvents:'none',
      }}/>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <span style={{ color:'#334155', fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>
          {label}
        </span>
        <div style={{ background:`${color}18`, borderRadius:9, padding:'6px 8px', boxShadow:`0 0 14px ${color}35` }}>
          <Icon style={{ color, width:15, height:15 }} />
        </div>
      </div>

      <div style={{
        color:'#e2e8f0', fontWeight:800, fontSize:34, lineHeight:1,
        fontVariantNumeric:'tabular-nums', letterSpacing:'-1.5px',
        background:`linear-gradient(135deg, #e2e8f0, ${color})`,
        WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
      }}>
        {isFloat ? counted.toFixed(1) : Math.round(counted)}{suffix}
      </div>

      {sub && <div style={{ color:'#334155', fontSize:11, marginTop:7 }}>{sub}</div>}

      {/* Shimmer sweep */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0, height:2,
        background:`linear-gradient(90deg, transparent, ${color}80, transparent)`,
        animation:'shimmerLine 2.8s ease-in-out infinite',
      }}/>
    </div>
  )
}

/* ─── alert card ───────────────────────────────────────────── */
function AlertCard({ title, detail, count, color = RED, time }) {
  return (
    <div style={{
      background:'rgba(6,12,26,0.7)', backdropFilter:'blur(8px)',
      border:`1px solid ${color}25`, borderRadius:12,
      padding:'12px 14px', display:'flex', alignItems:'flex-start', gap:12,
      transition:'all 0.2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.background=`${color}08`; e.currentTarget.style.borderColor=`${color}45` }}
      onMouseLeave={e => { e.currentTarget.style.background='rgba(6,12,26,0.7)'; e.currentTarget.style.borderColor=`${color}25` }}>
      <div style={{ background:`${color}18`, borderRadius:9, padding:7, flexShrink:0 }}>
        <AlertTriangle style={{ color, width:14, height:14 }} />
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ color:'#e2e8f0', fontSize:13, fontWeight:600, marginBottom:3 }}>{title}</p>
        <p style={{ color:'#334155', fontSize:11 }}>{detail}</p>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
          <span style={{ background:`${color}18`, color, borderRadius:99, fontSize:10, fontWeight:700, padding:'2px 8px' }}>
            {count} detected
          </span>
          <span style={{ color:'#1e3a5f', fontSize:11, fontFamily:'monospace' }}>{time}</span>
        </div>
      </div>
      <button style={{
        background:`linear-gradient(135deg,${color === RED ? '#dc2626' : BLUE},${color === RED ? RED : CYAN})`,
        color:'#fff', borderRadius:8, fontSize:11, fontWeight:800, padding:'6px 12px', flexShrink:0,
        boxShadow:`0 0 12px ${color}40`, transition:'all 0.2s',
      }}
        onMouseEnter={e => { e.currentTarget.style.transform='scale(1.06)'; e.currentTarget.style.boxShadow=`0 0 22px ${color}65` }}
        onMouseLeave={e => { e.currentTarget.style.transform=''; e.currentTarget.style.boxShadow=`0 0 12px ${color}40` }}>
        Review →
      </button>
    </div>
  )
}

/* ─── status row item ──────────────────────────────────────── */
function StatusRow({ label, val, ok, delay = 0 }) {
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'9px 0', borderBottom:'1px solid rgba(30,58,95,0.5)',
      animation:`fadeInUp 0.3s ease ${delay}s both`,
    }}>
      <span style={{ color:'#334155', fontSize:11 }}>{label}</span>
      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
        <span style={{
          width:7, height:7, borderRadius:'50%', display:'inline-block',
          background: ok ? GREEN : RED,
          boxShadow: ok ? `0 0 8px ${GREEN}` : `0 0 8px ${RED}`,
        }}/>
        <span style={{ color:'#94a3b8', fontSize:11, fontWeight:600 }}>{val}</span>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [detections, setDetections] = useState([])
  const [loading,    setLoading]    = useState(false)
  const [tab,        setTab]        = useState('attention')

  const load = async () => {
    setLoading(true)
    try { const r = await axios.get('/detect/log',{params:{limit:500}}); setDetections(r.data.detections||[]) }
    catch {}
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const now     = new Date()
  const h       = now.getHours()
  const greet   = useTypewriter(`${h<12?'Good morning':h<17?'Good afternoon':'Good evening'}, Amartya`, 36)
  const dateStr = now.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})

  /* stats */
  const total      = detections.length
  const classFreq  = detections.reduce((a,d)=>{a[d.class_name]=(a[d.class_name]||0)+1;return a},{})
  const classData  = Object.entries(classFreq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}))
  const uniq       = Object.keys(classFreq).length
  const avgConf    = detections.length ? (detections.reduce((s,d)=>s+d.confidence,0)/detections.length*100).toFixed(1) : 0
  const alerts     = detections.filter(d=>d.activity_label?.includes('🚨')||d.activity_label?.includes('Speeding'))
  const highConf   = detections.filter(d=>d.confidence>=0.8).length
  const srcFreq    = detections.reduce((a,d)=>{a[d.source]=(a[d.source]||0)+1;return a},{})
  const srcData    = Object.entries(srcFreq).map(([name,value])=>({name,value}))
  const timeMap    = detections.reduce((a,d)=>{if(!d.timestamp)return a;const m=d.timestamp.slice(0,16);a[m]=(a[m]||0)+1;return a},{})
  const timeChart  = Object.entries(timeMap).sort().slice(-15).map(([time,count])=>({time:time.slice(11),count}))

  const exportCSV = () => {
    const cols = ['id','timestamp','source','class_name','confidence','activity_label']
    const blob = new Blob([[cols.join(','),...detections.map(d=>cols.map(k=>JSON.stringify(d[k]??'')).join(','))].join('\n')],{type:'text/csv'})
    Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'detections.csv'}).click()
  }

  return (
    <div style={{ background:'transparent', minHeight:'100vh', position:'relative' }}>

      {/* ── Header ─────────────────────────────────────────── */}
      <div style={{
        background:'rgba(4,4,14,0.45)',
        backdropFilter:'blur(16px)', WebkitBackdropFilter:'blur(16px)',
        borderBottom:'1px solid rgba(255,255,255,0.07)',
        padding:'14px 0', position:'relative', overflow:'hidden',
      }}>
        {/* Animated scan line */}
        <div style={{
          position:'absolute', top:0, left:0, right:0, height:1.5,
          background:'linear-gradient(90deg,transparent,rgba(59,130,246,0.9),rgba(6,182,212,0.9),rgba(139,92,246,0.9),transparent)',
          animation:'scanLine 4s ease-in-out infinite',
        }}/>

        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div>
            {/* System status row */}
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
              <span className="blue-pulse" style={{
                width:8, height:8, borderRadius:'50%', background:GREEN,
                display:'inline-block', boxShadow:`0 0 8px ${GREEN}`,
              }}/>
              <p style={{ color:'#334155', fontSize:11, fontFamily:'monospace', letterSpacing:'0.05em' }}>
                SYSTEM ONLINE · YOLOV8S · {uniq} CLASSES · 56.01% MAP · {total} DETECTIONS
              </p>
            </div>

            {/* Typewriter greeting */}
            <h1 style={{
              fontWeight:800, fontSize:23, minHeight:34,
              background:'linear-gradient(90deg,#e2e8f0,#60a5fa,#06b6d4)',
              backgroundSize:'200% 200%', animation:'gradientShift 5s ease infinite',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
            }}>
              {greet}
              <span style={{ animation:'blink 1s step-end infinite', color:'#60a5fa', WebkitTextFillColor:'#60a5fa' }}>|</span>
            </h1>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <button onClick={load} style={{
              background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.25)',
              color:'#60a5fa', borderRadius:10, fontSize:12, fontWeight:600,
              padding:'7px 14px', display:'flex', alignItems:'center', gap:6,
              transition:'all 0.2s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(59,130,246,0.18)';e.currentTarget.style.borderColor='rgba(59,130,246,0.5)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(59,130,246,0.08)';e.currentTarget.style.borderColor='rgba(59,130,246,0.25)'}}>
              <RefreshCw style={{width:13,height:13}} className={loading?'animate-spin':''}/> Refresh
            </button>

            <button onClick={exportCSV} style={{
              background:'linear-gradient(135deg,#2563eb,#06b6d4)',
              color:'#fff', borderRadius:10, fontSize:12, fontWeight:800,
              padding:'7px 16px', display:'flex', alignItems:'center', gap:6,
              boxShadow:`0 0 18px rgba(59,130,246,0.4)`,
              transition:'all 0.2s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.04)';e.currentTarget.style.boxShadow='0 0 28px rgba(59,130,246,0.65)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='0 0 18px rgba(59,130,246,0.4)'}}>
              <Download style={{width:13,height:13}}/> Export CSV
            </button>

            <div style={{
              color:'#334155', fontFamily:'monospace', fontSize:12,
              background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.18)',
              borderRadius:8, padding:'6px 12px',
            }}>{dateStr}</div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5" style={{ display:'flex', flexDirection:'column', gap:20 }}>

        {/* ── Stat cards ─────────────────────────────────────── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:16 }}>
          <StatCard label="Total Detections" value={total}          icon={Target}   color={BLUE}   sub="all sources"        delay={0.05}/>
          <StatCard label="High Confidence"  value={highConf}       icon={Zap}      color={GREEN}  sub="≥ 80% conf"         delay={0.12}/>
          <StatCard label="Active Alerts"    value={alerts.length}  icon={Shield}   color={RED}    sub="speeding + parked"  delay={0.19}/>
          <StatCard label="Avg Confidence"   value={parseFloat(avgConf)} icon={TrendingUp} color={CYAN} sub="all detections" delay={0.26}/>
          <StatCard label="Object Classes"   value={uniq}           icon={Eye}      color={PURPLE} sub="distinct types"     delay={0.33}/>
        </div>

        {/* ── Tabs ───────────────────────────────────────────── */}
        <div style={{ display:'flex', borderBottom:'1px solid rgba(59,130,246,0.15)' }}>
          {[['attention','🔔  Attention'],['figures','📊  Figures']].map(([key,lbl])=>(
            <button key={key} onClick={()=>setTab(key)} style={{
              color: tab===key ? BLUE : '#334155',
              borderBottom: tab===key ? `2px solid ${BLUE}` : '2px solid transparent',
              marginBottom:-1, padding:'8px 22px',
              fontSize:13, fontWeight:700,
              background:'none', transition:'all 0.2s',
              boxShadow: tab===key ? `0 6px 20px rgba(59,130,246,0.15)` : 'none',
            }}>{lbl}</button>
          ))}
        </div>

        {/* ── ATTENTION ──────────────────────────────────────── */}
        {tab==='attention' && (
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:20, animation:'fadeInUp 0.4s ease both' }}>

            {/* Left */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* Critical */}
              <div style={{ ...card(RED), padding:0 }}>
                <div style={{
                  padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between',
                  borderBottom:`1px solid ${RED}18`, background:'rgba(239,68,68,0.04)',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ background:`${RED}20`, color:RED, borderRadius:6, padding:'2px 10px', fontSize:10, fontWeight:800, letterSpacing:'0.08em' }}>CRITICAL</span>
                    <span style={{ color:'#334155', fontSize:12 }}>Needs immediate attention</span>
                  </div>
                  <span style={{ background:`${RED}20`, color:RED, borderRadius:99, fontSize:11, fontWeight:700, padding:'2px 10px', boxShadow:`0 0 10px ${RED}30` }}>
                    {alerts.length} items
                  </span>
                </div>
                <div style={{ padding:14, display:'flex', flexDirection:'column', gap:8 }}>
                  {alerts.length===0 ? (
                    <div style={{ padding:'28px 0', textAlign:'center' }}>
                      <p style={{ fontSize:30, marginBottom:8 }}>✅</p>
                      <p style={{ color:'#334155', fontSize:13 }}>No critical alerts right now</p>
                      <p style={{ color:'#1e3a5f', fontSize:11, marginTop:4 }}>Start Live Stream to begin monitoring</p>
                    </div>
                  ) : alerts.slice(0,4).map((d,i)=>(
                    <AlertCard key={i}
                      title={`${d.class_name} — ${d.activity_label}`}
                      detail={`Confidence: ${(d.confidence*100).toFixed(0)}% · Source: ${d.source}`}
                      count={1} color={RED} time={d.timestamp?.slice(11,19)||'—'} />
                  ))}
                </div>
              </div>

              {/* High confidence feed */}
              <div style={{ ...card(BLUE), padding:0 }}>
                <div style={{
                  padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between',
                  borderBottom:`1px solid ${BLUE}18`, background:`rgba(59,130,246,0.03)`,
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ background:`${BLUE}20`, color:BLUE, borderRadius:6, padding:'2px 10px', fontSize:10, fontWeight:800, letterSpacing:'0.08em' }}>RECENT</span>
                    <span style={{ color:'#334155', fontSize:12 }}>High-confidence detections</span>
                  </div>
                  <span style={{ background:`${BLUE}20`, color:BLUE, borderRadius:99, fontSize:11, fontWeight:700, padding:'2px 10px' }}>
                    {highConf}
                  </span>
                </div>
                <div style={{ padding:14, display:'flex', flexDirection:'column', gap:8 }}>
                  {detections.filter(d=>d.confidence>=0.8).slice(0,4).map((d,i)=>(
                    <div key={i} style={{
                      background:'rgba(10,18,40,0.6)', border:`1px solid ${BLUE}15`,
                      borderRadius:10, padding:'10px 14px',
                      display:'flex', alignItems:'center', justifyContent:'space-between',
                      transition:'all 0.2s',
                    }}
                      onMouseEnter={e=>{e.currentTarget.style.background=`${BLUE}08`;e.currentTarget.style.borderColor=`${BLUE}35`}}
                      onMouseLeave={e=>{e.currentTarget.style.background='rgba(10,18,40,0.6)';e.currentTarget.style.borderColor=`${BLUE}15`}}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <span style={{ fontSize:22 }}>
                          {d.class_name==='car'?'🚗':d.class_name==='truck'?'🚛':d.class_name==='person'||d.class_name==='pedestrian'?'🧍':d.class_name==='bus'?'🚌':d.class_name==='bicycle'?'🚲':'📦'}
                        </span>
                        <div>
                          <p style={{ color:'#e2e8f0', fontSize:13, fontWeight:600, textTransform:'capitalize' }}>{d.class_name}</p>
                          <p style={{ color:'#334155', fontSize:11 }}>{d.source} · {d.timestamp?.slice(11,19)}</p>
                        </div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        {d.activity_label && (
                          <span style={{ background:'rgba(30,58,95,0.8)', color:'#60a5fa', borderRadius:6, fontSize:10, padding:'2px 8px' }}>
                            {d.activity_label}
                          </span>
                        )}
                        <span style={{ color:GREEN, fontWeight:800, fontSize:13, fontFamily:'monospace' }}>
                          {(d.confidence*100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {detections.filter(d=>d.confidence>=0.8).length===0 && (
                    <p style={{ color:'#1e3a5f', textAlign:'center', padding:'22px 0', fontSize:12 }}>
                      No high-confidence detections yet
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

              {/* System status */}
              <div style={{ ...card(BLUE), padding:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                  <Radio style={{ color:CYAN, width:14, height:14 }} />
                  <p style={{ color:'#334155', fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>System Status</p>
                </div>
                {[
                  {label:'Model',      val:'YOLOv8s VisDrone', ok:true},
                  {label:'Inference',  val:'CUDA / GPU',       ok:true},
                  {label:'mAP@0.5',   val:'56.01%',           ok:true},
                  {label:'Classes',   val:'10 VisDrone',      ok:true},
                  {label:'API',       val:'Running :8000',    ok:true},
                  {label:'Tests',     val:'51 / 51 ✅',       ok:true},
                ].map(({label,val,ok},i)=>(
                  <StatusRow key={label} label={label} val={val} ok={ok} delay={i*0.05}/>
                ))}
              </div>

              {/* Source pie */}
              <div style={{ ...card(CYAN), padding:20 }}>
                <p style={{ color:'#334155', fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>
                  Detection Sources
                </p>
                {srcData.length>0 ? (
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={srcData} cx="50%" cy="50%" outerRadius={52} dataKey="value"
                        label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}
                        style={{fontSize:9,fill:'#60a5fa'}}>
                        {srcData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip contentStyle={tooltip}/>
                    </PieChart>
                  </ResponsiveContainer>
                ):(
                  <p style={{color:'#1e3a5f',textAlign:'center',padding:'22px 0',fontSize:11}}>No data yet</p>
                )}
              </div>

              {/* Top detected highlight */}
              {classData[0] && (
                <div style={{
                  background:'linear-gradient(135deg,rgba(59,130,246,0.14),rgba(6,182,212,0.07))',
                  border:`1px solid ${BLUE}35`, borderRadius:16, padding:20,
                  boxShadow:`0 0 24px rgba(59,130,246,0.12)`,
                }}>
                  <p style={{ color:CYAN, fontSize:10, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:8 }}>
                    🏆 Most Detected
                  </p>
                  <p style={{
                    fontWeight:800, fontSize:26, textTransform:'capitalize',
                    background:'linear-gradient(90deg,#e2e8f0,#60a5fa)',
                    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  }}>{classData[0].name}</p>
                  <p style={{ color:CYAN, fontSize:13, marginTop:4 }}>
                    {classData[0].count} total detections
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FIGURES ────────────────────────────────────────── */}
        {tab==='figures' && (
          <div style={{ display:'flex', flexDirection:'column', gap:18, animation:'fadeInUp 0.4s ease both' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
              {[
                { title:'Top Detected Classes', chart:(
                  <BarChart data={classData} margin={{top:0,right:10,left:-10,bottom:40}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.6)"/>
                    <XAxis dataKey="name" tick={{fill:'#334155',fontSize:10}} angle={-35} textAnchor="end"/>
                    <YAxis tick={{fill:'#334155',fontSize:10}}/>
                    <Tooltip contentStyle={tooltip}/>
                    <Bar dataKey="count" fill={BLUE} radius={[6,6,0,0]}/>
                  </BarChart>
                )},
                { title:'Detections Over Time', chart:(
                  <LineChart data={timeChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,58,95,0.6)"/>
                    <XAxis dataKey="time" tick={{fill:'#334155',fontSize:10}}/>
                    <YAxis tick={{fill:'#334155',fontSize:10}}/>
                    <Tooltip contentStyle={tooltip}/>
                    <Line type="monotone" dataKey="count" stroke={CYAN} strokeWidth={2.5} dot={false}/>
                  </LineChart>
                )},
              ].map(({title,chart})=>(
                <div key={title} style={{...card(BLUE),padding:22}}
                  onMouseEnter={e=>hoverCard(e.currentTarget,CYAN)}
                  onMouseLeave={e=>leaveCard(e.currentTarget)}>
                  <p style={{color:'#e2e8f0',fontSize:13,fontWeight:700,marginBottom:16}}>{title}</p>
                  <ResponsiveContainer width="100%" height={210}>{chart}</ResponsiveContainer>
                </div>
              ))}
            </div>

            {/* Detection table */}
            <div style={{...card(BLUE),padding:0}}>
              <div style={{
                padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',
                borderBottom:`1px solid ${BLUE}18`, background:`rgba(59,130,246,0.03)`,
              }}>
                <p style={{color:'#e2e8f0',fontSize:13,fontWeight:700}}>All Detections</p>
                <span style={{background:`${BLUE}18`,color:BLUE,borderRadius:99,fontSize:11,fontWeight:700,padding:'2px 10px'}}>
                  {total} total
                </span>
              </div>
              <div className="scrollbar-thin" style={{overflowY:'auto',maxHeight:260}}>
                <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                  <thead style={{background:'rgba(10,18,40,0.9)',position:'sticky',top:0}}>
                    <tr style={{color:'#334155',textAlign:'left'}}>
                      {['Class','Confidence','Activity','Source','Time'].map(h=>(
                        <th key={h} style={{padding:'9px 16px',fontWeight:600,fontSize:10,textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detections.slice(0,50).map((d,i)=>(
                      <tr key={i} style={{borderTop:'1px solid rgba(30,58,95,0.5)',transition:'background 0.15s'}}
                        onMouseEnter={e=>e.currentTarget.style.background=`${BLUE}06`}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{padding:'8px 16px',color:'#e2e8f0',fontWeight:600,textTransform:'capitalize'}}>{d.class_name}</td>
                        <td style={{padding:'8px 16px',color:d.confidence>=0.7?GREEN:d.confidence>=0.5?'#f59e0b':RED,fontWeight:700,fontFamily:'monospace'}}>
                          {(d.confidence*100).toFixed(0)}%
                        </td>
                        <td style={{padding:'8px 16px',color:'#60a5fa'}}>{d.activity_label||'—'}</td>
                        <td style={{padding:'8px 16px',color:'#334155',textTransform:'capitalize'}}>{d.source}</td>
                        <td style={{padding:'8px 16px',color:'#1e3a5f',fontFamily:'monospace'}}>{d.timestamp?.slice(11,19)||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {total===0 && (
                  <p style={{color:'#1e3a5f',textAlign:'center',padding:'40px 0',fontSize:12}}>
                    No detections yet — upload an image or start live stream
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
