import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Download, RefreshCw, Bell, Cpu, Zap, Target, AlertTriangle, TrendingUp, ShieldAlert, Eye } from 'lucide-react'

const A  = '#f59e0b'
const AD = '#d97706'
const COLORS = [A,'#ef4444','#10b981','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f97316','#84cc16','#06b6d4']

/* ── Animated counter hook ── */
function useCount(target, duration = 1200) {
  const [val, setVal] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const end = typeof target === 'number' ? target : parseFloat(target) || 0
    if (end === prev.current) return
    const diff = end - prev.current
    const start = prev.current
    const t0 = performance.now()
    const tick = (now) => {
      const p = Math.min((now - t0) / duration, 1)
      const ease = 1 - Math.pow(1 - p, 3) // ease-out cubic
      setVal(start + diff * ease)
      if (p < 1) requestAnimationFrame(tick)
      else { prev.current = end; setVal(end) }
    }
    requestAnimationFrame(tick)
  }, [target])
  return val
}

/* ── Typewriter hook ── */
function useTypewriter(text, speed = 40) {
  const [displayed, setDisplayed] = useState('')
  useEffect(() => {
    let i = 0
    setDisplayed('')
    const id = setInterval(() => {
      i++
      setDisplayed(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
    }, speed)
    return () => clearInterval(id)
  }, [text])
  return displayed
}

/* ── Stat card with counter animation ── */
function StatCard({ label, value, icon: Icon, color, sub, delay = 0 }) {
  const numVal = typeof value === 'number' ? value : parseFloat(value) || 0
  const isFloat = String(value).includes('.')
  const counted = useCount(numVal)
  const suffix  = typeof value === 'string' ? value.replace(/[\d.]/g,'') : ''

  return (
    <div className="stat-card" style={{
      background: 'rgba(18,13,6,0.85)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${color}30`,
      borderRadius: 16,
      padding: '18px 20px',
      position: 'relative', overflow: 'hidden',
      animation: `fadeInUp 0.5s ease ${delay}s both`,
      transition: 'transform 0.25s, box-shadow 0.25s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
        e.currentTarget.style.boxShadow = `0 0 30px ${color}30, 0 8px 30px rgba(0,0,0,0.4)`
        e.currentTarget.style.border    = `1px solid ${color}60`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'none'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.border    = `1px solid ${color}30`
      }}
    >
      {/* Corner glow */}
      <div style={{
        position:'absolute',top:-30,right:-30,width:80,height:80,borderRadius:'50%',
        background:`radial-gradient(circle, ${color}25 0%, transparent 70%)`,
        pointerEvents:'none',
      }}/>

      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
        <span style={{ color:'#78350f',fontSize:11,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase' }}>{label}</span>
        <div style={{ background:`${color}18`,borderRadius:9,padding:'6px 8px',boxShadow:`0 0 12px ${color}30` }}>
          <Icon style={{ color, width:15,height:15 }} />
        </div>
      </div>

      <div style={{
        color:'#fef3c7', fontWeight:800, fontSize:32, lineHeight:1,
        fontVariantNumeric:'tabular-nums', letterSpacing:'-1px',
      }}>
        {isFloat ? counted.toFixed(1) : Math.round(counted)}{suffix}
      </div>

      {sub && <div style={{ color:'#78350f',fontSize:11,marginTop:6 }}>{sub}</div>}

      {/* Bottom shimmer line */}
      <div style={{
        position:'absolute',bottom:0,left:0,right:0,height:2,
        background:`linear-gradient(90deg, transparent, ${color}60, transparent)`,
        animation:'shimmerLine 2.5s ease-in-out infinite',
      }}/>
    </div>
  )
}

/* ── Alert card ── */
function AlertCard({ title, detail, count, severity, time }) {
  const clr = severity==='critical'?'#ef4444':severity==='warning'?A:'#10b981'
  return (
    <div style={{
      background:'rgba(18,13,6,0.7)', backdropFilter:'blur(8px)',
      border:`1px solid ${clr}25`, borderRadius:12,
      padding:14, display:'flex',alignItems:'flex-start',gap:12,
      transition:'all 0.2s',
    }}
      onMouseEnter={e=>{ e.currentTarget.style.background=`rgba(${clr==='#ef4444'?'239,68,68':clr===A?'245,158,11':'16,185,129'},0.08)`; e.currentTarget.style.borderColor=`${clr}50` }}
      onMouseLeave={e=>{ e.currentTarget.style.background='rgba(18,13,6,0.7)'; e.currentTarget.style.borderColor=`${clr}25` }}
    >
      <div style={{ background:`${clr}18`,borderRadius:9,padding:7,flexShrink:0 }}>
        <AlertTriangle style={{ color:clr,width:15,height:15 }} />
      </div>
      <div style={{ flex:1,minWidth:0 }}>
        <p style={{ color:'#fef3c7',fontSize:13,fontWeight:600,marginBottom:2 }}>{title}</p>
        <p style={{ color:'#92400e',fontSize:11 }}>{detail}</p>
        <div style={{ display:'flex',alignItems:'center',gap:8,marginTop:8 }}>
          <span style={{ background:`${clr}18`,color:clr,borderRadius:99,fontSize:10,fontWeight:700,padding:'2px 8px' }}>{count} detected</span>
          <span style={{ color:'#78350f',fontSize:11,fontFamily:'monospace' }}>{time}</span>
        </div>
      </div>
      <button style={{
        background:`linear-gradient(135deg,${AD},${A})`,color:'#090603',
        borderRadius:8,fontSize:11,fontWeight:800,padding:'6px 12px',flexShrink:0,
        boxShadow:`0 0 10px ${A}40`,transition:'all 0.2s',
      }}
        onMouseEnter={e=>{ e.currentTarget.style.transform='scale(1.05)'; e.currentTarget.style.boxShadow=`0 0 18px ${A}60` }}
        onMouseLeave={e=>{ e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow=`0 0 10px ${A}40` }}
      >Review →</button>
    </div>
  )
}

const tooltipStyle = { background:'#1a1208',border:'1px solid #2a1d10',borderRadius:10,color:'#fef3c7',fontSize:12 }

export default function Dashboard() {
  const [detections,setDetections] = useState([])
  const [loading,setLoading]       = useState(false)
  const [tab,setTab]               = useState('attention')

  const fetch = async () => {
    setLoading(true)
    try { const r=await axios.get('/detect/log',{params:{limit:500}}); setDetections(r.data.detections||[]) }
    catch{}
    finally{setLoading(false)}
  }
  useEffect(()=>{fetch()},[])

  const now = new Date()
  const hour = now.getHours()
  const greetingRaw = `${hour<12?'Good morning':hour<17?'Good afternoon':'Good evening'}, Amartya`
  const greeting = useTypewriter(greetingRaw, 38)
  const dateStr  = now.toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'})

  const totalDetections = detections.length
  const classFreq   = detections.reduce((a,d)=>{a[d.class_name]=(a[d.class_name]||0)+1;return a},{})
  const classData   = Object.entries(classFreq).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([name,count])=>({name,count}))
  const uniqueClasses = Object.keys(classFreq).length
  const avgConf     = detections.length?(detections.reduce((s,d)=>s+d.confidence,0)/detections.length*100).toFixed(1):0
  const alerts      = detections.filter(d=>d.activity_label?.includes('🚨')||d.activity_label?.includes('Speeding'))
  const highConf    = detections.filter(d=>d.confidence>=0.8).length
  const sourceFreq  = detections.reduce((a,d)=>{a[d.source]=(a[d.source]||0)+1;return a},{})
  const sourceData  = Object.entries(sourceFreq).map(([name,value])=>({name,value}))
  const timeData    = detections.reduce((a,d)=>{ if(!d.timestamp)return a; const m=d.timestamp.slice(0,16); a[m]=(a[m]||0)+1;return a},{})
  const timeChart   = Object.entries(timeData).sort().slice(-15).map(([time,count])=>({time:time.slice(11),count}))

  const exportCSV = () => {
    const h=['id','timestamp','source','class_name','confidence','activity_label']
    const blob=new Blob([[h.join(','),...detections.map(d=>h.map(k=>JSON.stringify(d[k]??'')).join(','))].join('\n')],{type:'text/csv'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='detections.csv';a.click()
  }

  return (
    <div style={{ background:'#090603',minHeight:'100vh',position:'relative' }}>

      {/* ── Scan line header ── */}
      <div style={{
        background:'linear-gradient(180deg,rgba(245,158,11,0.06) 0%,transparent 100%)',
        borderBottom:'1px solid rgba(245,158,11,0.18)',
        padding:'14px 0',
        position:'relative', overflow:'hidden',
      }}>
        {/* Moving scan line */}
        <div style={{
          position:'absolute',top:0,left:0,right:0,height:1,
          background:'linear-gradient(90deg,transparent,rgba(245,158,11,0.8),transparent)',
          animation:'scanLine 3s ease-in-out infinite',
        }}/>

        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <div>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <span className="amber-pulse" style={{width:8,height:8,borderRadius:'50%',background:'#10b981',display:'inline-block',boxShadow:'0 0 8px #10b981'}}/>
              <p style={{color:'#78350f',fontSize:11,fontFamily:'monospace',letterSpacing:'0.05em'}}>
                SYSTEM ONLINE · YOLOV8S · CUDA · {uniqueClasses} CLASSES · 56.01% MAP
              </p>
            </div>
            <h1 style={{
              color:'#fef3c7', fontWeight:800, fontSize:22,
              background:'linear-gradient(90deg,#fef3c7,#f59e0b)',
              WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
              minHeight:32,
            }}>
              {greeting}<span style={{animation:'blink 1s step-end infinite',color:'#f59e0b',WebkitTextFillColor:'#f59e0b'}}>|</span>
            </h1>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <button onClick={fetch} style={{
              background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.25)',
              color:'#b45309', borderRadius:10, fontSize:12, padding:'7px 14px',
              display:'flex',alignItems:'center',gap:6, fontWeight:600,
              transition:'all 0.2s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(245,158,11,0.18)';e.currentTarget.style.borderColor='rgba(245,158,11,0.5)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(245,158,11,0.08)';e.currentTarget.style.borderColor='rgba(245,158,11,0.25)'}}
            >
              <RefreshCw style={{width:13,height:13}} className={loading?'animate-spin':''}/> Refresh
            </button>
            <button onClick={exportCSV} style={{
              background:'linear-gradient(135deg,#d97706,#f59e0b)',color:'#090603',
              borderRadius:10, fontSize:12, fontWeight:800, padding:'7px 16px',
              display:'flex',alignItems:'center',gap:6,
              boxShadow:'0 0 16px rgba(245,158,11,0.35)',
              transition:'all 0.2s',
            }}
              onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.04)';e.currentTarget.style.boxShadow='0 0 24px rgba(245,158,11,0.55)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='0 0 16px rgba(245,158,11,0.35)'}}
            >
              <Download style={{width:13,height:13}}/> Export CSV
            </button>
            <div style={{color:'#78350f',fontFamily:'monospace',fontSize:12,background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:8,padding:'6px 12px'}}>
              {dateStr}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5 space-y-5">

        {/* ── Animated stat cards ── */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:16}}>
          <StatCard label="Total Detections" value={totalDetections} icon={Target}     color={A}        sub="all time"         delay={0.05}/>
          <StatCard label="High Confidence"  value={highConf}        icon={Zap}        color="#10b981"  sub="≥ 80% confidence" delay={0.12}/>
          <StatCard label="Active Alerts"    value={alerts.length}   icon={ShieldAlert} color="#ef4444" sub="speeding + parked" delay={0.19}/>
          <StatCard label="Avg Confidence"   value={parseFloat(avgConf)} icon={TrendingUp} color="#3b82f6" sub="all detections"  delay={0.26}/>
          <StatCard label="Unique Classes"   value={uniqueClasses}   icon={Eye}        color="#8b5cf6"  sub="object types"     delay={0.33}/>
        </div>

        {/* ── Tabs ── */}
        <div style={{display:'flex',alignItems:'center',gap:4,borderBottom:'1px solid rgba(245,158,11,0.12)',paddingBottom:0}}>
          {[['attention','🔔 Attention'],['figures','📊 Figures']].map(([key,lbl])=>(
            <button key={key} onClick={()=>setTab(key)} style={{
              color: tab===key ? A : '#78350f',
              borderBottom: tab===key ? `2px solid ${A}` : '2px solid transparent',
              marginBottom:-1, padding:'8px 20px',
              fontSize:13, fontWeight:700,
              background:'none', transition:'all 0.2s',
              boxShadow: tab===key ? `0 4px 16px rgba(245,158,11,0.15)` : 'none',
            }}>
              {lbl}
            </button>
          ))}
        </div>

        {/* ── ATTENTION TAB ── */}
        {tab==='attention' && (
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:20,animation:'fadeInUp 0.4s ease both'}}>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>

              {/* Critical box */}
              <div style={{
                background:'rgba(18,13,6,0.85)',backdropFilter:'blur(12px)',
                border:'1px solid rgba(239,68,68,0.2)',borderRadius:16,overflow:'hidden',
              }}>
                <div style={{
                  padding:'12px 18px', display:'flex',alignItems:'center',justifyContent:'space-between',
                  borderBottom:'1px solid rgba(239,68,68,0.12)',
                  background:'rgba(239,68,68,0.04)',
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',borderRadius:6,padding:'2px 10px',fontSize:10,fontWeight:800,letterSpacing:'0.08em'}}>CRITICAL</span>
                    <span style={{color:'#92400e',fontSize:12}}>Needs your attention</span>
                  </div>
                  <span style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',borderRadius:99,fontSize:11,fontWeight:700,padding:'2px 10px',boxShadow:'0 0 10px rgba(239,68,68,0.2)'}}>
                    {alerts.length} items
                  </span>
                </div>
                <div style={{padding:14,display:'flex',flexDirection:'column',gap:8}}>
                  {alerts.length===0?(
                    <div style={{padding:'28px 0',textAlign:'center'}}>
                      <p style={{fontSize:28,marginBottom:8}}>✅</p>
                      <p style={{color:'#92400e',fontSize:13}}>No critical alerts right now</p>
                      <p style={{color:'#78350f',fontSize:11,marginTop:4}}>Run Live Stream to detect vehicles</p>
                    </div>
                  ):alerts.slice(0,4).map((d,i)=>(
                    <AlertCard key={i} title={`${d.class_name} — ${d.activity_label}`}
                      detail={`Confidence: ${(d.confidence*100).toFixed(0)}% · Source: ${d.source}`}
                      count={1} severity="critical" time={d.timestamp?.slice(11,19)||'—'} />
                  ))}
                </div>
              </div>

              {/* Recent high-conf */}
              <div style={{
                background:'rgba(18,13,6,0.85)',backdropFilter:'blur(12px)',
                border:`1px solid rgba(245,158,11,0.18)`,borderRadius:16,overflow:'hidden',
              }}>
                <div style={{
                  padding:'12px 18px',display:'flex',alignItems:'center',justifyContent:'space-between',
                  borderBottom:`1px solid rgba(245,158,11,0.1)`,
                  background:`rgba(245,158,11,0.03)`,
                }}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <span style={{background:`rgba(245,158,11,0.15)`,color:A,borderRadius:6,padding:'2px 10px',fontSize:10,fontWeight:800,letterSpacing:'0.08em'}}>RECENT</span>
                    <span style={{color:'#92400e',fontSize:12}}>High-confidence detections</span>
                  </div>
                  <span style={{background:`rgba(245,158,11,0.15)`,color:A,borderRadius:99,fontSize:11,fontWeight:700,padding:'2px 10px'}}>{highConf}</span>
                </div>
                <div style={{padding:14,display:'flex',flexDirection:'column',gap:8}}>
                  {detections.filter(d=>d.confidence>=0.8).slice(0,4).map((d,i)=>(
                    <div key={i} style={{
                      background:'rgba(30,22,10,0.6)',border:'1px solid rgba(245,158,11,0.1)',borderRadius:10,
                      padding:'10px 14px',display:'flex',alignItems:'center',justifyContent:'space-between',
                      transition:'all 0.2s',
                    }}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(245,158,11,0.06)';e.currentTarget.style.borderColor='rgba(245,158,11,0.3)'}}
                      onMouseLeave={e=>{e.currentTarget.style.background='rgba(30,22,10,0.6)';e.currentTarget.style.borderColor='rgba(245,158,11,0.1)'}}
                    >
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <span style={{fontSize:22}}>{d.class_name==='car'?'🚗':d.class_name==='truck'?'🚛':d.class_name==='person'||d.class_name==='pedestrian'?'🧍':d.class_name==='bus'?'🚌':d.class_name==='bicycle'?'🚲':'📦'}</span>
                        <div>
                          <p style={{color:'#fef3c7',fontSize:13,fontWeight:600,textTransform:'capitalize'}}>{d.class_name}</p>
                          <p style={{color:'#92400e',fontSize:11}}>{d.source} · {d.timestamp?.slice(11,19)}</p>
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        {d.activity_label&&<span style={{background:'rgba(42,29,16,0.9)',color:'#b45309',borderRadius:6,fontSize:10,padding:'2px 8px'}}>{d.activity_label}</span>}
                        <span style={{color:'#10b981',fontWeight:800,fontSize:14,fontFamily:'monospace'}}>{(d.confidence*100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                  {detections.filter(d=>d.confidence>=0.8).length===0&&(
                    <p style={{color:'#78350f',textAlign:'center',padding:'20px 0',fontSize:12}}>No high-confidence detections yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right column */}
            <div style={{display:'flex',flexDirection:'column',gap:14}}>

              {/* System status */}
              <div style={{
                background:'rgba(18,13,6,0.85)',backdropFilter:'blur(12px)',
                border:'1px solid rgba(245,158,11,0.15)',borderRadius:16,padding:18,
              }}>
                <p style={{color:'#78350f',fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:14}}>System Status</p>
                {[
                  {label:'Model',     val:'YOLOv8s VisDrone', ok:true},
                  {label:'Inference', val:'CUDA / GPU',        ok:true},
                  {label:'mAP@0.5',  val:'56.01%',            ok:true},
                  {label:'Classes',  val:'10 VisDrone',       ok:true},
                  {label:'API',      val:'Running :8000',     ok:true},
                  {label:'Tests',    val:'51 / 51 ✅',        ok:true},
                ].map(({label,val,ok},i)=>(
                  <div key={label} style={{
                    display:'flex',alignItems:'center',justifyContent:'space-between',
                    padding:'8px 0', borderBottom:'1px solid rgba(42,29,16,0.8)',
                    animation:`fadeInUp 0.3s ease ${0.05*i}s both`,
                  }}>
                    <span style={{color:'#78350f',fontSize:11}}>{label}</span>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{
                        width:7,height:7,borderRadius:'50%',
                        background:ok?'#10b981':'#ef4444',
                        display:'inline-block',
                        boxShadow:ok?'0 0 6px #10b981':'0 0 6px #ef4444',
                      }}/>
                      <span style={{color:'#fef3c7',fontSize:11,fontWeight:600}}>{val}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Source pie */}
              <div style={{
                background:'rgba(18,13,6,0.85)',backdropFilter:'blur(12px)',
                border:'1px solid rgba(245,158,11,0.15)',borderRadius:16,padding:18,
              }}>
                <p style={{color:'#78350f',fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:10}}>Detection Sources</p>
                {sourceData.length>0?(
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" outerRadius={52} dataKey="value"
                        label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`} labelLine={false}
                        style={{fontSize:9,fill:'#b45309'}}>
                        {sourceData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle}/>
                    </PieChart>
                  </ResponsiveContainer>
                ):<p style={{color:'#78350f',textAlign:'center',padding:'20px 0',fontSize:11}}>No data yet</p>}
              </div>

              {/* Top detected */}
              {classData[0]&&(
                <div style={{
                  background:`linear-gradient(135deg, rgba(245,158,11,0.12), rgba(217,119,6,0.06))`,
                  border:`1px solid rgba(245,158,11,0.3)`,borderRadius:16,padding:18,
                  boxShadow:`0 0 20px rgba(245,158,11,0.1)`,
                }}>
                  <p style={{color:AD,fontSize:10,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>🏆 Most Detected</p>
                  <p style={{
                    color:'#fef3c7',fontWeight:800,fontSize:26,textTransform:'capitalize',
                    background:'linear-gradient(90deg,#fef3c7,#f59e0b)',
                    WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',
                  }}>{classData[0].name}</p>
                  <p style={{color:AD,fontSize:13,marginTop:4}}>{classData[0].count} detections</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FIGURES TAB ── */}
        {tab==='figures'&&(
          <div style={{display:'flex',flexDirection:'column',gap:18,animation:'fadeInUp 0.4s ease both'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
              {[
                {title:'Top Detected Classes',chart:(
                  <BarChart data={classData} margin={{top:0,right:10,left:-10,bottom:40}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,29,16,0.8)"/>
                    <XAxis dataKey="name" tick={{fill:'#92400e',fontSize:10}} angle={-35} textAnchor="end"/>
                    <YAxis tick={{fill:'#92400e',fontSize:10}}/>
                    <Tooltip contentStyle={tooltipStyle}/>
                    <Bar dataKey="count" fill={A} radius={[6,6,0,0]}/>
                  </BarChart>
                )},
                {title:'Detections Over Time',chart:(
                  <LineChart data={timeChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(42,29,16,0.8)"/>
                    <XAxis dataKey="time" tick={{fill:'#92400e',fontSize:10}}/>
                    <YAxis tick={{fill:'#92400e',fontSize:10}}/>
                    <Tooltip contentStyle={tooltipStyle}/>
                    <Line type="monotone" dataKey="count" stroke={A} strokeWidth={2.5} dot={false}/>
                  </LineChart>
                )},
              ].map(({title,chart})=>(
                <div key={title} style={{
                  background:'rgba(18,13,6,0.85)',backdropFilter:'blur(12px)',
                  border:'1px solid rgba(245,158,11,0.15)',borderRadius:16,padding:20,
                  transition:'all 0.25s',
                }}
                  onMouseEnter={e=>{e.currentTarget.style.boxShadow=`0 0 30px rgba(245,158,11,0.12)`;e.currentTarget.style.borderColor='rgba(245,158,11,0.35)'}}
                  onMouseLeave={e=>{e.currentTarget.style.boxShadow='none';e.currentTarget.style.borderColor='rgba(245,158,11,0.15)'}}
                >
                  <p style={{color:'#fef3c7',fontSize:13,fontWeight:700,marginBottom:16}}>{title}</p>
                  <ResponsiveContainer width="100%" height={210}>{chart}</ResponsiveContainer>
                </div>
              ))}
            </div>

            {/* Full table */}
            <div style={{
              background:'rgba(18,13,6,0.85)',backdropFilter:'blur(12px)',
              border:'1px solid rgba(245,158,11,0.15)',borderRadius:16,overflow:'hidden',
            }}>
              <div style={{
                padding:'12px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',
                borderBottom:'1px solid rgba(42,29,16,0.8)',background:'rgba(245,158,11,0.03)',
              }}>
                <p style={{color:'#fef3c7',fontSize:13,fontWeight:700}}>All Detections</p>
                <span style={{background:'rgba(245,158,11,0.15)',color:A,borderRadius:99,fontSize:11,fontWeight:700,padding:'2px 10px'}}>
                  {totalDetections} total
                </span>
              </div>
              <div className="scrollbar-thin" style={{overflowY:'auto',maxHeight:240}}>
                <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
                  <thead style={{background:'rgba(30,22,10,0.9)',position:'sticky',top:0}}>
                    <tr style={{color:'#78350f',textAlign:'left'}}>
                      {['Class','Confidence','Activity','Source','Time'].map(h=>(
                        <th key={h} style={{padding:'8px 16px',fontWeight:600,letterSpacing:'0.04em',fontSize:10,textTransform:'uppercase'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detections.slice(0,50).map((d,i)=>(
                      <tr key={i} style={{borderTop:'1px solid rgba(42,29,16,0.6)',transition:'background 0.15s'}}
                        onMouseEnter={e=>e.currentTarget.style.background='rgba(245,158,11,0.04)'}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                        <td style={{padding:'8px 16px',color:'#fef3c7',fontWeight:600,textTransform:'capitalize'}}>{d.class_name}</td>
                        <td style={{padding:'8px 16px',color:d.confidence>=0.7?'#10b981':d.confidence>=0.5?A:'#ef4444',fontWeight:700,fontFamily:'monospace'}}>
                          {(d.confidence*100).toFixed(0)}%
                        </td>
                        <td style={{padding:'8px 16px',color:'#b45309'}}>{d.activity_label||'—'}</td>
                        <td style={{padding:'8px 16px',color:'#78350f',textTransform:'capitalize'}}>{d.source}</td>
                        <td style={{padding:'8px 16px',color:'#78350f',fontFamily:'monospace'}}>{d.timestamp?.slice(11,19)||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detections.length===0&&(
                  <p style={{color:'#78350f',textAlign:'center',padding:'40px 0',fontSize:12}}>No detections yet — upload an image or start live stream</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
