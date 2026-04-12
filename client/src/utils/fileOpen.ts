import { getCachedDocument } from '../services/offlineDocuments'
import { useOfflineStore } from '../store/offlineStore'

// Matches /api/trips/:tripId/files/:fileId/download
const FILE_DOWNLOAD_RE = /^\/api\/trips\/(\d+)\/files\/(\d+)\/download$/

function parseFileUrl(url: string): { tripId: number; fileId: number } | null {
  const m = url.split('?')[0].match(FILE_DOWNLOAD_RE)
  if (!m) return null
  return { tripId: parseInt(m[1], 10), fileId: parseInt(m[2], 10) }
}

async function getBlobForUrl(url: string): Promise<Blob> {
  const offlineModeEnabled = useOfflineStore.getState().offlineModeEnabled
  if (offlineModeEnabled) {
    const parsed = parseFileUrl(url)
    if (parsed) {
      const cached = await getCachedDocument(parsed.tripId, parsed.fileId)
      if (cached) return cached.blob
    }
  }
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.blob()
}

/**
 * Fetches an authenticated file and downloads it, using the session cookie
 * instead of ephemeral tokens. Works correctly in PWA standalone mode.
 * When offline mode is enabled, checks IndexedDB cache first.
 */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const blob = await getBlobForUrl(url)
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(objectUrl); a.remove() }, 100)
}

/**
 * Fetches an authenticated file as a blob and opens it in a new tab/window
 * using a blob URL. This avoids the PWA standalone-mode issue where
 * window.open(serverUrl) opens the system browser without the session cookie.
 * When offline mode is enabled, checks IndexedDB cache first.
 */
export async function openFileInApp(url: string, filename: string): Promise<void> {
  const blob = await getBlobForUrl(url)
  const objectUrl = URL.createObjectURL(blob)
  const w = window.open(objectUrl, '_blank', 'noreferrer')
  if (!w) {
    // Popup blocked: fall back to download
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    setTimeout(() => { URL.revokeObjectURL(objectUrl); a.remove() }, 100)
    return
  }
  // Revoke the blob URL after a delay to allow the new tab to load the content
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000)
}
