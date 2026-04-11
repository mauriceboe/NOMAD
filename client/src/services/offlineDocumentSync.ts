import { cacheDocument, getCachedDocumentIds } from './offlineDocuments'

export interface TripFile {
  id: number
  original_name: string
  mime_type: string
  size: number
  url: string
}

export type SyncProgress = {
  total: number
  done: number
  current: string
}

/**
 * Syncs documents for a trip. Fetches only files not already cached.
 * Files are fetched using cookie auth (credentials: 'include') — no ephemeral token needed.
 */
export async function syncTripDocuments(
  tripId: number,
  files: TripFile[],
  onProgress?: (progress: SyncProgress) => void
): Promise<number> {
  if (files.length === 0) return 0

  const alreadyCached = new Set(await getCachedDocumentIds(tripId))
  const toSync = files.filter(f => !alreadyCached.has(f.id))

  if (toSync.length === 0) return 0

  let done = 0
  let cached = 0

  await Promise.allSettled(
    toSync.map(async (file) => {
      try {
        onProgress?.({ total: toSync.length, done, current: file.original_name })
        // Use the direct download URL — cookie auth handles auth, no ephemeral token
        const res = await fetch(file.url, { credentials: 'include' })
        if (!res.ok) return
        const blob = await res.blob()
        await cacheDocument(tripId, file.id, blob, {
          filename: file.original_name,
          mimeType: file.mime_type,
          size: file.size,
        })
        cached++
      } finally {
        done++
        onProgress?.({ total: toSync.length, done, current: file.original_name })
      }
    })
  )

  return cached
}
