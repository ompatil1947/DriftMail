import React from 'react'
import { CATEGORIES, PRIORITIES, useFilterStore } from '../store/filterStore'
import { CATEGORY_COLORS, PRIORITY_COLORS, formatCategory } from '../utils/colors'

const PRIORITY_ICONS: Record<string, string> = { high: '▲', medium: '●', low: '▼' }

export default function Sidebar({ onAddEmail }: { onAddEmail: () => void }) {
  const {
    categories, priorities, search,
    toggleCategory, togglePriority, setSearch
  } = useFilterStore()

  return (
    <aside className="w-[280px] flex-shrink-0 flex flex-col h-full bg-[#F2EDE3] border-r border-[#E0D8CC] overflow-hidden">

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-8 space-y-10">

        {/* Search */}
        <div className="space-y-3">
          <label className="text-[11px] font-bold text-[#0A0A0A] uppercase tracking-[0.15em]">Search</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999] text-sm">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Subject or body…"
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-white border border-[#E0D8CC] text-[14px] text-[#0A0A0A] placeholder-[#B0A898] focus:outline-none focus:border-[#0A0A0A] transition-colors"
            />
          </div>
        </div>

        {/* Category */}
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-[#0A0A0A] uppercase tracking-[0.15em]">Category</label>
            <p className="text-[11px] text-[#999] mt-1">ML Text Classification</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => {
              const active = categories.includes(cat)
              const c = CATEGORY_COLORS[cat]
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`haptic text-[12px] px-3 py-1.5 rounded-lg font-semibold transition-all border ${
                    active
                      ? `${c.bg} ${c.text} border-transparent`
                      : 'bg-white border-[#E0D8CC] text-[#555] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                  }`}
                >
                  {formatCategory(cat)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-[#0A0A0A] uppercase tracking-[0.15em]">Priority</label>
            <p className="text-[11px] text-[#999] mt-1">Priority Scoring Model</p>
          </div>
          <div className="space-y-2">
            {PRIORITIES.map((pri) => {
              const active = priorities.includes(pri)
              const c = PRIORITY_COLORS[pri]
              return (
                <button
                  key={pri}
                  onClick={() => togglePriority(pri)}
                  className={`haptic w-full py-3 rounded-xl border text-[13px] font-bold capitalize transition-all flex items-center justify-center gap-2 ${
                    active
                      ? `${c.bg} ${c.text} border-transparent`
                      : 'bg-white border-[#E0D8CC] text-[#555] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
                  }`}
                >
                  <span className="text-[11px]">{PRIORITY_ICONS[pri]}</span> {pri}
                </button>
              )
            })}
          </div>
        </div>

      </div>

      {/* Bottom add button */}
      <div className="px-6 py-6 border-t border-[#E0D8CC]">
        <button
          onClick={onAddEmail}
          className="haptic w-full py-3.5 rounded-xl bg-[#0A0A0A] text-white text-[13px] font-bold hover:bg-[#1A1A1A] transition-colors"
        >
          + Add Email
        </button>
      </div>
    </aside>
  )
}
