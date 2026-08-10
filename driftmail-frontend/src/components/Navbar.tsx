import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { getAuthStatus, syncGmailInbox, disconnectGmail, listEmails } from '../api/client'

export default function Navbar({ onAddEmail }: { onAddEmail: () => void }) {
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = React.useState(false)

  const { data: authStatus, refetch: refetchAuth } = useQuery({
    queryKey: ['auth-status'],
    queryFn: getAuthStatus,
    refetchInterval: 30000,
  })

  const { data: allEmails = [] } = useQuery({
    queryKey: ['emails', {}],
    queryFn: () => listEmails({}),
    refetchInterval: 10000,
  })

  const total  = allEmails.length
  const high   = allEmails.filter(e => e.priority === 'high').length
  const medium = allEmails.filter(e => e.priority === 'medium').length
  const low    = allEmails.filter(e => e.priority === 'low').length
  const pct    = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0

  const handleSync = async () => {
    if (!authStatus?.connected) {
      window.location.href = 'http://localhost:8000/auth/google/login'
      return
    }
    setSyncing(true)
    try {
      const newEmails = await syncGmailInbox(20)
      await queryClient.invalidateQueries({ queryKey: ['emails'] })
      toast.success(newEmails.length === 0
        ? 'Inbox up to date'
        : `Synced ${newEmails.length} email${newEmails.length !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Sync failed — check connection')
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
    <nav className="h-[88px] flex-shrink-0 bg-[#0A0A0A] flex items-center px-8 gap-10 z-30 border-b border-[#1A1A1A]">

      {/* Logo */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center">
          <svg className="w-6 h-6 text-[#0A0A0A]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
          </svg>
        </div>
        <span className="font-sora font-bold text-2xl text-white tracking-tight">DriftMail</span>
      </div>

      {/* Priority distribution — the ML output showcase */}
      {total > 0 && (
        <div className="flex items-center gap-6 flex-1">
          {/* Stacked bar */}
          <div className="flex h-3.5 rounded-full overflow-hidden bg-white/10 w-56 flex-shrink-0">
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct(high)}%` }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
              className="bg-red-400 h-full" />
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct(medium)}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
              className="bg-amber-400 h-full" />
            <motion.div initial={{ width: 0 }} animate={{ width: `${pct(low)}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
              className="bg-emerald-400 h-full" />
          </div>

          {/* Labels */}
          <div className="flex items-center gap-6">
            {[
              { label: 'High',   n: high,   color: 'text-red-400',     dot: 'bg-red-400' },
              { label: 'Medium', n: medium, color: 'text-amber-400',   dot: 'bg-amber-400' },
              { label: 'Low',    n: low,    color: 'text-emerald-400', dot: 'bg-emerald-400' },
            ].map(({ label, n, color, dot }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${dot}`} />
                <span className={`text-[15px] font-bold ${color}`}>{pct(n)}%</span>
                <span className="text-[14px] font-medium text-white/40">{label}</span>
              </div>
            ))}
            <span className="text-[14px] font-medium text-white/30 ml-2">{total} total emails</span>
          </div>
        </div>
      )}

      {/* Right controls */}
      <div className="flex items-center gap-4 ml-auto flex-shrink-0">
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-[14px] font-bold ${
          authStatus?.connected
            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
            : 'border-white/10 text-white/40 bg-white/5'
        }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${authStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
          {authStatus?.connected ? 'Gmail Connected' : 'Not Connected'}
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="haptic px-6 py-3.5 rounded-xl bg-white text-[#0A0A0A] text-[15px] font-bold hover:bg-white/90 disabled:opacity-50 transition-colors"
        >
          {syncing ? '⟳ Syncing…' : '⟳ Sync Inbox'}
        </button>

        {authStatus?.connected && (
          <button onClick={handleDisconnect}
            className="haptic w-12 h-12 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/20 hover:border-red-500/30 flex items-center justify-center text-white/40 hover:text-red-400 transition-colors text-lg"
            title="Disconnect Gmail">✕</button>
        )}

        <button onClick={onAddEmail}
          className="haptic px-6 py-3.5 rounded-xl bg-white/10 border border-white/15 text-white text-[15px] font-bold hover:bg-white/20 transition-colors">
          + Add Email
        </button>
      </div>
    </nav>
  )
}
