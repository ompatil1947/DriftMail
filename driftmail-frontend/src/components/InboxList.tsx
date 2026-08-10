import React from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEmails, patchEmail, type Email } from '../api/client'
import { useFilterStore } from '../store/filterStore'
import { CategoryBadge, PriorityBadge } from './Badges'

const SkeletonRow = () => (
  <div className="px-6 py-5 border-b border-[#EDE8DC] space-y-3 animate-pulse">
    <div className="flex items-center justify-between gap-3">
      <div className="shimmer h-4 w-52 rounded" />
      <div className="shimmer h-5 w-24 rounded-full" />
    </div>
    <div className="shimmer h-3 w-full rounded" />
    <div className="shimmer h-3 w-3/4 rounded" />
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
      className={`relative px-6 py-5 cursor-pointer border-b border-[#EDE8DC] transition-all duration-150
        ${selected
          ? 'bg-[#0A0A0A] border-l-4 border-l-[#0A0A0A]'
          : 'bg-white hover:bg-[#FAF7F2] border-l-4 border-l-transparent'
        }`}
    >
      {/* Row 1: Subject + Badges on right */}
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className={`text-[14px] font-semibold leading-snug flex-1 line-clamp-1 ${
          selected ? 'text-white' : 'text-[#0A0A0A]'
        }`}>
          {email.subject || '(no subject)'}
        </h3>

        {/* Category + Priority badges — always on the right */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <CategoryBadge category={email.category} />
          <PriorityBadge priority={email.priority} />
        </div>
      </div>

      {/* Row 2: Preview */}
      <p className={`text-[12px] line-clamp-2 leading-relaxed ${
        selected ? 'text-white/60' : 'text-[#888]'
      }`}>
        {preview}
      </p>

      {/* Row 3: Meta */}
      <div className="flex items-center gap-2 mt-2.5">
        {email.source === 'gmail' && (
          <span className={`text-[10px] font-medium flex items-center gap-1 ${
            selected ? 'text-white/40' : 'text-[#AAA]'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
            Gmail
          </span>
        )}
        {email.pinned && (
          <span className={`text-[10px] ${selected ? 'text-white/40' : 'text-[#AAA]'}`}>📌 Pinned</span>
        )}
        {email.starred && (
          <span className={`text-[10px] ${selected ? 'text-amber-300' : 'text-amber-500'}`}>★ Starred</span>
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
    <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-white">
      {/* Header */}
      <div className="px-6 py-5 border-b border-[#EDE8DC] flex items-center justify-between bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-[15px] font-bold text-[#0A0A0A]">Inbox</h2>
          <span className="text-[11px] text-[#888] bg-[#F2EDE3] px-2.5 py-1 rounded-full font-semibold">
            {emails?.length ?? 0} emails
          </span>
        </div>
        {(categories.length > 0 || priorities.length > 0 || starred || pinned || search) && (
          <span className="text-[11px] text-[#0A0A0A] bg-[#F2EDE3] border border-[#DDD8CE] px-2.5 py-1 rounded-full font-medium">
            Filtered
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : emails?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#AAA] gap-4 p-10">
            <div className="w-16 h-16 rounded-2xl bg-[#F2EDE3] flex items-center justify-center text-3xl">📭</div>
            <p className="text-[14px] text-center text-[#999]">No emails found.<br /><span className="text-[12px]">Try adjusting your filters.</span></p>
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
