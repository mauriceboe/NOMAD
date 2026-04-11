const DB_NAME = 'trek-offline-docs'
const DB_VERSION = 1
const STORE_NAME = 'documents'

interface DocumentEntry {
  key: string // `${tripId}/${fileId}`
  blob: Blob
  filename: string
  mimeType: string
  size: number
  cachedAt: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function makeKey(tripId: number, fileId: number): string {
  return `${tripId}/${fileId}`
}

export async function cacheDocument(
  tripId: number,
  fileId: number,
  blob: Blob,
  metadata: { filename: string; mimeType: string; size: number }
): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const entry: DocumentEntry = {
      key: makeKey(tripId, fileId),
      blob,
      filename: metadata.filename,
      mimeType: metadata.mimeType,
      size: metadata.size,
      cachedAt: new Date().toISOString(),
    }
    const req = tx.objectStore(STORE_NAME).put(entry)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export async function getCachedDocument(
  tripId: number,
  fileId: number
): Promise<{ blob: Blob; filename: string; mimeType: string } | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(makeKey(tripId, fileId))
    req.onsuccess = () => {
      const entry: DocumentEntry | undefined = req.result
      db.close()
      if (!entry) { resolve(null); return }
      resolve({ blob: entry.blob, filename: entry.filename, mimeType: entry.mimeType })
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function removeDocument(tripId: number, fileId: number): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).delete(makeKey(tripId, fileId))
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}

export async function removeAllForTrip(tripId: number): Promise<void> {
  const db = await openDb()
  const ids = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAllKeys()
    req.onsuccess = () => resolve((req.result as string[]).filter(k => k.startsWith(`${tripId}/`)))
    req.onerror = () => reject(req.error)
  })
  if (ids.length === 0) { db.close(); return }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    let pending = ids.length
    const done = () => { if (--pending === 0) resolve() }
    for (const key of ids) {
      const req = tx.objectStore(STORE_NAME).delete(key)
      req.onsuccess = done
      req.onerror = () => reject(req.error)
    }
    tx.oncomplete = () => db.close()
  })
}

export async function getCachedDocumentIds(tripId: number): Promise<number[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAllKeys()
    req.onsuccess = () => {
      db.close()
      const prefix = `${tripId}/`
      const ids = (req.result as string[])
        .filter(k => k.startsWith(prefix))
        .map(k => parseInt(k.slice(prefix.length), 10))
      resolve(ids)
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function getTotalDocumentCacheSize(): Promise<number> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => {
      db.close()
      const entries: DocumentEntry[] = req.result
      resolve(entries.reduce((sum, e) => sum + e.size, 0))
    }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function clearAllDocuments(): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => db.close()
  })
}
