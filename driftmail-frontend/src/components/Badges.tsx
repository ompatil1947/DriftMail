import React from 'react'
import { motion } from 'framer-motion'
import { CATEGORY_COLORS, PRIORITY_COLORS, formatCategory } from '../utils/colors'

export const CategoryBadge = ({ category }: { category: string }) => {
  const c = CATEGORY_COLORS[category] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${c.bg} ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`} />
      {formatCategory(category)}
    </span>
  )
}

export const PriorityBadge = ({ priority }: { priority: string }) => {
  const c = PRIORITY_COLORS[priority] ?? { bg: 'bg-gray-100', text: 'text-gray-500' }
  const icons: Record<string, string> = { high: '▲', medium: '●', low: '▼' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${c.bg} ${c.text}`}>
      <span className="text-[11px]">{icons[priority] ?? '●'}</span>
      {priority}
    </span>
  )
}

export const ConfidenceBar = ({ label, value }: { label: string; value: number }) => (
  <div className="space-y-2">
    <div className="flex justify-between items-baseline">
      <span className="text-[13px] font-bold text-[#333] uppercase tracking-wide">{label}</span>
      <span className="text-[18px] font-bold text-[#0A0A0A]">{Math.round(value * 100)}%</span>
    </div>
    <div className="h-4 bg-[#D4C5A9] rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value * 100}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="h-full bg-[#0A0A0A] rounded-full"
      />
    </div>
  </div>
)
