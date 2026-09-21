import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Upload as UploadIcon, FileImage, FileVideo, X, Download, Loader2 } from 'lucide-react'
import ActivityBadge from '../components/ActivityBadge'

export default function Upload() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [fileType, setFileType] = useState(null)   // 'image' | 'video'
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [conf, setConf] = useState(0.25)

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
        params: { conf },
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Upload & Detect</h1>
        <p className="text-gray-400 text-sm mt-1">Upload an image or video to run YOLOv8 object detection</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Upload + controls */}
        <div className="space-y-4">
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 hover:border-indigo-600 bg-gray-900'}`}
          >
            <input {...getInputProps()} />
            <UploadIcon className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            {file ? (
              <div>
                <div className="flex items-center justify-center gap-2 text-white font-medium">
                  {fileType === 'image' ? <FileImage className="w-5 h-5 text-indigo-400" /> : <FileVideo className="w-5 h-5 text-purple-400" />}
                  {file.name}
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); setResult(null) }}>
                    <X className="w-4 h-4 text-gray-500 hover:text-red-400" />
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-400">Drag & drop an image or video here</p>
                <p className="text-gray-600 text-sm mt-1">or click to browse • JPEG, PNG, MP4, AVI, MOV</p>
              </div>
            )}
          </div>

          {/* Image preview */}
          {preview && (
            <img src={preview} alt="preview" className="rounded-xl border border-gray-800 w-full object-contain max-h-64" />
          )}

          {/* Confidence slider */}
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400 font-medium">Confidence Threshold</label>
              <span className="text-indigo-400 font-bold text-sm">{(conf * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range" min="0.1" max="0.9" step="0.05"
              value={conf} onChange={(e) => setConf(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>10% (more detections)</span>
              <span>90% (fewer, precise)</span>
            </div>
          </div>

          {/* Detect button */}
          <button
            onClick={handleDetect}
            disabled={!file || loading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500
              disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Processing… {progress}%</>
            ) : (
              <><UploadIcon className="w-4 h-4" /> Detect Objects</>
            )}
          </button>
        </div>

        {/* Right: Results */}
        <div>
          {!result && !loading && (
            <div className="h-full flex items-center justify-center bg-gray-900 rounded-xl border border-gray-800 border-dashed">
              <p className="text-gray-600 text-sm">Results will appear here</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Annotated image */}
              {result.fileType === 'image' && result.annotated_image && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">Annotated Result</p>
                    <button
                      onClick={handleDownloadImage}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500
                        text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Image
                    </button>
                  </div>
                  <img
                    src={`data:image/jpeg;base64,${result.annotated_image}`}
                    alt="annotated"
                    className="rounded-xl border border-gray-800 w-full cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={handleDownloadImage}
                    title="Click to download"
                  />
                  <p className="text-xs text-gray-600 text-center mt-1">
                    💡 Click image to download
                  </p>
                </div>
              )}


              {/* Video download */}
              {result.fileType === 'video' && (
                <div className="bg-gray-900 rounded-xl p-4 border border-green-500/30 text-center">
                  <p className="text-green-400 font-medium mb-2">✅ Video processed — {result.total_frames} frames</p>
                  <a
                    href={result.annotated_video_url}
                    download={result.download_filename}
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download Annotated Video
                  </a>
                </div>
              )}

              {/* Detections table */}
              <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Detections</span>
                  <span className="text-xs text-gray-500">{result.detections?.length ?? 0} objects</span>
                </div>
                <div className="overflow-y-auto max-h-80 scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50">
                      <tr className="text-left text-xs text-gray-500">
                        <th className="px-3 py-2">Class</th>
                        <th className="px-3 py-2">Confidence</th>
                        <th className="px-3 py-2">Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.detections || []).map((det, i) => (
                        <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/50">
                          <td className="px-3 py-2 font-medium text-white capitalize">{det.class_name}</td>
                          <td className={`px-3 py-2 font-bold ${confColor(det.confidence)}`}>
                            {(det.confidence * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-2">
                            {det.activity && <ActivityBadge activity={det.activity} />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
