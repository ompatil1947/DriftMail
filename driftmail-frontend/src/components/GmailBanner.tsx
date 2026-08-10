import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  show: boolean
}

export default function GmailBanner({ show }: Props) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md"
        >
          <div className="mx-4 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 shadow-panel flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0 text-lg">
              🔌
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-700">Gmail connection expired</p>
              <p className="text-xs text-red-500 mt-0.5">
                Your Gmail token is no longer valid. Reconnect to continue syncing.
              </p>
            </div>
            <a
              href="http://localhost:8000/auth/google/login"
              className="haptic flex-shrink-0 px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
            >
              Reconnect →
            </a>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
