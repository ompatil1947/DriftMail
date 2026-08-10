import React, { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  getEmail, getQAHistory, askEmail,
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
      className="space-y-3"
    >
      {/* User question */}
      <div className="flex justify-end">
        <div className="max-w-[78%] bg-[#0A0A0A] text-white rounded-2xl rounded-tr-sm px-5 py-4 text-[14px] leading-relaxed shadow-sm">
          {item.question}
        </div>
      </div>

      {/* AI answer */}
      <div className="flex justify-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#E8DEC8] border border-[#D4C5A9] flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[#0A0A0A] text-[12px] font-bold">✦</span>
        </div>
        {item.grounded ? (
          <div className="max-w-[82%] bg-[#F2EAE0] border border-[#E2D6C0] rounded-2xl rounded-tl-sm px-5 py-4 text-[14px] text-[#0A0A0A] leading-relaxed shadow-sm">
            {item.answer}
          </div>
        ) : (
          <div className="max-w-[82%] border border-dashed border-[#D4C5A9] bg-[#F2EAE0] rounded-2xl rounded-tl-sm px-5 py-4 text-[14px] text-[#888] leading-relaxed shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">🔍</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#888]">Not grounded in email</span>
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
    <form onSubmit={handleSubmit} className="flex gap-3 px-6 py-5">
      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask anything about this email…"
        className="flex-1 px-5 py-4 rounded-xl bg-[#E8DEC8] border border-[#D4C5A9] text-[15px] text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder-[#A89F8F] shadow-inner"
        disabled={isPending}
      />
      <button
        type="submit"
        disabled={!question.trim() || isPending}
        className="haptic px-6 py-4 rounded-xl bg-[#0A0A0A] text-white text-[15px] font-bold hover:bg-[#1A1A1A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 flex items-center justify-center min-w-[80px]"
      >
        {isPending
          ? <span className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin inline-block" />
          : 'Ask'}
      </button>
    </form>
  )
}

// ── Main Detail Panel ─────────────────────────────────────────────────────────
export default function DetailPanel() {
  const { selectedEmailId, selectEmail } = useFilterStore()
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
        initial={{ x: 500, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 500, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 38 }}
        className="absolute right-0 top-0 bottom-0 w-[480px] flex items-center justify-center z-20 bg-[#F2EAE0]"
      >
        <div className="w-10 h-10 border-4 border-[#0A0A0A] border-t-transparent rounded-full animate-spin" />
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ x: 500, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 500, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="absolute right-0 top-0 bottom-0 w-[520px] flex flex-col z-20 overflow-hidden bg-[#F2EAE0] border-l border-[#D4C5A9]"
      style={{ boxShadow: '-4px 0 32px rgba(0,0,0,0.08)' }}
    >
      
      {/* ── Tabs & Close Button (Sticky Top) ── */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#E2D6C0] bg-white flex-shrink-0">
        <div className="flex-1 flex gap-2">
          <button
            onClick={() => setTab('email')}
            className={`haptic flex-1 py-3 rounded-xl text-[14px] font-bold transition-all ${
              tab === 'email'
                ? 'bg-[#0A0A0A] text-white'
                : 'text-[#666] hover:text-[#0A0A0A] bg-[#E8DEC8]'
            }`}
          >
            Email
          </button>
          <button
            onClick={() => setTab('ai')}
            className={`haptic flex-1 py-3 rounded-xl text-[14px] font-bold transition-all relative ${
              tab === 'ai'
                ? 'bg-[#0A0A0A] text-white'
                : 'text-[#666] hover:text-[#0A0A0A] bg-[#E8DEC8]'
            }`}
          >
            Ask AI ✦
            {qaHistory.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#0A0A0A] text-white text-[10px] font-bold flex items-center justify-center border-2 border-[#F2EAE0]">
                {qaHistory.length}
              </span>
            )}
          </button>
        </div>
        <button
          onClick={() => selectEmail(null)}
          className="haptic w-12 h-12 rounded-xl bg-[#E8DEC8] hover:bg-[#D4C5A9] flex items-center justify-center text-[#555] hover:text-[#0A0A0A] transition-colors text-lg flex-shrink-0"
          title="Close"
        >✕</button>
      </div>

      {/* ── Content Area ── */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        
        {tab === 'email' ? (
          /* EMAIL VIEW: Scrollable massive header + email body */
          <div className="flex-1 overflow-y-auto scrollbar-thin flex flex-col bg-white">
            <div className="px-6 pt-6 pb-6 flex-shrink-0 border-b border-[#E2D6C0] bg-[#F9F6F0]">
              <h2 className="text-[20px] font-bold text-[#0A0A0A] leading-snug mb-4">{email.subject}</h2>

              {email.sender && (
                <p className="text-[14px] text-[#666] mb-5 truncate font-medium">From: <span className="text-[#0A0A0A]">{email.sender}</span></p>
              )}

              {/* Badges */}
              <div className="flex gap-2.5 flex-wrap mb-6">
                <CategoryBadge category={email.category} />
                <PriorityBadge priority={email.priority} />
              </div>

              {/* ── ML Confidence Bars ── */}
              <div className="space-y-4 bg-white p-5 rounded-xl border border-[#E2D6C0] shadow-sm">
                <ConfidenceBar label="Category Confidence" value={email.category_confidence} />
                <ConfidenceBar label="Priority Confidence" value={email.priority_confidence} />
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6 flex-1">
              <p className="text-[15px] text-[#333] leading-loose whitespace-pre-wrap">
                {email.body || <span className="text-[#999] italic font-medium">(empty body)</span>}
              </p>
            </div>
          </div>

        ) : (

          /* AI CHAT VIEW: Full height */
          <div className="flex-1 flex flex-col min-h-0 bg-white">
            {/* RAG AI Header */}
            <div className="px-6 py-4 flex-shrink-0 border-b border-[#E2D6C0] bg-[#E8DEC8]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[15px] font-bold text-[#0A0A0A]">RAG-Powered Q&A</p>
                  <p className="text-[12px] text-[#666] mt-1 font-medium">Retrieval-Augmented Generation · Gemini</p>
                </div>
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-[#D4C5A9]">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-bold text-[#333] uppercase tracking-wide">Online</span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6 space-y-6 min-h-0 bg-[#F9F6F0]" ref={scrollRef}>
              {qaHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-6 text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-[#E8DEC8] border border-[#D4C5A9] flex items-center justify-center text-3xl">✦</div>
                  <div>
                    <p className="text-[18px] font-bold text-[#0A0A0A]">Ask anything</p>
                    <p className="text-[14px] text-[#666] mt-2 max-w-[240px] leading-relaxed font-medium mx-auto">
                      I'll ground my answer strictly in this email's content.
                    </p>
                  </div>
                </div>
              ) : (
                qaHistory.map(item => <QABubble key={item.id} item={item} />)
              )}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 border-t border-[#E2D6C0] bg-white">
              <AskInput emailId={selectedEmailId!} onAsked={scrollToBottom} />
            </div>
          </div>

        )}
      </div>
    </motion.div>
  )
}
