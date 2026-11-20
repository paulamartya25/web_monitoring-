import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Upload as UploadIcon, FileImage, FileVideo, X, Download, Loader2 } from 'lucide-react'
import ActivityBadge from '../components/ActivityBadge'
import ModelSelector from '../components/ModelSelector'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [fileType, setFileType] = useState(null)   // 'image' | 'video'
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [conf, setConf] = useState(0.25)
  const [model, setModel] = useState('yolov8s_visdrone_best')

  const onDrop = useCallback((accepted) => {
    const f = accepted[0]
    if (!f) return
    setFile(f)
    setResult(null)
    const isImage = f.type.startsWith('image/')
    const isVideo = f.type.startsWith('video/')
    setFileType(isImage ? 'image' : isVideo ? 'video' : null)
    setPreview(isImage ? URL.createObjectURL(f) : null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [], 'video/*': [] },
    maxFiles: 1,
  })

  const handleDetect = async () => {
    if (!file || !fileType) return
    setLoading(true)
    setProgress(0)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const endpoint = fileType === 'image' ? '/detect/image' : '/detect/video'
      const res = await axios.post(endpoint, formData, {
        params: { conf, model_size: model },
        onUploadProgress: (e) => setProgress(Math.round(e.loaded / e.total * 50)),
      })
      setProgress(100)
      setResult({ ...res.data, fileType })
      toast.success(`Detected ${res.data.total_detections ?? res.data.total_frames} ${fileType === 'image' ? 'objects' : 'frames'}!`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Detection failed')
    } finally {
      setLoading(false)
    }
  }

  // Download annotated image from base64
  const handleDownloadImage = () => {
    if (!result?.annotated_image) return
    const link = document.createElement('a')
    link.href = `data:image/jpeg;base64,${result.annotated_image}`
    const baseName = file?.name?.replace(/\.[^.]+$/, '') || 'detection'
    link.download = `${baseName}_detected.jpg`
    link.click()
    toast.success('Image downloaded!')
  }

  const confColor = (c) => c >= 0.7 ? 'text-green-400' : c >= 0.5 ? 'text-yellow-400' : 'text-red-400'

  // Show aerial vs ground-level hint
  const AERIAL_MODELS = new Set(['yolov8s_visdrone_best', 'best_1280', 'best_640'])
  const isAerial = AERIAL_MODELS.has(model)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Upload &amp; Detect</h1>
          <p className="text-gray-400 text-sm mt-1">Upload an image or video to run YOLOv8 object detection</p>
        </div>
        <ModelSelector value={model} onChange={setModel} />
      </div>

      {/* Camera-mode hint */}
      <div className={`mb-4 rounded-xl p-3 border flex items-start gap-3
        ${isAerial ? 'bg-indigo-900/20 border-indigo-600/40' : 'bg-yellow-900/20 border-yellow-600/40'}`}>
        <span className="text-xl shrink-0">{isAerial ? '📡' : '📷'}</span>
        <div>
          <p className={`text-sm font-semibold ${isAerial ? 'text-indigo-300' : 'text-yellow-300'}`}>
            {isAerial ? 'Aerial / Drone Model selected' : 'Ground-Level Model selected'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {isAerial
              ? 'Best for overhead drone or CCTV footage. Ground-level photos may show fewer detections.'
              : 'Best for standard photos, webcam, dashcam, or eye-level images.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Upload + controls */}
        <div className="space-y-4">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-indigo-500 bg-indigo-900/20' : 'border-gray-700 hover:border-gray-500 bg-gray-900/40'}`}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-gray-300">
                  {fileType === 'image' ? <FileImage className="w-6 h-6 text-indigo-400" /> : <FileVideo className="w-6 h-6 text-purple-400" />}
                  <span className="text-sm font-medium truncate max-w-xs">{file.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setResult(null) }}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  ><X className="w-4 h-4" /></button>
                </div>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="space-y-3">
                <UploadIcon className="w-10 h-10 mx-auto text-gray-600" />
                <div>
                  <p className="text-gray-300 text-sm font-medium">Drop image or video here</p>
                  <p className="text-gray-500 text-xs mt-1">or click to browse</p>
                </div>
                <p className="text-gray-600 text-xs">JPEG, PNG, MP4, AVI supported</p>
              </div>
            )}
          </div>

          {/* Preview */}
          {preview && (
            <div className="rounded-xl overflow-hidden border border-gray-800 bg-gray-900">
              <img src={preview} alt="Preview" className="w-full object-contain max-h-48" />
            </div>
          )}

          {/* Confidence slider */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-400 font-medium">Confidence Threshold</label>
              <span className={`text-sm font-bold ${confColor(conf)}`}>{Math.round(conf * 100)}%</span>
            </div>
            <input
              type="range" min="0.1" max="0.9" step="0.05" value={conf}
              onChange={(e) => setConf(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>10% (more detections)</span>
              <span>90% (fewer, precise)</span>
            </div>
          </div>

          {/* Detect button */}
          <button
            onClick={handleDetect}
            disabled={!file || loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing... {progress}%</>
            ) : (
              <><UploadIcon className="w-4 h-4" /> Run Detection</>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {result ? (
            <>
              {/* Model used badge */}
              {result.model_used && (
                <div className="text-xs text-indigo-400 font-medium">
                  🤖 Model: <span className="text-indigo-300">{result.model_used}</span>
                </div>
              )}

              {result.fileType === 'image' && result.annotated_image ? (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden border border-gray-800">
                    <img
                      src={`data:image/jpeg;base64,${result.annotated_image}`}
                      alt="Detected"
                      className="w-full object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">
                      <strong className="text-white">{result.total_detections}</strong> objects detected
                    </span>
                    <button
                      onClick={handleDownloadImage}
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>

                  {/* Detection list */}
                  {result.detections?.length > 0 && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
                      {result.detections.map((det, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-gray-300 capitalize font-medium">{det.class_name}</span>
                          <div className="flex items-center gap-2">
                            {det.activity && <ActivityBadge activity={det.activity} />}
                            <span className={confColor(det.confidence)}>{Math.round(det.confidence * 100)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : result.fileType === 'video' ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-gray-900 border border-gray-800 p-4 text-center space-y-2">
                    <p className="text-white font-semibold">✅ Video processed</p>
                    <p className="text-gray-400 text-sm">{result.total_frames} frames analysed</p>
                    <a
                      href={result.annotated_video_url}
                      download={result.download_filename}
                      className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 mt-2"
                    >
                      <Download className="w-4 h-4" /> Download annotated video
                    </a>
                  </div>
                  {result.per_frame_log?.length > 0 && (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
                      {result.per_frame_log.slice(0, 20).map((frame, i) => (
                        <div key={i} className="text-xs text-gray-400">
                          Frame {frame.frame_idx}: <span className="text-gray-300">{frame.detections?.length ?? 0} objects</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="h-full flex items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-900/40 min-h-64">
              <div className="text-center text-gray-600">
                <UploadIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Results will appear here</p>
                <p className="text-xs mt-1 text-gray-700">Upload a file and click Run Detection</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
