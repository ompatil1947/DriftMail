import { create } from 'zustand'

export const CATEGORIES = [
  'forum', 'promotions', 'social_media', 'spam',
  'updates', 'verify_code', 'oportunities', 'finance', 'college'
] as const

export const PRIORITIES = ['high', 'medium', 'low'] as const

interface FilterState {
  categories: string[]
  priorities: string[]
  starred: boolean
  pinned: boolean
  search: string
  selectedEmailId: number | null
  toggleCategory: (cat: string) => void
  togglePriority: (pri: string) => void
  toggleStarred: () => void
  togglePinned: () => void
  setSearch: (s: string) => void
  selectEmail: (id: number | null) => void
}

export const useFilterStore = create<FilterState>((set) => ({
  categories: [],
  priorities: [],
  starred: false,
  pinned: false,
  search: '',
  selectedEmailId: null,

  toggleCategory: (cat) =>
    set((s) => ({
      priorities: [], // Clear priorities when selecting category
      categories: s.categories.includes(cat)
        ? s.categories.filter((c) => c !== cat)
        : [...s.categories, cat],
    })),

  togglePriority: (pri) =>
    set((s) => ({
      categories: [], // Clear categories when selecting priority
      // Single select: if clicking the active one, clear it. Otherwise, set it as the only active priority.
      priorities: s.priorities.includes(pri) ? [] : [pri],
    })),

  toggleStarred: () => set((s) => ({ starred: !s.starred })),
  togglePinned: () => set((s) => ({ pinned: !s.pinned })),
  setSearch: (search) => set({ search }),
  selectEmail: (id) => set({ selectedEmailId: id }),
}))
