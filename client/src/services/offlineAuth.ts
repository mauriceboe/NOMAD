import type { User } from '../types'

const KEY = 'trek_offline_auth'

interface CachedAuth {
  user: User
  cachedAt: string
}

/**
 * Stores the authenticated user in localStorage for offline-first access.
 * Only stores safe, non-sensitive user data (no tokens).
 */
export function cacheAuthResponse(data: { user: User }): void {
  try {
    const entry: CachedAuth = { user: data.user, cachedAt: new Date().toISOString() }
    localStorage.setItem(KEY, JSON.stringify(entry))
  } catch {
    // localStorage might be full — fail silently
  }
}

/**
 * Returns the cached auth data if available, null otherwise.
 */
export function getCachedAuth(): { user: User } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const entry: CachedAuth = JSON.parse(raw)
    if (!entry?.user) return null
    return { user: entry.user }
  } catch {
    return null
  }
}

/**
 * Removes cached auth data. Call on logout.
 */
export function clearCachedAuth(): void {
  localStorage.removeItem(KEY)
}
