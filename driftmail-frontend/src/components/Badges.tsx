import React from 'react'
import { motion } from 'framer-motion'
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
  <div className="space-y-1.5">
    <div className="flex justify-between items-baseline">
      <span className="text-[11px] font-semibold text-[#555] uppercase tracking-wide">{label}</span>
      <span className="text-[15px] font-bold text-[#0A0A0A]">{Math.round(value * 100)}%</span>
    </div>
    <div className="h-3 bg-[#EDE8DC] rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value * 100}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="h-full bg-[#0A0A0A] rounded-full"
      />
    </div>
  </div>
)
