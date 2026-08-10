import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  getEmail, getQAHistory, askEmail, patchEmail,
  type QAHistoryItem
} from '../api/client'
import { useFilterStore } from '../store/filterStore'
import { CategoryBadge, PriorityBadge, ConfidenceBar } from './Badges'

// ── Grounded / Ungrounded Q&A bubble ─────────────────────────────────────────
function QABubble({ item }: { item: QAHistoryItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
    >
      {/* Question */}
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-[#6C63FF] text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
          {item.question}
        </div>
      </div>

      {/* Answer */}
      <div className="flex justify-start">
        {item.grounded ? (
          <div className="max-w-[85%] bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-700 leading-relaxed">
            {item.answer}
          </div>
        ) : (
          <div className="max-w-[85%] border border-dashed border-slate-300 bg-slate-50 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-slate-400 leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1 text-slate-400">
              <span className="text-base">🔍</span>
              <span className="text-[11px] font-semibold uppercase tracking-wider">Not found in context</span>
            </div>
            <span className="italic">{item.answer}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Ask input ─────────────────────────────────────────────────────────────────
function AskInput({ emailId, onAsked }: { emailId: number; onAsked: () => void }) {
  const [question, setQuestion] = useState('')
  const qc = useQueryClient()

  const { mutate: ask, isPending } = useMutation({
    mutationFn: () => askEmail(emailId, question),
    onSuccess: () => {
      setQuestion('')
      qc.invalidateQueries({ queryKey: ['qa-history', emailId] })
      onAsked()
    },
    onError: () => toast.error('Failed to get answer'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim() || isPending) return
    ask()
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-4 border-t border-slate-100">
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask about this email…"
        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/10 transition-all placeholder-slate-400"
        disabled={isPending}
      />
      <button
        type="submit"
        disabled={!question.trim() || isPending}
        className="haptic px-4 py-2.5 rounded-xl bg-[#6C63FF] text-white text-sm font-semibold hover:bg-[#8B84FF] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {isPending ? '…' : 'Ask'}
      </button>
    </form>
  )
}

// ── Main Detail Panel ─────────────────────────────────────────────────────────
export default function DetailPanel() {
  const { selectedEmailId, selectEmail } = useFilterStore()
  const qc = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)

  const { data: email } = useQuery({
    queryKey: ['email', selectedEmailId],
    queryFn: () => getEmail(selectedEmailId!),
    enabled: !!selectedEmailId,
  })

  const { data: qaHistory = [] } = useQuery({
    queryKey: ['qa-history', selectedEmailId],
    queryFn: () => getQAHistory(selectedEmailId!),
    enabled: !!selectedEmailId,
  })

  const { mutate: toggleStar } = useMutation({
    mutationFn: (starred: boolean) => patchEmail(selectedEmailId!, { starred }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: ['email', selectedEmailId] })
    },
  })

  const { mutate: togglePin } = useMutation({
    mutationFn: (pinned: boolean) => patchEmail(selectedEmailId!, { pinned }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      qc.invalidateQueries({ queryKey: ['email', selectedEmailId] })
    },
  })

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 100)
  }

  useEffect(() => {
    scrollToBottom()
  }, [qaHistory.length])

  // Loading skeleton while email data is being fetched
  if (!email) {
    return (
      <motion.div
        initial={{ x: 420, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 420, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="absolute right-0 top-0 bottom-0 w-[420px] flex-shrink-0 flex flex-col bg-white border-l border-slate-100 overflow-hidden shadow-2xl z-20 items-center justify-center"
      >
        <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ x: 420, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 420, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="absolute right-0 top-0 bottom-0 w-[420px] flex-shrink-0 flex flex-col bg-white border-l border-slate-200 overflow-hidden shadow-2xl z-20"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0 bg-white">
        <div className="flex items-start justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-800 leading-snug">{email.subject}</h2>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => togglePin(!email.pinned)}
              className={`haptic text-lg transition-colors ${email.pinned ? 'text-[#6C63FF]' : 'text-slate-300 hover:text-[#6C63FF]'}`}
              title={email.pinned ? 'Unpin' : 'Pin'}
            >
              📌
            </button>
            <button
              onClick={() => toggleStar(!email.starred)}
              className={`haptic text-lg transition-colors ${email.starred ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400'}`}
              title={email.starred ? 'Unstar' : 'Star'}
            >
              {email.starred ? '★' : '☆'}
            </button>
            <button
              onClick={() => selectEmail(null)}
              className="haptic w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors ml-1 text-sm"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {email.sender && (
          <p className="text-xs text-slate-500 mb-2 truncate">From: {email.sender}</p>
        )}

        <div className="flex gap-1.5 flex-wrap mb-3">
          <CategoryBadge category={email.category} />
          <PriorityBadge priority={email.priority} />
        </div>

        <div className="space-y-2">
          <ConfidenceBar label="Category confidence" value={email.category_confidence} />
          <ConfidenceBar label="Priority confidence" value={email.priority_confidence} />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex-1 overflow-y-auto scrollbar-thin min-h-0" ref={scrollRef}>
        {/* Email body */}
        <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap border-b border-slate-100 pb-4 mb-4">
          {email.body || <span className="text-slate-400 italic">(empty body)</span>}
        </div>

        {/* Q&A thread */}
        {qaHistory.length > 0 && (
          <div className="space-y-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Q&A History</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
            {qaHistory.map((item) => (
              <QABubble key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Ask AI section */}
      <div className="flex-shrink-0 border-t border-slate-100 bg-white">
        <div className="px-5 pt-3 pb-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#6C63FF] to-[#8B84FF] flex items-center justify-center">
              <span className="text-white text-[10px]">✦</span>
            </div>
            <span className="text-xs font-semibold text-slate-600">Ask AI about this email</span>
          </div>
        </div>
        <AskInput emailId={selectedEmailId!} onAsked={scrollToBottom} />
      </div>
    </motion.div>
  )
}
