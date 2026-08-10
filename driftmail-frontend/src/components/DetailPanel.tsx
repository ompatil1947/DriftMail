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

// ── Q&A Bubble ────────────────────────────────────────────────────────────────
function QABubble({ item }: { item: QAHistoryItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="space-y-2.5"
    >
      {/* User question */}
      <div className="flex justify-end">
        <div className="max-w-[78%] bg-[#0A0A0A] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-[13px] leading-relaxed">
          {item.question}
        </div>
      </div>

      {/* AI answer */}
      <div className="flex justify-start gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#F2EDE3] border border-[#E0D8CC] flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[#0A0A0A] text-[11px] font-bold">✦</span>
        </div>
        {item.grounded ? (
          <div className="max-w-[82%] bg-[#FAF7F2] border border-[#EDE8DC] rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] text-[#0A0A0A] leading-relaxed">
            {item.answer}
          </div>
        ) : (
          <div className="max-w-[82%] border border-dashed border-[#E0D8CC] bg-[#FAF7F2] rounded-2xl rounded-tl-sm px-4 py-3 text-[13px] text-[#999] leading-relaxed">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-xs">🔍</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#999]">Not grounded in email</span>
            </div>
            <span className="italic">{item.answer}</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Ask Input ─────────────────────────────────────────────────────────────────
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
    <form onSubmit={handleSubmit} className="flex gap-3 px-5 py-4">
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask anything about this email…"
        className="flex-1 px-4 py-3 rounded-xl bg-[#F2EDE3] border border-[#E0D8CC] text-[13px] text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder-[#B0A898]"
        disabled={isPending}
      />
      <button
        type="submit"
        disabled={!question.trim() || isPending}
        className="haptic px-5 py-3 rounded-xl bg-[#0A0A0A] text-white text-[13px] font-bold hover:bg-[#1A1A1A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 flex items-center gap-2"
      >
        {isPending
          ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
          : 'Ask'}
      </button>
    </form>
  )
}

// ── Main Detail Panel ─────────────────────────────────────────────────────────
export default function DetailPanel() {
  const { selectedEmailId, selectEmail } = useFilterStore()
  const qc = useQueryClient()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'email' | 'ai'>('email')

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

  useEffect(() => { scrollToBottom() }, [qaHistory.length])
  useEffect(() => { if (qaHistory.length > 0) setTab('ai') }, [qaHistory.length])

  if (!email) {
    return (
      <motion.div
        initial={{ x: 460, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 460, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="absolute right-0 top-0 bottom-0 w-[440px] flex items-center justify-center z-20 bg-[#FAF7F2] border-l border-[#EDE8DC]"
      >
        <div className="w-8 h-8 border-2 border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ x: 460, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 460, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="absolute right-0 top-0 bottom-0 w-[440px] flex flex-col z-20 overflow-hidden bg-[#FAF7F2] border-l border-[#EDE8DC]"
      style={{ boxShadow: '-4px 0 24px rgba(0,0,0,0.06)' }}
    >
      {/* ── Header ── */}
      <div className="px-5 pt-5 pb-4 flex-shrink-0 border-b border-[#EDE8DC] bg-white">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="text-[14px] font-bold text-[#0A0A0A] leading-snug flex-1">{email.subject}</h2>
          <button
            onClick={() => selectEmail(null)}
            className="haptic w-8 h-8 rounded-lg bg-[#F2EDE3] hover:bg-[#EDE8DC] flex items-center justify-center text-[#888] hover:text-[#0A0A0A] transition-colors text-sm flex-shrink-0"
            title="Close"
          >✕</button>
        </div>

        {email.sender && (
          <p className="text-[12px] text-[#888] mb-3 truncate">From: {email.sender}</p>
        )}

        {/* Badges */}
        <div className="flex gap-2 flex-wrap mb-4">
          <CategoryBadge category={email.category} />
          <PriorityBadge priority={email.priority} />
        </div>

        {/* ── ML Confidence Bars — the DL showcase ── */}
        <div className="space-y-3">
          <ConfidenceBar label="Category Confidence" value={email.category_confidence} />
          <ConfidenceBar label="Priority Confidence" value={email.priority_confidence} />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 px-5 py-3 border-b border-[#EDE8DC] bg-white flex-shrink-0">
        <button
          onClick={() => setTab('email')}
          className={`haptic flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all ${
            tab === 'email'
              ? 'bg-[#0A0A0A] text-white'
              : 'text-[#888] hover:text-[#0A0A0A] bg-[#F2EDE3]'
          }`}
        >
          Email
        </button>
        <button
          onClick={() => setTab('ai')}
          className={`haptic flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all relative ${
            tab === 'ai'
              ? 'bg-[#0A0A0A] text-white'
              : 'text-[#888] hover:text-[#0A0A0A] bg-[#F2EDE3]'
          }`}
        >
          Ask AI ✦
          {qaHistory.length > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#0A0A0A] text-white text-[9px] font-bold flex items-center justify-center border-2 border-[#FAF7F2]">
              {qaHistory.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === 'email' ? (
          <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5">
            <p className="text-[13px] text-[#333] leading-loose whitespace-pre-wrap">
              {email.body || <span className="text-[#BBB] italic">(empty body)</span>}
            </p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            {/* RAG AI Header */}
            <div className="px-5 py-4 flex-shrink-0 border-b border-[#EDE8DC] bg-[#F2EDE3]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-bold text-[#0A0A0A]">RAG-Powered Q&A</p>
                  <p className="text-[11px] text-[#888] mt-0.5">Retrieval-Augmented Generation · Gemini</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#E0D8CC]">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-semibold text-[#555]">Online</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-5 py-5 space-y-5 min-h-0" ref={scrollRef}>
              {qaHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-5 text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-[#F2EDE3] border border-[#E0D8CC] flex items-center justify-center text-3xl">✦</div>
                  <div>
                    <p className="text-[14px] font-bold text-[#0A0A0A]">Ask anything</p>
                    <p className="text-[12px] text-[#888] mt-1.5 max-w-[200px] leading-relaxed">
                      I'll ground my answer strictly in this email's content.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {['Who sent this?', 'Summarize this', 'Any action items?'].map(s => (
                      <span key={s} className="text-[11px] text-[#555] bg-white border border-[#E0D8CC] px-3 py-1.5 rounded-full">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                qaHistory.map(item => <QABubble key={item.id} item={item} />)
              )}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 border-t border-[#EDE8DC] bg-white">
              <AskInput emailId={selectedEmailId!} onAsked={scrollToBottom} />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
