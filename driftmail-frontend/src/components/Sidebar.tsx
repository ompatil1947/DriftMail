import React, { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { getAuthStatus, syncGmailInbox, disconnectGmail } from '../api/client'
import { CATEGORIES, PRIORITIES, useFilterStore } from '../store/filterStore'
import { CATEGORY_COLORS, PRIORITY_COLORS, formatCategory } from '../utils/colors'

const PRIORITY_ICONS: Record<string, string> = { high: '▲', medium: '●', low: '▼' }

export default function Sidebar({ onAddEmail }: { onAddEmail: () => void }) {
  const {
    categories, priorities, starred, pinned, search,
    toggleCategory, togglePriority, toggleStarred, togglePinned, setSearch
  } = useFilterStore()

  const [syncing, setSyncing] = useState(false)
  const queryClient = useQueryClient()

  const { data: authStatus, refetch: refetchAuth } = useQuery({
    queryKey: ['auth-status'],
    queryFn: getAuthStatus,
    refetchInterval: 30000,
  })

  const handleSync = async () => {
    if (!authStatus?.connected) {
      window.location.href = 'http://localhost:8000/auth/google/login'
      return
    }
    setSyncing(true)
    try {
      const newEmails = await syncGmailInbox(20)
      // Invalidate the emails cache so InboxList refetches from DB immediately
      await queryClient.invalidateQueries({ queryKey: ['emails'] })
      if (newEmails.length === 0) {
        toast.success('Inbox up to date — no new emails')
      } else {
        toast.success(`✓ Synced ${newEmails.length} new email${newEmails.length !== 1 ? 's' : ''} from Gmail`)
      }
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Gmail sync failed — check connection')
    } finally {
      setSyncing(false)
    }
  }

  const handleDisconnect = async () => {
    await disconnectGmail()
    await refetchAuth()
    toast('Gmail disconnected', { icon: '🔌' })
  }

  return (
    <aside className="w-[280px] flex-shrink-0 bg-[#1A1A2E] flex flex-col h-full overflow-hidden">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-[#2E2E50]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#8B84FF] flex items-center justify-center shadow-lg">
            <span className="text-white text-sm font-bold">D</span>
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm tracking-wide">DriftMail</h1>
            <p className="text-[#6C7086] text-[10px]">AI Email Intelligence</p>
          </div>
        </div>
      </div>

      {/* Gmail Status */}
      <div className="px-4 py-3 border-b border-[#2E2E50]">
        <div className={`rounded-xl p-3 ${authStatus?.connected ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-[#252542] border border-[#2E2E50]'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${authStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span className="text-xs font-medium text-slate-200">
                {authStatus?.connected ? 'Gmail Connected' : 'Gmail Disconnected'}
              </span>
            </div>
          </div>
          {authStatus?.connected ? (
            <div className="flex gap-2">
              <button
                onClick={handleSync}
                disabled={syncing}
                className="haptic flex-1 text-[11px] py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-60"
              >
                {syncing ? 'Syncing…' : '⟳ Sync Inbox'}
              </button>
              <button
                onClick={handleDisconnect}
                className="haptic text-[11px] py-1.5 px-2 rounded-lg bg-slate-500/20 text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={handleSync}
              className="haptic w-full text-[11px] py-1.5 rounded-lg bg-[#6C63FF] text-white font-medium hover:bg-[#8B84FF] transition-colors"
            >
              Connect Gmail →
            </button>
          )}
        </div>
      </div>

      {/* Scrollable filter section */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-5">
        {/* Search */}
        <div>
          <label className="text-[10px] font-semibold text-[#6C7086] uppercase tracking-widest">Search</label>
          <div className="mt-2 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6C7086] text-xs">⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Subject or body…"
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#252542] border border-[#2E2E50] text-white text-xs placeholder-[#6C7086] focus:outline-none focus:border-[#6C63FF] transition-colors"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-2">
          <button
            onClick={toggleStarred}
            className={`haptic flex-1 text-[11px] py-1.5 rounded-xl border font-medium transition-all ${
              starred
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-[#252542] border-[#2E2E50] text-[#6C7086] hover:text-slate-300'
            }`}
          >
            ★ Starred
          </button>
          <button
            onClick={togglePinned}
            className={`haptic flex-1 text-[11px] py-1.5 rounded-xl border font-medium transition-all ${
              pinned
                ? 'bg-[#6C63FF]/20 border-[#6C63FF]/40 text-[#8B84FF]'
                : 'bg-[#252542] border-[#2E2E50] text-[#6C7086] hover:text-slate-300'
            }`}
          >
            📌 Pinned
          </button>
        </div>

        {/* Categories */}
        <div>
          <label className="text-[10px] font-semibold text-[#6C7086] uppercase tracking-widest">Category</label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const active = categories.includes(cat)
              const c = CATEGORY_COLORS[cat]
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={`haptic text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all border ${
                    active
                      ? `${c.bg} ${c.text} border-transparent shadow-sm`
                      : 'bg-[#252542] border-[#2E2E50] text-[#6C7086] hover:text-slate-300 hover:border-[#3E3E60]'
                  }`}
                >
                  {formatCategory(cat)}
                </button>
              )
            })}
          </div>
        </div>

        {/* Priorities */}
        <div>
          <label className="text-[10px] font-semibold text-[#6C7086] uppercase tracking-widest">Priority</label>
          <div className="mt-2 flex gap-1.5">
            {PRIORITIES.map((pri) => {
              const active = priorities.includes(pri)
              const c = PRIORITY_COLORS[pri]
              return (
                <button
                  key={pri}
                  onClick={() => togglePriority(pri)}
                  className={`haptic flex-1 text-[11px] py-1.5 rounded-xl border font-semibold capitalize transition-all ${
                    active
                      ? `${c.bg} ${c.text} border-transparent`
                      : 'bg-[#252542] border-[#2E2E50] text-[#6C7086] hover:text-slate-300'
                  }`}
                >
                  {PRIORITY_ICONS[pri]} {pri}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Add Email button */}
      <div className="px-4 py-4 border-t border-[#2E2E50]">
        <button
          onClick={onAddEmail}
          className="haptic w-full py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#8B84FF] text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-[#6C63FF]/20"
        >
          + Add Email
        </button>
      </div>
    </aside>
  )
}
