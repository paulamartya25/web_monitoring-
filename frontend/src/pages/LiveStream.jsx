import { useRef, useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { Play, Square, Camera, Wifi, WifiOff } from 'lucide-react'
import ModelSelector from '../components/ModelSelector'
import ActivityBadge from '../components/ActivityBadge'

const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/stream`
const FRAME_INTERVAL = 100  // ms — 10 FPS cap from client side

export default function LiveStream() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)       // visible annotated output
  const offscreenRef = useRef(null)    // hidden canvas for capture
  const wsRef = useRef(null)
  const rafRef = useRef(null)
  const lastSendRef = useRef(0)

  const [isStreaming, setIsStreaming] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [detections, setDetections] = useState([])
  const [fps, setFps] = useState(0)
  const [inferenceMs, setInferenceMs] = useState(0)
  const [model, setModel] = useState('yolov8n')
  const [frameCount, setFrameCount] = useState(0)

  // ── WebSocket ────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      toast.success('Connected to detection server')
    }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.error) { toast.error(data.error); return }

        // Draw annotated frame to visible canvas
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
      } catch (err) {
        console.error('WS parse error', err)
      }
    }

    ws.onerror = () => toast.error('WebSocket error')
    ws.onclose = () => {
      setIsConnected(false)
      setIsStreaming(false)
    }
  }, [])

  // ── Frame capture loop ───────────────────────────────────────────
  const captureAndSend = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    const now = Date.now()
    if (now - lastSendRef.current < FRAME_INTERVAL) {
      rafRef.current = requestAnimationFrame(captureAndSend)
      return
    }
    lastSendRef.current = now

    const video = videoRef.current
    const offscreen = offscreenRef.current
    if (!video || !offscreen || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(captureAndSend)
      return
    }

    const ctx = offscreen.getContext('2d')
    offscreen.width = video.videoWidth
    offscreen.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    // Convert to base64 JPEG (quality 0.7)
    const b64 = offscreen.toDataURL('image/jpeg', 0.7).split(',')[1]
    if (ws.bufferedAmount < 100000) {   // don't flood if buffer full
      ws.send(b64)
    }

    rafRef.current = requestAnimationFrame(captureAndSend)
  }, [])

  // ── Start streaming ──────────────────────────────────────────────
  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      connectWS()
      setIsStreaming(true)
      rafRef.current = requestAnimationFrame(captureAndSend)
    } catch (err) {
      toast.error(`Camera error: ${err.message}`)
    }
  }

  // ── Stop streaming ───────────────────────────────────────────────
  const stopStream = () => {
    cancelAnimationFrame(rafRef.current)
    wsRef.current?.close()
    const tracks = videoRef.current?.srcObject?.getTracks()
    tracks?.forEach((t) => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setIsStreaming(false)
    setDetections([])
    setFps(0)
    setFrameCount(0)
  }

  useEffect(() => () => stopStream(), [])

  // ── Confidence color ─────────────────────────────────────────────
  const confColor = (c) => c >= 0.7 ? 'text-green-400' : c >= 0.5 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Webcam Detection</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time YOLOv8 object detection via webcam</p>
        </div>
        <div className="flex items-center gap-3">
          <ModelSelector value={model} onChange={setModel} />
          {isConnected
            ? <span className="flex items-center gap-1 text-green-400 text-sm"><Wifi className="w-4 h-4" /> Connected</span>
            : <span className="flex items-center gap-1 text-gray-500 text-sm"><WifiOff className="w-4 h-4" /> Disconnected</span>}
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Video canvas — 60% */}
        <div className="col-span-3 space-y-3">
          <div className="relative bg-gray-900 rounded-xl overflow-hidden border border-gray-800 aspect-video flex items-center justify-center">
            {/* Hidden video element */}
            <video ref={videoRef} className="hidden" playsInline muted />
            {/* Hidden offscreen canvas */}
            <canvas ref={offscreenRef} className="hidden" />

            {isStreaming ? (
              <canvas ref={canvasRef} className="w-full h-full object-contain" />
            ) : (
              <div className="text-center text-gray-600">
                <Camera className="w-16 h-16 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Click Start to begin live detection</p>
              </div>
            )}

            {/* Overlay stats */}
            {isStreaming && (
              <div className="absolute top-3 left-3 flex gap-2">
                <span className="bg-red-600/80 text-white text-xs px-2 py-0.5 rounded-full font-bold animate-pulse">● LIVE</span>
                <span className="bg-gray-900/80 text-gray-300 text-xs px-2 py-0.5 rounded-full">{fps} FPS</span>
                <span className="bg-gray-900/80 text-gray-300 text-xs px-2 py-0.5 rounded-full">{inferenceMs}ms</span>
                <span className="bg-gray-900/80 text-gray-300 text-xs px-2 py-0.5 rounded-full">Frame #{frameCount}</span>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            {!isStreaming ? (
              <button
                onClick={startStream}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
              >
                <Play className="w-4 h-4" /> Start Detection
              </button>
            ) : (
              <button
                onClick={stopStream}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
              >
                <Square className="w-4 h-4" /> Stop
              </button>
            )}
          </div>
        </div>

        {/* Detections panel — 40% */}
        <div className="col-span-2 bg-gray-900 rounded-xl border border-gray-800 flex flex-col">
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-white">Detections</h2>
            <span className="bg-indigo-600/20 text-indigo-300 text-xs px-2 py-0.5 rounded-full border border-indigo-600/30">
              {detections.length} objects
            </span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
            {detections.length === 0 ? (
              <p className="text-gray-600 text-sm text-center mt-8">No objects detected yet</p>
            ) : (
              detections.map((det, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-3 border border-gray-700/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {det.track_id >= 0 && (
                        <span className="text-xs text-gray-500 font-mono">#{det.track_id}</span>
                      )}
                      <span className="font-medium text-white capitalize">{det.class_name}</span>
                    </div>
                    <span className={`text-sm font-bold ${confColor(det.confidence)}`}>
                      {(det.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {det.activity && <ActivityBadge activity={det.activity} />}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
