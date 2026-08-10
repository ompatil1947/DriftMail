import React from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEmails, patchEmail, type Email } from '../api/client'
import { useFilterStore } from '../store/filterStore'
import { CategoryBadge, PriorityBadge } from './Badges'

const SkeletonRow = () => (
  <div className="px-6 py-6 border-b border-[#E2D6C0] space-y-4 animate-pulse">
    <div className="flex items-center justify-between gap-3">
      <div className="shimmer h-5 w-64 rounded" />
      <div className="shimmer h-6 w-32 rounded-full" />
    </div>
    <div className="shimmer h-4 w-full rounded" />
    <div className="shimmer h-4 w-3/4 rounded" />
  </div>
)

function EmailRow({ email, selected, onClick }: {
  email: Email
  selected: boolean
  onClick: () => void
}) {
  const preview = email.body.replace(/\s+/g, ' ').slice(0, 100)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      onClick={onClick}
      className={`relative px-6 py-6 cursor-pointer border-b border-[#E2D6C0] transition-all duration-150
        ${selected
          ? 'bg-[#0A0A0A] border-l-4 border-l-[#0A0A0A]'
          : 'bg-white hover:bg-[#F2EAE0] border-l-4 border-l-transparent'
        }`}
    >
      {/* Row 1: Subject + Badges on right */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <h3 className={`text-[16px] font-bold leading-snug flex-1 line-clamp-1 ${
          selected ? 'text-white' : 'text-[#0A0A0A]'
        }`}>
          {email.subject || '(no subject)'}
        </h3>

        {/* Category + Priority badges — always on the right */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <CategoryBadge category={email.category} />
          <PriorityBadge priority={email.priority} />
        </div>
      </div>

      {/* Row 2: Preview */}
      <p className={`text-[14px] line-clamp-2 leading-relaxed ${
        selected ? 'text-white/70' : 'text-[#666]'
      }`}>
        {preview}
      </p>

      {/* Row 3: Meta */}
      <div className="flex items-center gap-2.5 mt-3">
        {email.source === 'gmail' && (
          <span className={`text-[11px] font-bold tracking-wide uppercase flex items-center gap-1 ${
            selected ? 'text-white/40' : 'text-[#999]'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Gmail
          </span>
        )}
      </div>
    </motion.div>
  )
}

export default function InboxList() {
  const { categories, priorities, starred, pinned, search, selectedEmailId, selectEmail } = useFilterStore()

  const params = {
    category: categories.length ? categories : undefined,
    priority: priorities.length ? priorities : undefined,
    starred: starred || undefined,
    pinned: pinned || undefined,
    search: search || undefined,
  }

  const { data: emails, isLoading } = useQuery({
    queryKey: ['emails', params],
    queryFn: () => listEmails(params as Parameters<typeof listEmails>[0]),
    refetchInterval: 10000,
  })

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-white border-r border-[#D4C5A9]">
      {/* Header */}
      <div className="px-6 py-6 border-b border-[#E2D6C0] flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-[18px] font-bold text-[#0A0A0A]">Inbox</h2>
          <span className="text-[13px] text-[#555] bg-[#E8DEC8] px-3 py-1 rounded-full font-bold">
            {emails?.length ?? 0} emails
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : emails?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#AAA] gap-5 p-10">
            <div className="w-20 h-20 rounded-2xl bg-[#E8DEC8] flex items-center justify-center text-4xl">📭</div>
            <p className="text-[16px] font-bold text-center text-[#777]">No emails found.<br /><span className="text-[14px] font-medium mt-1 inline-block">Try adjusting your filters.</span></p>
          </div>
        ) : (
          <motion.div layout>
            {emails?.map((email) => (
              <EmailRow
                key={email.id}
                email={email}
                selected={selectedEmailId === email.id}
                onClick={() => selectEmail(selectedEmailId === email.id ? null : email.id)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}
