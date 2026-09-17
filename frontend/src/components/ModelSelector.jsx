const MODELS = [
  { value: 'yolov8s_visdrone_best', label: '🏆 VisDrone Fine-tuned', tag: '56% mAP · Best', tagColor: 'text-indigo-400' },
  { value: 'yolov8n', label: 'YOLOv8 Nano',   tag: '⚡ Fastest',  tagColor: 'text-green-400' },
  { value: 'yolov8s', label: 'YOLOv8 Small',  tag: '⚖️ Balanced', tagColor: 'text-yellow-400' },
  { value: 'yolov8m', label: 'YOLOv8 Medium', tag: '🎯 Accurate', tagColor: 'text-orange-400' },
]

export default function ModelSelector({ value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-400 font-medium whitespace-nowrap">Model:</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-gray-800 border border-gray-700 text-sm text-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500"
      >
        {MODELS.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
      <span className={`text-xs font-medium ${MODELS.find((m) => m.value === value)?.tagColor}`}>
        {MODELS.find((m) => m.value === value)?.tag}
      </span>
    </div>
  )
}
