import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { PlayCircle, Loader2, RefreshCw, Zap, GitCompare, BarChart2 } from 'lucide-react'
import MetricsCard from '../components/MetricsCard'

const DATASETS = [
  { value: 'visdrone', label: '🚁 VisDrone2019-DET Val (548 images)', group: 'VisDrone' },
  { value: 'coco128',  label: '⚡ COCO128 (Quick, 128 images)',        group: 'COCO' },
  { value: 'coco',     label: '📦 COCO val2017 (Full, 5K images)',     group: 'COCO' },
]

const EVAL_MODELS = [
  { value: 'yolov8s_visdrone_best', label: '🏆 YOLOv8s VisDrone — Best (56.01% mAP, 1280px)', group: 'Fine-Tuned' },
  { value: 'yolov8n', label: '⚡ YOLOv8n — Nano (COCO pretrained)',   group: 'COCO Baseline' },
  { value: 'yolov8s', label: '⚖️ YOLOv8s — Small (COCO pretrained)',  group: 'COCO Baseline' },
]

const INCOMPATIBLE = (model, dataset) =>
  (model === 'yolov8s_visdrone_best' && (dataset === 'coco128' || dataset === 'coco')) ||
  (model !== 'yolov8s_visdrone_best' && dataset === 'visdrone')

const STATUS_COLOR = {
  pending:   'bg-yellow-900/40 text-yellow-400 border-yellow-700',
  running:   'bg-blue-900/40   text-blue-400   border-blue-700',
  completed: 'bg-green-900/40  text-green-400  border-green-700',
  failed:    'bg-red-900/40    text-red-400    border-red-700',
}

