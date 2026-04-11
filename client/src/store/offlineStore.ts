import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { prefetchTripList, prefetchTripData } from '../services/offlineCache'
import { clearAllDocuments } from '../services/offlineDocuments'
import { syncTripDocuments, type TripFile } from '../services/offlineDocumentSync'

export interface CachedTripMeta {
  tripId: number
  tripName: string
  cachedAt: string
}

export interface CachedDocumentMeta {
  tripId: number
  fileId: number
  filename: string
  mimeType: string
  size: number
  cachedAt: string
}

interface OfflineState {
  offlineModeEnabled: boolean
  cachedTrips: Record<number, CachedTripMeta>
  cachedDocuments: Record<string, CachedDocumentMeta>
  lastSyncAt: string | null
  isSyncing: boolean

  setOfflineMode: (enabled: boolean) => void
  addCachedTrip: (meta: CachedTripMeta) => void
  removeCachedTrip: (tripId: number) => void
  addCachedDocument: (meta: CachedDocumentMeta) => void
  removeCachedDocument: (tripId: number, fileId: number) => void
  setLastSync: (at: string) => void
  setIsSyncing: (syncing: boolean) => void
  syncAllTrips: () => Promise<void>
  clearAllOfflineData: () => void
}

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      offlineModeEnabled: false,
      cachedTrips: {},
      cachedDocuments: {},
      lastSyncAt: null,
      isSyncing: false,

      setOfflineMode: (enabled) => set({ offlineModeEnabled: enabled }),

      addCachedTrip: (meta) =>
        set((state) => ({
          cachedTrips: { ...state.cachedTrips, [meta.tripId]: meta },
        })),

      removeCachedTrip: (tripId) =>
        set((state) => {
          const next = { ...state.cachedTrips }
          delete next[tripId]
          return { cachedTrips: next }
        }),

      addCachedDocument: (meta) =>
        set((state) => ({
          cachedDocuments: {
            ...state.cachedDocuments,
            [`${meta.tripId}/${meta.fileId}`]: meta,
          },
        })),

      removeCachedDocument: (tripId, fileId) =>
        set((state) => {
          const next = { ...state.cachedDocuments }
          delete next[`${tripId}/${fileId}`]
          return { cachedDocuments: next }
        }),

      setLastSync: (at) => set({ lastSyncAt: at }),

      setIsSyncing: (syncing) => set({ isSyncing: syncing }),

      syncAllTrips: async () => {
        set({ isSyncing: true })
        try {
          const trips = await prefetchTripList()
          await Promise.allSettled(
            trips.map(async (trip) => {
              const name = await prefetchTripData(trip.id)
              if (name !== null || trip.name) {
                get().addCachedTrip({
                  tripId: trip.id,
                  tripName: name ?? trip.name,
                  cachedAt: new Date().toISOString(),
                })
              }
              // Sync documents for this trip
              try {
                const filesRes = await fetch(`/api/trips/${trip.id}/files`, { credentials: 'include' })
                if (filesRes.ok) {
                  const filesData: { files?: TripFile[] } = await filesRes.json()
                  const files = filesData.files ?? []
                  const cachedCount = await syncTripDocuments(trip.id, files)
                  if (cachedCount > 0 || files.length > 0) {
                    files.forEach(f => {
                      get().addCachedDocument({
                        tripId: trip.id,
                        fileId: f.id,
                        filename: f.original_name,
                        mimeType: f.mime_type,
                        size: f.size,
                        cachedAt: new Date().toISOString(),
                      })
                    })
                  }
                }
              } catch {
                // Document sync failure is non-fatal
              }
            })
          )
          set({ lastSyncAt: new Date().toISOString() })
        } finally {
          set({ isSyncing: false })
        }
      },

      clearAllOfflineData: () => {
        clearAllDocuments().catch(() => {})
        set({
          cachedTrips: {},
          cachedDocuments: {},
          lastSyncAt: null,
        })
      },
    }),
    {
      name: 'trek-offline-store',
      // Only persist config state and metadata, not transient flags
      partialize: (state) => ({
        offlineModeEnabled: state.offlineModeEnabled,
        cachedTrips: state.cachedTrips,
        cachedDocuments: state.cachedDocuments,
        lastSyncAt: state.lastSyncAt,
      }),
    }
  )
)
