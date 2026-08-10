import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:8000',
  timeout: 30000,
})

export type Email = {
  id: number
  google_message_id?: string
  subject: string
  body: string
  sender?: string
  category: string
  category_confidence: number
  priority: string
  priority_confidence: number
  starred: boolean
  pinned: boolean
  source: string
  received_at: string
  created_at: string
}

export type QAHistoryItem = {
  id: number
  email_id: number
  question: string
  answer: string
  grounded: boolean
  created_at: string
}

export type GmailStatus = {
  connected: boolean
  expires_at?: number
}

export type InboxEmail = {
  id: string
  sender: string
  date?: string
  snippet: string
  category: string
  category_confidence: number
  priority: string
  priority_confidence: number
  context_note?: string
}

// ── Emails ────────────────────────────────────────────────────────────────────

export const createEmail = async (subject: string, body: string): Promise<Email> => {
  const res = await api.post('/emails', { subject, body })
  return res.data
}

export const listEmails = async (params: {
  category?: string[]
  priority?: string[]
  starred?: boolean
  pinned?: boolean
  search?: string
}): Promise<Email[]> => {
  const p: Record<string, unknown> = {}
  if (params.category?.length) p.category = params.category
  if (params.priority?.length) p.priority = params.priority
  if (params.starred !== undefined) p.starred = params.starred
  if (params.pinned !== undefined) p.pinned = params.pinned
  if (params.search) p.search = params.search
  const res = await api.get('/emails', { params: p, paramsSerializer: { indexes: null } })
  return res.data
}

export const getEmail = async (id: number): Promise<Email> => {
  const res = await api.get(`/emails/${id}`)
  return res.data
}

export const patchEmail = async (id: number, patch: { starred?: boolean; pinned?: boolean }): Promise<Email> => {
  const res = await api.patch(`/emails/${id}`, patch)
  return res.data
}

export const askEmail = async (id: number, question: string): Promise<{ answer: string; grounded: boolean }> => {
  const res = await api.post(`/emails/${id}/ask`, { question })
  return res.data
}

export const getQAHistory = async (id: number): Promise<QAHistoryItem[]> => {
  const res = await api.get(`/emails/${id}/qa-history`)
  return res.data
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const getAuthStatus = async (): Promise<GmailStatus> => {
  const res = await api.get('/auth/google/status')
  return res.data
}

export const disconnectGmail = async (): Promise<void> => {
  await api.post('/auth/google/disconnect')
}

// ── Gmail inbox ───────────────────────────────────────────────────────────────

export const syncGmailInbox = async (maxResults = 20): Promise<Email[]> => {
  const res = await api.post('/emails/sync', null, { params: { max_results: maxResults } })
  return res.data
}

export default api
