import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { createEmail } from '../api/client'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AddEmailModal({ open, onClose }: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const qc = useQueryClient()

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => createEmail(subject, body),
    onSuccess: (email) => {
      qc.invalidateQueries({ queryKey: ['emails'] })
      toast.success(`Classified as ${email.category} · ${email.priority} priority`)
      setSubject('')
      setBody('')
      onClose()
    },
    onError: () => toast.error('Failed to add email'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and body are required')
      return
    }
    submit()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50
              w-full max-w-xl bg-white rounded-2xl shadow-panel overflow-hidden"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#6C63FF] to-[#8B84FF] flex items-center justify-center shadow">
                  <span className="text-white text-sm">✉</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">Add Email for Classification</h2>
                  <p className="text-xs text-slate-500">AI will classify category & priority</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="haptic w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Subject
                </label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Your OTP for verification"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/10 transition-all placeholder-slate-400"
                  disabled={isPending}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Body
                </label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Paste or type the email body here…"
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:border-[#6C63FF] focus:ring-2 focus:ring-[#6C63FF]/10 transition-all placeholder-slate-400"
                  disabled={isPending}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="haptic flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="haptic flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#8B84FF] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60 transition-all shadow-lg shadow-[#6C63FF]/20"
                >
                  {isPending ? 'Classifying…' : 'Classify & Save →'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
