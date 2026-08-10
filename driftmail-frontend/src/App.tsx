import React, { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import toast from 'react-hot-toast'
import axios from 'axios'

import Sidebar from './components/Sidebar'
import InboxList from './components/InboxList'
import DetailPanel from './components/DetailPanel'
import AddEmailModal from './components/AddEmailModal'
import GmailBanner from './components/GmailBanner'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      retry: (failureCount, error) => {
        // Don't retry on 401 (token errors) — surface them immediately
        if (axios.isAxiosError(error) && error.response?.status === 401) return false
        return failureCount < 2
      },
    },
  },
})

function AppContent() {
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [reconnectBanner, setReconnectBanner] = useState(false)

  // Global 401 interceptor — detect RECONNECT_REQUIRED and show banner
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

  // Check for gmail_connected=true param on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail_connected') === 'true') {
      window.history.replaceState({}, '', '/')
      queryClient.invalidateQueries({ queryKey: ['auth-status'] })
      toast.success('Gmail connected successfully! 🎉')
    }
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#F5F4F0]">
      {/* Reconnect banner */}
      <GmailBanner show={reconnectBanner} />

      {/* Sidebar */}
      <Sidebar onAddEmail={() => setAddModalOpen(true)} />

      {/* Main area */}
      <div className="flex flex-1 min-w-0 overflow-hidden">
        <InboxList />
        <DetailPanel />
      </div>

      {/* Add email modal */}
      <AddEmailModal open={addModalOpen} onClose={() => setAddModalOpen(false)} />

      {/* Toast notifications */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1A1A2E',
            color: '#e2e8f0',
            borderRadius: '12px',
            border: '1px solid #2E2E50',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
          },
          success: {
            iconTheme: { primary: '#6C63FF', secondary: '#fff' },
          },
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
