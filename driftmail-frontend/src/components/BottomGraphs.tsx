import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { listEmails } from '../api/client'
import { PRIORITY_COLORS, CATEGORY_COLORS, formatCategory } from '../utils/colors'

const MassiveDonut = ({ data, title, subtitle }: { data: { label: string, val: number, color: string }[], title: string, subtitle: string }) => {
  const total = data.reduce((acc, curr) => acc + curr.val, 0)
  if (total === 0) return null

  let offset = 25 
  
  return (
    <div className="flex flex-col items-center gap-10 bg-white border border-[#D4C5A9] rounded-[32px] p-10 flex-1 shadow-sm">
      
      {/* Title */}
      <div className="text-center space-y-2">
        <h3 className="text-[32px] font-black text-[#0A0A0A] tracking-tight">{title}</h3>
        <p className="text-[16px] text-[#666] font-medium">{subtitle}</p>
      </div>

      {/* Chart */}
      <div className="relative w-[280px] h-[280px] flex-shrink-0">
        <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90 drop-shadow-md">
          <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#E8DEC8" strokeWidth="4" />
          {data.map((item, i) => {
            if (item.val === 0) return null
            const pct = (item.val / total) * 100
            const dash = `${pct} ${100 - pct}`
            const currentOffset = offset
            offset -= pct
            return (
              <circle
                key={i}
                cx="21"
                cy="21"
                r="15.91549430918954"
                fill="transparent"
                stroke={item.color}
                strokeWidth="4"
                strokeDasharray={dash}
                strokeDashoffset={currentOffset}
                className="transition-all duration-1000 ease-out"
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#0A0A0A]">
          <span className="text-[56px] font-black leading-none tracking-tight">{total}</span>
          <span className="text-[16px] font-bold text-[#888] mt-1 uppercase tracking-[0.2em]">Total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="w-full max-w-md space-y-5 mt-2">
        {data.sort((a,b) => b.val - a.val).slice(0, 4).map((item, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-5 h-5 rounded-full shadow-inner" style={{ backgroundColor: item.color }} />
              <span className="text-[20px] text-[#222] font-bold">{item.label}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[20px] text-[#888] font-bold">{item.val}</span>
              <span className="text-[20px] font-black text-[#0A0A0A] w-16 text-right">{Math.round((item.val / total) * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BottomGraphs() {
  const { data: allEmails = [] } = useQuery({
    queryKey: ['emails', {}],
    queryFn: () => listEmails({}),
    refetchInterval: 10000,
  })

  if (allEmails.length === 0) return (
    <div className="w-full flex items-center justify-center">
      <span className="text-2xl font-bold text-[#888]">No data to display graphs. Sync your inbox!</span>
    </div>
  )

  // Process Priorities
  const pCount = { high: 0, medium: 0, low: 0 }
  allEmails.forEach(e => {
    if (pCount[e.priority as keyof typeof pCount] !== undefined) {
      pCount[e.priority as keyof typeof pCount]++
    }
  })
  
  const twHex: Record<string, string> = {
    'bg-red-400': '#f87171', 'bg-amber-400': '#fbbf24', 'bg-emerald-400': '#34d399',
    'bg-blue-400': '#60a5fa', 'bg-pink-400': '#f472b6', 'bg-indigo-400': '#818cf8',
    'bg-teal-400': '#2dd4bf', 'bg-slate-400': '#94a3b8', 'bg-violet-400': '#a78bfa'
  }

  const pData = [
    { label: 'High Priority', val: pCount.high, color: '#f87171' },
    { label: 'Medium Priority', val: pCount.medium, color: '#fbbf24' },
    { label: 'Low Priority', val: pCount.low, color: '#34d399' }
  ]

  // Process Categories
  const cCount: Record<string, number> = {}
  allEmails.forEach(e => {
    cCount[e.category] = (cCount[e.category] || 0) + 1
  })
  
  const cData = Object.entries(cCount).map(([cat, count]) => {
    const dotClass = CATEGORY_COLORS[cat]?.dot || 'bg-gray-400'
    return {
      label: formatCategory(cat),
      val: count,
      color: twHex[dotClass] || '#9ca3af'
    }
  })

  return (
    <div className="w-full max-w-[1100px] flex gap-12 items-center justify-center">
      <MassiveDonut data={pData} title="Priority Analytics" subtitle="Priority Scoring Model Output" />
      <MassiveDonut data={cData} title="Category Classification" subtitle="BIGRU Text Classification Output" />
    </div>
  )
}
