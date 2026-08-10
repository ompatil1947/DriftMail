import React from 'react'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEmails, patchEmail, type Email } from '../api/client'
import { useFilterStore } from '../store/filterStore'
import { CategoryBadge, PriorityBadge } from './Badges'

const SkeletonRow = () => (
  <div className="p-4 border-b border-slate-100 space-y-2 animate-pulse">
    <div className="flex items-center gap-2">
      <div className="shimmer h-3 w-48 rounded" />
      <div className="shimmer h-4 w-16 rounded-full ml-auto" />
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
  const qc = useQueryClient()
  const { mutate: toggle } = useMutation({
    mutationFn: (patch: { starred?: boolean; pinned?: boolean }) =>
      patchEmail(email.id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emails'] }),
  })

  const preview = email.body.replace(/\s+/g, ' ').slice(0, 90)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={onClick}
      className={`relative px-5 py-4 cursor-pointer border-b border-slate-100 transition-all duration-150 group
        ${selected
          ? 'bg-[#6C63FF]/5 border-l-2 border-l-[#6C63FF]'
          : 'hover:bg-slate-50 hover:shadow-card hover:-translate-y-px border-l-2 border-l-transparent'
        }`}
    >
      {/* Pin indicator */}
      {email.pinned && (
        <span className="absolute top-3 left-1 text-[#6C63FF] text-[9px]">📌</span>
      )}

      <div className="flex items-start justify-between gap-2 mb-1.5">
        <h3 className={`text-sm font-semibold leading-tight line-clamp-1 ${selected ? 'text-[#6C63FF]' : 'text-slate-800'}`}>
          {email.subject || '(no subject)'}
        </h3>

        {/* Star + Pin buttons */}
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); toggle({ pinned: !email.pinned }) }}
            className={`haptic text-sm transition-colors ${email.pinned ? 'text-[#6C63FF]' : 'text-slate-300 hover:text-[#6C63FF] opacity-0 group-hover:opacity-100'}`}
            title={email.pinned ? 'Unpin' : 'Pin'}
          >
            📌
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); toggle({ starred: !email.starred }) }}
            className={`haptic text-sm transition-colors ${email.starred ? 'text-amber-400' : 'text-slate-300 hover:text-amber-400 opacity-0 group-hover:opacity-100'}`}
            title={email.starred ? 'Unstar' : 'Star'}
          >
            {email.starred ? '★' : '☆'}
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">{preview}</p>

      <div className="flex items-center gap-1.5 flex-wrap">
        <CategoryBadge category={email.category} />
        <PriorityBadge priority={email.priority} />
        {email.source === 'gmail' && (
          <span className="text-[10px] text-slate-400 ml-auto">Gmail</span>
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
    <div className="flex-1 flex flex-col bg-white border-r border-slate-100 overflow-hidden min-w-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Inbox</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
            {emails?.length ?? 0} emails
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : emails?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 p-8">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl">📭</div>
            <p className="text-sm text-center">No emails found.<br />Try adjusting your filters.</p>
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
