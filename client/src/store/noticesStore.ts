import { create } from 'zustand'
import { noticesApi, type Notice } from '../api/client'

interface NoticesState {
  notices: Notice[]
  currentIndex: number
  fetch: () => Promise<void>
  dismiss: (id: string) => Promise<void>
  dismissAll: () => Promise<void>
  prev: () => void
  next: () => void
}

export const useNoticesStore = create<NoticesState>((set, get) => ({
  notices: [],
  currentIndex: 0,

  fetch: async () => {
    try {
      const data = await noticesApi.getPending()
      set({ notices: data, currentIndex: 0 })
    } catch {
      // silently ignore — notices are non-critical
    }
  },

  dismiss: async (id: string) => {
    await noticesApi.dismiss(id)
    const remaining = get().notices.filter((n) => n.id !== id)
    set({ notices: remaining, currentIndex: Math.min(get().currentIndex, Math.max(0, remaining.length - 1)) })
  },

  dismissAll: async () => {
    const ids = get().notices.map((n) => n.id)
    await Promise.all(ids.map((id) => noticesApi.dismiss(id)))
    set({ notices: [], currentIndex: 0 })
  },

  prev: () => set((s) => ({ currentIndex: Math.max(0, s.currentIndex - 1) })),
  next: () => set((s) => ({ currentIndex: Math.min(s.notices.length - 1, s.currentIndex + 1) })),
}))
