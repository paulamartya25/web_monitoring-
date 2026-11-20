import { useState, useEffect } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlayCircle, Loader2, RefreshCw } from 'lucide-react'
import MetricsCard from '../components/MetricsCard'

const DATASETS = [
  { value: 'visdrone', label: '🚁 VisDrone2019-DET Val (548 images)', group: 'VisDrone' },
  { value: 'coco128',  label: '⚡ COCO128 (Quick, 128 images)',        group: 'COCO' },
  { value: 'coco',     label: '📦 COCO val2017 (Full, 5K images)',     group: 'COCO' },
]

// Compatibility rules
// visdrone dataset → only yolov8s_visdrone_best makes sense
// coco datasets    → only yolov8n / yolov8s make sense
const INCOMPATIBLE = (model, dataset) =>
  (model === 'yolov8s_visdrone_best' && (dataset === 'coco128' || dataset === 'coco')) ||
  (model !== 'yolov8s_visdrone_best' && dataset === 'visdrone')

const PERFECT_MATCH = (model, dataset) =>
  model === 'yolov8s_visdrone_best' && dataset === 'visdrone'

const EVAL_MODELS = [
  // ── Your fine-tuned VisDrone model ──────────────────────────────
  { value: 'yolov8s_visdrone_best', label: '🏆 YOLOv8s VisDrone — Best (56.01% mAP, 1280px)', group: 'Fine-Tuned' },
  // ── Generic COCO pretrained baselines (for comparison) ──────────
  { value: 'yolov8n', label: '⚡ YOLOv8n — Nano (COCO pretrained)',    group: 'COCO Baseline' },
  { value: 'yolov8s', label: '⚖️ YOLOv8s — Small (COCO pretrained)',   group: 'COCO Baseline' },
]

const STATUS_COLOR = {
  pending:   'bg-yellow-900/40 text-yellow-400 border-yellow-700',
  running:   'bg-blue-900/40   text-blue-400   border-blue-700',
  completed: 'bg-green-900/40  text-green-400  border-green-700',
  failed:    'bg-red-900/40    text-red-400    border-red-700',
}

