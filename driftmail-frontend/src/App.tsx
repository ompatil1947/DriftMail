import React, { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import axios from 'axios'
import { AnimatePresence } from 'framer-motion'

import Sidebar from './components/Sidebar'
import InboxList from './components/InboxList'
import DetailPanel from './components/DetailPanel'
import AddEmailModal from './components/AddEmailModal'
import GmailBanner from './components/GmailBanner'
import Navbar from './components/Navbar'
import { useFilterStore } from './store/filterStore'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) return false
        return failureCount < 2
      },
    },
  },
})

function AppContent() {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [reconnectBanner, setReconnectBanner] = useState(false)
  const { selectedEmailId } = useFilterStore()

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (res) => res,
      (error) => {
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 401 &&
          error.response?.data?.detail?.error_code === 'RECONNECT_REQUIRED'
        ) {
          setReconnectBanner(true)
        }
        return Promise.reject(error)
      }
    )
    return () => axios.interceptors.response.eject(interceptorId)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail_connected') === 'true') {
      window.history.replaceState({}, '', '/')
      queryClient.invalidateQueries({ queryKey: ['auth-status'] })
      toast.success('Gmail connected successfully! 🎉')
    }
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden pastel-bg">
      <GmailBanner show={reconnectBanner} />

      {/* Top Navbar */}
      <Navbar onAddEmail={() => setAddModalOpen(true)} />

      {/* Body: Sidebar + Main */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar onAddEmail={() => setAddModalOpen(true)} />

        {/* Main area */}
        <div className="flex flex-1 min-w-0 overflow-hidden relative">
          <InboxList />
          <AnimatePresence>
            {selectedEmailId && <DetailPanel key="detail" />}
          </AnimatePresence>
        </div>
      </div>

      <AddEmailModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'rgba(26, 16, 53, 0.92)',
            backdropFilter: 'blur(12px)',
            color: '#e2e8f0',
            borderRadius: '14px',
            border: '1px solid rgba(108,99,255,0.3)',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
          success: { iconTheme: { primary: '#a78bfa', secondary: '#fff' } },
        }}
      />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
