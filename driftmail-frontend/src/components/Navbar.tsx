import React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getAuthStatus, syncGmailInbox, disconnectGmail } from '../api/client'

export default function Navbar() {
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = React.useState(false)

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

      {/* Right controls (pushed to far right via ml-auto on the wrapper) */}
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
      </div>
    </nav>
  )
}
