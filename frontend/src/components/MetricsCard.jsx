export default function MetricsCard({ label, value, unit = '', icon, color = 'indigo' }) {
  const colorMap = {
    indigo: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-400',
    green:  'border-green-500/30  bg-green-500/5  text-green-400',
    blue:   'border-blue-500/30   bg-blue-500/5   text-blue-400',
    orange: 'border-orange-500/30 bg-orange-500/5 text-orange-400',
    purple: 'border-purple-500/30 bg-purple-500/5 text-purple-400',
  }

  const display = value !== null && value !== undefined
    ? typeof value === 'number'
      ? (value <= 1 ? (value * 100).toFixed(1) + '%' : value.toFixed(4))
      : value
    : '—'

  return (
    <div className={`rounded-xl border p-4 ${colorMap[color] || colorMap.indigo}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-widest text-gray-500 font-semibold">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      <div className="text-2xl font-bold text-white">{display}</div>
      {unit && <div className="text-xs text-gray-500 mt-1">{unit}</div>}
    </div>
  )
}