// ── Per-class AP bar ─────────────────────────────────────────────────────────
function PerClassTable({ runId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    axios.get(`/evaluate/results/${runId}/per-class`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [runId])

  if (loading) return <p className="text-xs text-gray-500 py-4 text-center">Loading per-class data…</p>
  if (!data || !data.per_class_ap50 || Object.keys(data.per_class_ap50).length === 0)
    return <p className="text-xs text-gray-500 py-4 text-center">Per-class AP not available for this run</p>

  const entries = Object.entries(data.per_class_ap50).sort((a, b) => b[1] - a[1])
  const max = entries[0]?.[1] || 100

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <BarChart2 className="w-4 h-4 text-indigo-400" /> Per-Class AP@0.5
      </h3>
      <div className="space-y-2">
        {entries.map(([cls, ap]) => (
          <div key={cls} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-32 shrink-0 capitalize">{cls}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-2">
              <div
                className="h-2 rounded-full bg-indigo-500"
                style={{ width: `${(ap / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-white w-12 text-right font-mono">{ap.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Run comparison panel ─────────────────────────────────────────────────────
function ComparePanel({ runs }) {
  const completed = runs.filter(r => r.status === 'completed')
  const [runA, setRunA] = useState('')
  const [runB, setRunB] = useState('')
  const [cmp, setCmp] = useState(null)
  const [loading, setLoading] = useState(false)

  const compare = async () => {
    if (!runA || !runB || runA === runB) {
      toast.error('Select two different completed runs to compare'); return
    }
    setLoading(true)
    try {
      const r = await axios.get(`/evaluate/compare?run_a=${runA}&run_b=${runB}`)
      setCmp(r.data)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Comparison failed')
    } finally { setLoading(false) }
  }

  const DeltaBadge = ({ val }) => {
    if (val === null || val === undefined) return <span className="text-gray-600">—</span>
    const pct = (val * 100).toFixed(1)
    return (
      <span className={`text-xs font-mono font-bold ${val > 0 ? 'text-green-400' : val < 0 ? 'text-red-400' : 'text-gray-500'}`}>
        {val > 0 ? '▲' : val < 0 ? '▼' : '='} {Math.abs(pct)}%
      </span>
    )
  }

  const MetricRow = ({ label, a, b, delta }) => (
    <tr className="border-t border-gray-800">
      <td className="py-2 px-3 text-xs text-gray-400">{label}</td>
      <td className="py-2 px-3 text-xs text-white font-mono text-center">{a !== null ? (a * 100).toFixed(2) + '%' : '—'}</td>
      <td className="py-2 px-3 text-xs text-white font-mono text-center">{b !== null ? (b * 100).toFixed(2) + '%' : '—'}</td>
      <td className="py-2 px-3 text-center"><DeltaBadge val={delta} /></td>
    </tr>
  )

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <GitCompare className="w-4 h-4 text-purple-400" /> Run Comparison
      </h3>
      <div className="flex gap-2">
        <select value={runA} onChange={e => setRunA(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded-lg px-2 py-1.5">
          <option value="">Run A…</option>
          {completed.map(r => <option key={r.id} value={r.id}>#{r.id} {r.model_size} / {r.dataset_name}</option>)}
        </select>
        <select value={runB} onChange={e => setRunB(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded-lg px-2 py-1.5">
          <option value="">Run B…</option>
          {completed.map(r => <option key={r.id} value={r.id}>#{r.id} {r.model_size} / {r.dataset_name}</option>)}
        </select>
        <button onClick={compare} disabled={loading}
          className="bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1">
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Compare'}
        </button>
      </div>

      {cmp && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="py-1.5 px-3 text-left text-xs text-gray-500 uppercase">Metric</th>
                <th className="py-1.5 px-3 text-center text-xs text-gray-400 uppercase">#{cmp.run_a.id} {cmp.run_a.model}</th>
                <th className="py-1.5 px-3 text-center text-xs text-gray-400 uppercase">#{cmp.run_b.id} {cmp.run_b.model}</th>
                <th className="py-1.5 px-3 text-center text-xs text-gray-500 uppercase">Δ (B−A)</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow label="mAP@0.5"      a={cmp.run_a.map50}     b={cmp.run_b.map50}     delta={cmp.delta.map50} />
              <MetricRow label="mAP@0.5:0.95" a={cmp.run_a.map5095}   b={cmp.run_b.map5095}   delta={cmp.delta.map5095} />
              <MetricRow label="Precision"    a={cmp.run_a.precision}  b={cmp.run_b.precision}  delta={cmp.delta.precision} />
              <MetricRow label="Recall"       a={cmp.run_a.recall}     b={cmp.run_b.recall}     delta={cmp.delta.recall} />
              <MetricRow label="F1 Score"     a={cmp.run_a.f1_score}   b={cmp.run_b.f1_score}   delta={cmp.delta.f1_score} />
            </tbody>
          </table>
          <p className="text-xs text-gray-600 mt-2 px-3">
            ▲ green = Run B better · ▼ red = Run A better
          </p>
        </div>
      )}
    </div>
  )
}

// ── Speed benchmark panel ────────────────────────────────────────────────────
function SpeedTest() {
  const [model, setModel] = useState('yolov8s_visdrone_best')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true); setResult(null)
    try {
      const r = await axios.post(`/evaluate/speed-test?model_size=${model}&n_runs=30`)
      setResult(r.data)
      toast.success(`Speed test done: ${r.data.fps} FPS`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Speed test failed')
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <Zap className="w-4 h-4 text-yellow-400" /> Inference Speed Benchmark
      </h3>
      <div className="flex gap-2">
        <select value={model} onChange={e => setModel(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 text-xs text-gray-200 rounded-lg px-2 py-1.5">
          {EVAL_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <button onClick={run} disabled={loading}
          className="bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1 whitespace-nowrap">
          {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Testing…</> : '⚡ Run Test'}
        </button>
      </div>
      <p className="text-xs text-gray-600">30 inference runs on 640×640 images (CPU, warm-up excluded)</p>

      {loading && <p className="text-xs text-blue-400 text-center py-2">Running 30 inferences… ~1–2 min</p>}

      {result && (
        <div className="grid grid-cols-2 gap-2 mt-2">
          {[
            { label: 'Mean Latency', value: `${result.mean_ms} ms` },
            { label: 'Est. FPS',     value: `${result.fps} FPS` },
            { label: 'Std Dev',      value: `± ${result.std_ms} ms` },
            { label: 'Min / Max',    value: `${result.min_ms} / ${result.max_ms} ms` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-widest">{label}</p>
              <p className="text-white font-bold font-mono mt-1">{value}</p>
            </div>
          ))}
          <div className="col-span-2 text-xs text-gray-600">{result.note}</div>
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function Evaluate() {
  const [dataset, setDataset] = useState('visdrone')
  const [model, setModel]     = useState('yolov8s_visdrone_best')
  const [runs, setRuns]       = useState([])
  const [selectedRun, setSelectedRun] = useState(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(null)
  const [activeTab, setActiveTab] = useState('metrics') // metrics | perclass | compare | speed

  const fetchRuns = useCallback(async () => {
    try {
      const res = await axios.get('/evaluate/results')
      setRuns(res.data.runs || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchRuns() }, [fetchRuns])

  useEffect(() => {
    if (!polling) return
    const id = setInterval(async () => {
      try {
        const res = await axios.get(`/evaluate/results/${polling}`)
        const run = res.data
        if (run.status === 'completed' || run.status === 'failed') {
          clearInterval(id); setPolling(null); setLoading(false)
          if (run.status === 'completed') { setSelectedRun(run); toast.success('Evaluation complete!') }
          else toast.error(`Evaluation failed: ${run.error_message}`)
          fetchRuns()
        }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(id)
  }, [polling, fetchRuns])

  const handleRun = async () => {
    if (INCOMPATIBLE(model, dataset)) {
      const msg = model === 'yolov8s_visdrone_best'
        ? 'Dataset mismatch: VisDrone model (10 aerial classes) cannot be evaluated on COCO (80 different classes).'
        : 'Dataset mismatch: COCO model cannot be meaningfully evaluated on VisDrone dataset.'
      toast.error(msg, { duration: 6000 }); return
    }
    setLoading(true); setSelectedRun(null)
    try {
      const res = await axios.post('/evaluate/run', null, {
        params: { dataset_name: dataset, model_size: model },
      })
      toast('Evaluation started — this may take a few minutes…', { icon: '⏳' })
      setPolling(res.data.run_id); fetchRuns()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start evaluation')
      setLoading(false)
    }
  }

  const loadRun = async (run) => {
    try {
      const res = await axios.get(`/evaluate/results/${run.id}`)
      setSelectedRun(res.data); setActiveTab('metrics')
    } catch { toast.error('Could not load run details') }
  }

  const TABS = [
    { id: 'metrics',  label: '📊 Metrics',    show: !!selectedRun },
    { id: 'perclass', label: '🎯 Per-Class',  show: !!selectedRun },
    { id: 'compare',  label: '⚖️ Compare',    show: true },
    { id: 'speed',    label: '⚡ Speed Test', show: true },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Model Evaluation</h1>
        <p className="text-gray-400 text-sm mt-1">Run YOLOv8 on benchmark datasets and compute F1, mAP, ROC-AUC, Confusion Matrix</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* ── Config + Past Runs ── */}
        <div className="col-span-1 space-y-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-4">
            <h2 className="font-semibold text-white">Run Configuration</h2>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">Dataset</label>
              <select value={dataset} onChange={e => setDataset(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
                <optgroup label="── VisDrone (Aerial Traffic)">
                  {DATASETS.filter(d => d.group === 'VisDrone').map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </optgroup>
                <optgroup label="── COCO (General Object Detection)">
                  {DATASETS.filter(d => d.group === 'COCO').map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </optgroup>
              </select>
              {dataset === 'visdrone' && (
                <p className="text-xs text-sky-400 mt-1">ℹ️ First run auto-downloads val split (~78 MB).</p>
              )}
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest mb-1 block">Model</label>
              <select value={model} onChange={e => setModel(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500">
                <optgroup label="── Fine-Tuned (VisDrone)">
                  {EVAL_MODELS.filter(m => m.group === 'Fine-Tuned').map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </optgroup>
                <optgroup label="── COCO Pretrained Baselines">
                  {EVAL_MODELS.filter(m => m.group === 'COCO Baseline').map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </optgroup>
              </select>
            </div>

            <button onClick={handleRun} disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-2.5 rounded-lg font-semibold transition-colors">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</> : <><PlayCircle className="w-4 h-4" /> Run Evaluation</>}
            </button>
            {loading && <p className="text-xs text-gray-500 text-center">Runs in background. Results auto-load when done.</p>}
          </div>

          {/* Past runs */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white text-sm">Past Runs</h2>
              <button onClick={fetchRuns} className="text-gray-500 hover:text-gray-300"><RefreshCw className="w-3.5 h-3.5" /></button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {runs.length === 0 && <p className="text-gray-600 text-xs text-center py-4">No runs yet</p>}
              {runs.map(run => (
                <button key={run.id} onClick={() => loadRun(run)}
                  className="w-full text-left bg-gray-800 hover:bg-gray-700 rounded-lg p-2.5 border border-gray-700 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white font-medium">#{run.id} {run.dataset_name} / {run.model_size}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_COLOR[run.status] || ''}`}>{run.status}</span>
                  </div>
                  {run.map50 && (
                    <p className="text-xs text-gray-500 mt-0.5">mAP@0.5: {(run.map50 * 100).toFixed(1)}%  F1: {(run.f1_score * 100).toFixed(1)}%</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Results panel ── */}
        <div className="col-span-2 space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 bg-gray-900 rounded-xl border border-gray-800 p-1">
            {TABS.filter(t => t.show).map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-1 text-xs py-2 rounded-lg font-medium transition-colors ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Metrics tab */}
          {activeTab === 'metrics' && (
            !selectedRun ? (
              <div className="min-h-64 flex items-center justify-center bg-gray-900 rounded-xl border border-gray-800 border-dashed">
                <p className="text-gray-600 text-sm">Select a completed run to view metrics</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <MetricsCard label="mAP@0.5"      value={selectedRun.map50}     icon="🎯" color="indigo" />
                  <MetricsCard label="mAP@0.5:0.95" value={selectedRun.map5095}   icon="📊" color="blue"   />
                  <MetricsCard label="F1 Score"      value={selectedRun.f1_score}  icon="⚖️" color="green"  />
                  <MetricsCard label="Precision"     value={selectedRun.precision} icon="🔬" color="purple" />
                  <MetricsCard label="Recall"        value={selectedRun.recall}    icon="🔭" color="orange" />
                  <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 flex flex-col justify-center">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Model</p>
                    <p className="text-white font-bold mt-1 text-sm">{selectedRun.model_size}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{selectedRun.dataset_name}</p>
                  </div>
                </div>
                {selectedRun.charts && Object.keys(selectedRun.charts).length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(selectedRun.charts).map(([key, url]) => (
                      <div key={key} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                        <p className="text-xs text-gray-500 text-center py-2 border-b border-gray-800 capitalize">{key.replace(/_/g, ' ')}</p>
                        <img src={url} alt={key} className="w-full object-contain" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {/* Per-class tab */}
          {activeTab === 'perclass' && selectedRun && (
            <PerClassTable runId={selectedRun.id} />
          )}

          {/* Compare tab */}
          {activeTab === 'compare' && <ComparePanel runs={runs} />}

          {/* Speed test tab */}
          {activeTab === 'speed' && <SpeedTest />}
        </div>
      </div>
    </div>
  )
}
