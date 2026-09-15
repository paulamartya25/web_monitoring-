const ACTIVITY_MAP = {
  Stationary:        { bg: 'bg-gray-700',   text: 'text-gray-300',   emoji: '🧍' },
  Walking:           { bg: 'bg-blue-900',   text: 'text-blue-300',   emoji: '🚶' },
  Jogging:           { bg: 'bg-yellow-900', text: 'text-yellow-300', emoji: '🏃' },
  Running:           { bg: 'bg-orange-900', text: 'text-orange-300', emoji: '💨' },
  Interacting:       { bg: 'bg-purple-900', text: 'text-purple-300', emoji: '🤝' },
  Parked:            { bg: 'bg-slate-800',  text: 'text-slate-300',  emoji: '🅿️' },
  'Moving slowly':   { bg: 'bg-teal-900',   text: 'text-teal-300',   emoji: '🐢' },
  'Moving fast':     { bg: 'bg-red-900',    text: 'text-red-300',    emoji: '🚀' },
}

export default function ActivityBadge({ activity }) {
  if (!activity) return null

  // Match on the primary part before "· Interacting"
  const primary = activity.split('·')[0].trim()
  const hasInteraction = activity.includes('Interacting')
  const style = ACTIVITY_MAP[primary] || { bg: 'bg-slate-800', text: 'text-slate-300', emoji: '❓' }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
      <span>{style.emoji}</span>
      <span>{primary}</span>
      {hasInteraction && <span className="ml-1 text-purple-400">· 🤝</span>}
    </span>
  )
}