export default function Evaluate() {
  const [dataset, setDataset] = useState('visdrone')
  const [model, setModel] = useState('yolov8s_visdrone_best')
  const [runs, setRuns] = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(null)

  const fetchRuns = async () => {
    try {
      const res = await axios.get('/evaluate/results')
      setRuns(res.data.runs || [])
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchRuns()
  }, [])

  // Poll a running evaluation every 5s
  useEffect(() => {
    if (!polling) return
    const id = setInterval(async () => {
      try {
        const res = await axios.get(`/evaluate/results/${polling}`)
        const run = res.data
        if (run.status === 'completed' || run.status === 'failed') {
          clearInterval(id)
          setPolling(null)
          setLoading(false)
          if (run.status === 'completed') {
            setSelectedRun(run)
            toast.success('Evaluation complete!')
          } else {
            toast.error(`Evaluation failed: ${run.error_message}`)
          }
          fetchRuns()
        }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(id)
  }, [polling])

  const handleRun = async () => {
    // Guard: block incompatible model/dataset combinations
    if (INCOMPATIBLE(model, dataset)) {
      const msg = model === 'yolov8s_visdrone_best'
        ? 'Dataset mismatch: The VisDrone model (10 aerial classes) cannot be evaluated on COCO (80 different classes). Select VisDrone dataset instead.'
        : 'Dataset mismatch: A COCO pretrained model cannot be meaningfully evaluated on VisDrone (10 different aerial classes). Select YOLOv8s VisDrone — Best, or switch to a COCO dataset.'
      toast.error(msg, { duration: 7000 })
      return
    }
    setLoading(true)
    setSelectedRun(null)
    try {
      const res = await axios.post('/evaluate/run', null, {
        params: { dataset_name: dataset, model_size: model },
      })
      toast('Evaluation started — this may take a few minutes…', { icon: '⏳' })
      setPolling(res.data.run_id)
      fetchRuns()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start evaluation')
      setLoading(false)
    }
  }

  const loadRun = async (run) => {
    try {
      const res = await axios.get(`/evaluate/results/${run.id}`)
      setSelectedRun(res.data)
    } catch { toast.error('Could not load run details') }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Model Evaluation</h1>
        <p className="text-gray-400 text-sm mt-1">Run YOLOv8 on benchmark datasets and compute F1, mAP, ROC-AUC, Confusion Matrix</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="col-span-1 space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
            <h2 className="font-semibold text-white">Run Configuration</h2>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">Dataset</label>
              <select
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <optgroup label="── VisDrone (Aerial Traffic)">
                  {DATASETS.filter(d => d.group === 'VisDrone').map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </optgroup>
                <optgroup label="── COCO (General Object Detection)">
                  {DATASETS.filter(d => d.group === 'COCO').map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </optgroup>
              </select>
              {dataset === 'visdrone' && (
                <p className="text-xs text-sky-400 mt-1">
                  ℹ️ First run auto-downloads VisDrone2019-DET val split (~78 MB). Takes ~2–3 min on first run.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500"
              >
                <optgroup label="── Fine-Tuned (VisDrone)">
                  {EVAL_MODELS.filter(m => m.group === 'Fine-Tuned').map((m) =>
                    <option key={m.value} value={m.value}>{m.label}</option>
                  )}
                </optgroup>
                <optgroup label="── COCO Pretrained Baselines">
                  {EVAL_MODELS.filter(m => m.group === 'COCO Baseline').map((m) =>
                    <option key={m.value} value={m.value}>{m.label}</option>
                  )}
                </optgroup>
              </select>

              {/* Dataset/model compatibility banner — 3 states */}
              {PERFECT_MATCH(model, dataset) && (
                <div className="mt-2 bg-green-900/30 border border-green-600/50 rounded-lg px-3 py-2 text-xs text-green-300">
                  ✅ <strong>Perfect match.</strong> YOLOv8s VisDrone Best evaluated on its own val split (548 images, 1280 px).
                  Expected: <strong>mAP≈56%, P≈64%, R≈54%</strong> — matching published training numbers.
                  <span className="text-green-400/70 block mt-1">⏱ CPU: ~20–30 min (1280 px inference on 548 images)</span>
                </div>
              )}
              {INCOMPATIBLE(model, dataset) && (
                <div className="mt-2 bg-red-900/30 border border-red-600/50 rounded-lg px-3 py-2 text-xs text-red-300">
                  ⚠️ <strong>Incompatible combination.</strong>{' '}
                  {model === 'yolov8s_visdrone_best'
                    ? 'The VisDrone model was trained on 10 aerial traffic classes. COCO has 80 different classes. Evaluating across mismatched datasets produces scientifically invalid metrics (100% P/R/F1 is a known symptom of this bug). Switch to a COCO model for COCO datasets.'
                    : 'A COCO pretrained model cannot be meaningfully evaluated on VisDrone — class label spaces don\'t match. Switch to YOLOv8s VisDrone — Best, or choose a COCO dataset.'}
                </div>
              )}
              {!PERFECT_MATCH(model, dataset) && !INCOMPATIBLE(model, dataset) && model !== 'yolov8s_visdrone_best' && (
                <p className="text-xs text-gray-600 mt-1">
                  💡 For your best model (56.01% mAP), select <span className="text-indigo-400">YOLOv8s VisDrone — Best</span> + <span className="text-indigo-400">VisDrone dataset</span>
                </p>
              )}
            </div>

            <button
              onClick={handleRun}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500
                disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-semibold transition-colors"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
                : <><PlayCircle className="w-4 h-4" /> Run Evaluation</>}
            </button>

            {loading && (
              <p className="text-xs text-gray-500 text-center">
                This runs in the background. Results will auto-load when complete.
              </p>
            )}
          </div>

          {/* Past runs */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white text-sm">Past Runs</h2>
              <button onClick={fetchRuns} className="text-gray-500 hover:text-gray-300">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {runs.length === 0 && <p className="text-gray-600 text-xs text-center py-4">No runs yet</p>}
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => loadRun(run)}
                  className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-lg p-2.5 border border-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white font-medium">{run.dataset_name} / {run.model_size}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_COLOR[run.status] || ''}`}>
                      {run.status}
                    </span>
                  </div>
                  {run.map50 && (
                    <p className="text-xs text-gray-500 mt-0.5">mAP@0.5: {(run.map50 * 100).toFixed(1)}%  F1: {(run.f1_score * 100).toFixed(1)}%</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results panel */}
        <div className="col-span-2">
          {!selectedRun ? (
            <div className="h-full min-h-64 flex items-center justify-center bg-gray-900 rounded-xl border border-gray-800 border-dashed">
              <p className="text-gray-600 text-sm">Select a completed run to view metrics</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-3">
                <MetricsCard label="mAP@0.5"      value={selectedRun.map50}     icon="🎯" color="indigo" />
                <MetricsCard label="mAP@0.5:0.95" value={selectedRun.map5095}   icon="📊" color="blue"   />
                <MetricsCard label="F1 Score"      value={selectedRun.f1_score}  icon="⚖️" color="green"  />
                <MetricsCard label="Precision"     value={selectedRun.precision} icon="🔬" color="purple" />
                <MetricsCard label="Recall"        value={selectedRun.recall}    icon="🔭" color="orange" />
                <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 flex flex-col justify-center">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Model</p>
                  <p className="text-white font-bold mt-1">{selectedRun.model_size}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{selectedRun.dataset_name}</p>
                </div>
              </div>

              {/* Chart images */}
              {selectedRun.charts && Object.keys(selectedRun.charts).length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(selectedRun.charts).map(([key, url]) => (
                    <div key={key} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                      <p className="text-xs text-gray-500 text-center py-2 border-b border-gray-800 capitalize">
                        {key.replace(/_/g, ' ')}
                      </p>
                      <img src={url} alt={key} className="w-full object-contain" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
