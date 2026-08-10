import React from 'react'
import { CATEGORIES, PRIORITIES, useFilterStore } from '../store/filterStore'
import { CATEGORY_COLORS, PRIORITY_COLORS, formatCategory } from '../utils/colors'

const PRIORITY_ICONS: Record<string, string> = { high: '▲', medium: '●', low: '▼' }

export default function Sidebar({ onAddEmail }: { onAddEmail: () => void }) {
  const {
    categories, priorities,
    toggleCategory, togglePriority
  } = useFilterStore()

  return (
    <aside className="w-[340px] flex-shrink-0 flex flex-col h-full bg-[#E8DEC8] border-r border-[#D4C5A9] overflow-hidden">

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-8 py-10 space-y-12">

        {/* Category */}
        <div className="space-y-5">
          <div>
            <label className="text-[13px] font-bold text-[#0A0A0A] uppercase tracking-[0.2em]">Category</label>
            <p className="text-[13px] text-[#444] mt-1.5 font-medium">Bidirectional GRU Classification</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {CATEGORIES.map((cat) => {
              const active = categories.includes(cat)
              const c = CATEGORY_COLORS[cat]
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`haptic text-[14px] px-4 py-2.5 rounded-lg font-bold transition-all border ${
                    active
                      ? `${c.bg} ${c.text} border-transparent`
                      : 'bg-white border-[#D4C5A9] text-[#333] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                  }`}
                >
                  {formatCategory(cat)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-5">
          <div>
            <label className="text-[13px] font-bold text-[#0A0A0A] uppercase tracking-[0.2em]">Priority</label>
            <p className="text-[13px] text-[#444] mt-1.5 font-medium">Priority Scoring Model</p>
          </div>
          <div className="space-y-3">
            {PRIORITIES.map((pri) => {
              const active = priorities.includes(pri)
              const c = PRIORITY_COLORS[pri]
              return (
                <button
                  key={pri}
                  onClick={() => togglePriority(pri)}
                  className={`haptic w-full py-4 rounded-xl border text-[15px] font-bold capitalize transition-all flex items-center justify-center gap-2 ${
                    active
                      ? `${c.bg} ${c.text} border-transparent`
                      : 'bg-white border-[#D4C5A9] text-[#333] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                  }`}
                >
                  <span className="text-[12px]">{PRIORITY_ICONS[pri]}</span> {pri}
                </button>
              )
            })}
          </div>
        </div>
        
      </div>

      {/* Bottom add button */}
      <div className="px-8 py-8 border-t border-[#D4C5A9]">
        <button
          onClick={onAddEmail}
          className="haptic w-full py-4 rounded-xl bg-[#0A0A0A] text-white text-[15px] font-bold hover:bg-[#1A1A1A] transition-colors"
        >
          + Add Email
        </button>
      </div>
    </aside>
  )
}
