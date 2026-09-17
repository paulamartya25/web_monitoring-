import { useRef, useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Play, Square, Camera, Wifi, WifiOff, AlertTriangle, Car, User, Bike } from 'lucide-react'
import ModelSelector from '../components/ModelSelector'
import ActivityBadge from '../components/ActivityBadge'

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/stream`
const FRAME_INTERVAL = 100

// Map class names to icons
const CLASS_ICON = {
  person: '🧍', car: '🚗', truck: '🚛', bus: '🚌',
  motorcycle: '🏍️', bicycle: '🚲', 'traffic light': '🚦',
  'stop sign': '🛑', default: '📦',
}
const getIcon = (cls) => CLASS_ICON[cls] || CLASS_ICON.default

export default function LiveStream() {
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const offscreenRef = useRef(null)
  const wsRef       = useRef(null)
  const rafRef      = useRef(null)
  const lastSendRef = useRef(0)

  const [isStreaming, setIsStreaming]     = useState(false)
  const [isConnected, setIsConnected]     = useState(false)
  const [detections, setDetections]       = useState([])
  const [fps, setFps]                     = useState(0)
  const [inferenceMs, setInferenceMs]     = useState(0)
  const [model, setModel]                 = useState('yolov8s_visdrone_best')
  const [frameCount, setFrameCount]       = useState(0)
  const [vehicleCounts, setVehicleCounts] = useState({})
  const [zoneAlerts, setZoneAlerts]       = useState([])
  const [trafficSummary, setTrafficSummary] = useState(null)

  // ── WebSocket ─────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => { setIsConnected(true); toast.success('Connected to traffic monitor') }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.error) { toast.error(data.error); return }

        // Draw annotated frame
        const img = new Image()
        img.onload = () => {
          const canvas = canvasRef.current
          if (!canvas) return
          const ctx = canvas.getContext('2d')
          canvas.width = img.width
          canvas.height = img.height
          ctx.drawImage(img, 0, 0)
        }
        img.src = `data:image/jpeg;base64,${data.annotated_frame}`

        setDetections(data.detections || [])
        setFps(data.fps || 0)
        setInferenceMs(data.inference_ms || 0)
        setFrameCount(data.frame_count || 0)
        setVehicleCounts(data.vehicle_counts || {})
        setZoneAlerts(data.zone_alerts || [])
        setTrafficSummary(data.traffic_summary || null)
      } catch (err) { console.error('WS parse error', err) }
    }

    ws.onerror = () => toast.error('Connection error')
    ws.onclose = () => { setIsConnected(false); setIsStreaming(false) }
  }, [])

  // ── Frame capture ─────────────────────────────────────────────────
  const captureAndSend = useCallback(() => {
    const ws = wsRef.current
    // If WS not ready yet, keep looping until it opens
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      rafRef.current = requestAnimationFrame(captureAndSend); return
    }

    const now = Date.now()
    if (now - lastSendRef.current < FRAME_INTERVAL) {
      rafRef.current = requestAnimationFrame(captureAndSend); return
    }
    lastSendRef.current = now

    const video     = videoRef.current
    const offscreen = offscreenRef.current
    if (!video || !offscreen || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(captureAndSend); return
    }

    const ctx = offscreen.getContext('2d')
    offscreen.width  = video.videoWidth
    offscreen.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const b64 = offscreen.toDataURL('image/jpeg', 0.7).split(',')[1]
    if (ws.bufferedAmount < 100000) ws.send(b64)

    rafRef.current = requestAnimationFrame(captureAndSend)
  }, [])

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      connectWS()
      setIsStreaming(true)
      rafRef.current = requestAnimationFrame(captureAndSend)
    } catch (err) { toast.error(`Camera error: ${err.message}`) }
  }

  const stopStream = () => {
    cancelAnimationFrame(rafRef.current)
    wsRef.current?.close()
    videoRef.current?.srcObject?.getTracks()?.forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setIsStreaming(false); setDetections([]); setFps(0); setZoneAlerts([])
  }

  useEffect(() => () => stopStream(), [])

  const confColor = (c) => c >= 0.7 ? 'text-green-400' : c >= 0.5 ? 'text-yellow-400' : 'text-red-400'
  const speedColor = (s) => s > 60 ? 'text-red-400' : s > 30 ? 'text-yellow-400' : 'text-green-400'

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🚦 Traffic CCTV Monitor</h1>
          <p className="text-gray-400 text-sm mt-0.5">Real-time road object detection &amp; behavior analysis</p>
        </div>
        <div className="flex items-center gap-3">
          <ModelSelector value={model} onChange={setModel} />
          {isConnected
            ? <span className="flex items-center gap-1 text-green-400 text-sm"><Wifi className="w-4 h-4" /> Live</span>
            : <span className="flex items-center gap-1 text-gray-500 text-sm"><WifiOff className="w-4 h-4" /> Offline</span>}
        </div>
      </div>

      {/* Traffic summary stats bar */}
      {trafficSummary && (
        <div className="grid grid-cols-5 gap-3 mb-4">
          {[
            { label: 'Vehicles Counted', value: Object.values(vehicleCounts).reduce((a,b)=>a+b,0), icon: '🚗' },
            { label: 'Objects on Road', value: trafficSummary.total_objects, icon: '📍' },
            { label: 'Avg Speed', value: `${trafficSummary.avg_speed_kmh} km/h`, icon: '⚡' },
            { label: 'Max Speed', value: `${trafficSummary.max_speed_kmh} km/h`, icon: '🚨' },
            { label: 'Alerts', value: trafficSummary.alert_count, icon: '⚠️' },
          ].map(({ label, value, icon }) => (
            <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
              <div className="text-lg">{icon}</div>
              <div className="text-xl font-bold text-white">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Zone Alerts Banner */}
      {zoneAlerts.length > 0 && (
        <div className="mb-4 bg-red-900/30 border border-red-600/50 rounded-xl p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 font-semibold text-sm">Active Alerts</p>
            {zoneAlerts.map((a, i) => <p key={i} className="text-red-400 text-xs mt-0.5">{a}</p>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-5 gap-4">
        {/* Video feed — 60% */}
        <div className="col-span-3 space-y-3">
          <div className="relative bg-gray-900 rounded-xl overflow-hidden border border-gray-800 aspect-video flex items-center justify-center">
            <video ref={videoRef} className="hidden" playsInline muted />
            <canvas ref={offscreenRef} className="hidden" />

            {isStreaming
              ? <canvas ref={canvasRef} className="w-full h-full object-contain" />
              : (
                <div className="text-center text-gray-600">
                  <Camera className="w-16 h-16 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Start to monitor live traffic</p>
                  <p className="text-xs text-gray-700 mt-1">Or upload a road video on the Upload page</p>
                </div>
              )}

            {isStreaming && (
              <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
                <span className="bg-red-600/80 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">● LIVE</span>
                <span className="bg-gray-900/80 text-gray-300 text-xs px-2 py-0.5 rounded-full">{fps} FPS</span>
                <span className="bg-gray-900/80 text-gray-300 text-xs px-2 py-0.5 rounded-full">{inferenceMs}ms</span>
                <span className="bg-gray-900/80 text-gray-300 text-xs px-2 py-0.5 rounded-full">{detections.length} objects</span>
              </div>
            )}
          </div>

          {/* Controls + vehicle count badges */}
          <div className="flex items-center gap-3 flex-wrap">
            {!isStreaming
              ? <button onClick={startStream}
                  className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors">
                  <Play className="w-4 h-4" /> Start Monitor
                </button>
              : <button onClick={stopStream}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors">
                  <Square className="w-4 h-4" /> Stop
                </button>}

            {/* Vehicle crossing counts */}
            {Object.entries(vehicleCounts).map(([cls, count]) => (
              <span key={cls} className="flex items-center gap-1 bg-gray-800 border border-gray-700 text-gray-300 text-sm px-3 py-1.5 rounded-lg">
                {getIcon(cls)} <span className="capitalize">{cls}</span>: <strong className="text-white ml-1">{count}</strong>
              </span>
            ))}
          </div>
        </div>

        {/* Detection panel — 40% */}
        <div className="col-span-2 bg-gray-900 rounded-xl border border-gray-800 flex flex-col max-h-[520px]">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between shrink-0">
            <h2 className="font-semibold text-white">Objects on Road</h2>
            <span className="bg-indigo-600/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full border border-indigo-600/30">
              {detections.length} detected
            </span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
            {detections.length === 0
              ? <p className="text-gray-600 text-sm text-center mt-8">No objects detected yet</p>
              : detections.map((det, i) => (
                <div key={i} className={`rounded-lg p-3 border transition-colors
                  ${det.alert ? 'bg-red-900/20 border-red-700/50' : 'bg-gray-800 border-gray-700/50'}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getIcon(det.class_name)}</span>
                      {det.track_id >= 0 && <span className="text-xs text-gray-500 font-mono">#{det.track_id}</span>}
                      <span className="font-medium text-white capitalize">{det.class_name}</span>
                    </div>
                    <span className={`text-sm font-bold ${confColor(det.confidence)}`}>
                      {(det.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {det.activity && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                        ${det.alert ? 'bg-red-700/40 text-red-300' : 'bg-gray-700 text-gray-300'}`}>
                        {det.activity}
                      </span>
                    )}
                    {det.estimated_speed_kmh > 0 && (
                      <span className={`text-xs font-mono ${speedColor(det.estimated_speed_kmh)}`}>
                        ~{det.estimated_speed_kmh} km/h
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {/* Recent alerts log */}
          {trafficSummary?.recent_alerts?.length > 0 && (
            <div className="border-t border-gray-800 p-3 shrink-0">
              <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-widest">Recent Alerts</p>
              <div className="space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
                {trafficSummary.recent_alerts.map((a, i) => (
                  <p key={i} className="text-xs text-red-400">⚠️ {a}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
