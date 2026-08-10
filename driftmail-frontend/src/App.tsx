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
import BottomGraphs from './components/BottomGraphs'
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
    <div className="w-full bg-[#F2EDE3] overflow-x-hidden">
      <GmailBanner show={reconnectBanner} />

      {/* PAGE 1: 100vh App Interface */}
      <div className="h-screen flex flex-col">
        {/* Top Navbar */}
        <Navbar />

        {/* Body Layout */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <Sidebar onAddEmail={() => setAddModalOpen(true)} />

          {/* Right Flex Column */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Emails (Inbox + Details) */}
            <div className="flex flex-1 min-h-0 relative">
              <InboxList />
              <AnimatePresence>
                {selectedEmailId && <DetailPanel key="detail" />}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* PAGE 2: 100vh Analytics Dashboard */}
      <div className="min-h-screen border-t border-[#D4C5A9] bg-[#E8DEC8] flex items-center justify-center p-12">
        <BottomGraphs />
      </div>

      <AddEmailModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />

      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0A0A0A',
            color: '#fff',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: 'bold',
            fontFamily: 'Inter, sans-serif',
          },
          success: { iconTheme: { primary: '#34d399', secondary: '#0A0A0A' } },
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
