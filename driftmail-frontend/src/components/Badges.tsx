import React from 'react'
import { CATEGORY_COLORS, PRIORITY_COLORS, formatCategory } from '../utils/colors'

export const CategoryBadge = ({ category }: { category: string }) => {
  const c = CATEGORY_COLORS[category] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {formatCategory(category)}
    </span>
  )
}

export const PriorityBadge = ({ priority }: { priority: string }) => {
  const c = PRIORITY_COLORS[priority] ?? { bg: 'bg-gray-100', text: 'text-gray-500' }
  const icons: Record<string, string> = { high: '▲', medium: '●', low: '▼' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${c.bg} ${c.text}`}>
      <span className="text-[9px]">{icons[priority] ?? '●'}</span>
      {priority}
    </span>
  )
}

export const ConfidenceBar = ({ label, value }: { label: string; value: number }) => (
  <div className="space-y-1">
    <div className="flex justify-between text-xs text-slate-500">
      <span>{label}</span>
      <span className="font-medium text-slate-700">{Math.round(value * 100)}%</span>
    </div>
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-[#6C63FF] to-[#8B84FF] rounded-full transition-all duration-700"
        style={{ width: `${value * 100}%` }}
      />
    </div>
  </div>
)
