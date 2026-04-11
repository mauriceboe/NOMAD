const CACHE_NAME = 'trek-offline-data'
const OFFLINE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// Matches any path under /api/trips (including nested: /api/trips/123/collab/notes, etc.)
const TRIP_PATH_RE = /^\/api\/trips(\/.*)?$/

/**
 * Returns true for GET endpoints that should be cached for offline use.
 * Query params are stripped before matching.
 */
export function isTripEndpoint(url: string): boolean {
  return TRIP_PATH_RE.test(url.split('?')[0])
}

/**
 * Stores a JSON response in the offline cache with a timestamp header.
 */
export async function cacheResponse(url: string, data: unknown): Promise<void> {
  if (!('caches' in window)) return
  try {
    const cache = await caches.open(CACHE_NAME)
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Cached-At': Date.now().toString(),
    })
    await cache.put(url.split('?')[0], new Response(JSON.stringify(data), { headers, status: 200 }))
  } catch {
    // Cache quota exceeded or unavailable — fail silently
  }
}

/**
 * Retrieves cached JSON data if it exists and is within the TTL.
 * Returns null if missing or expired.
 */
export async function getCachedData(url: string, ttlMs = OFFLINE_TTL_MS): Promise<unknown | null> {
  if (!('caches' in window)) return null
  try {
    const cache = await caches.open(CACHE_NAME)
    const response = await cache.match(url.split('?')[0])
    if (!response) return null
    const cachedAt = response.headers.get('X-Cached-At')
    if (cachedAt && Date.now() - parseInt(cachedAt, 10) > ttlMs) return null
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Removes all cached entries for a given trip.
 */
export async function removeTripCache(tripId: number): Promise<void> {
  if (!('caches' in window)) return
  try {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    const prefix = `/api/trips/${tripId}`
    await Promise.all(
      keys.filter(r => r.url.includes(prefix)).map(r => cache.delete(r))
    )
  } catch {}
}

/** Top-level sub-endpoints to prefetch for each trip. */
const TRIP_TOP_ENDPOINTS = [
  'days',
  'places',
  'reservations',
  'files',
  'budget',
  'budget/summary/per-person',
  'budget/settlement',
  'packing',
  'packing/bags',
  'packing/category-assignees',
  'todo',
  'todo/category-assignees',
  'members',
  'accommodations',
  'collab/notes',
  'collab/polls',
  'collab/messages',
] as const

/**
 * Prefetches and caches all data for a specific trip.
 * Returns the trip name from the response, or null on failure.
 */
export async function prefetchTripData(tripId: number): Promise<string | null> {
  try {
    // Fetch trip root — gives us the trip name
    const tripRes = await fetch(`/api/trips/${tripId}`, { credentials: 'include' })
    if (!tripRes.ok) return null
    const tripData: { trip?: { name?: string } } = await tripRes.json()
    await cacheResponse(`/api/trips/${tripId}`, tripData)

    // Fetch all top-level sub-endpoints in parallel, capture days response
    let dayIds: number[] = []
    await Promise.allSettled(
      TRIP_TOP_ENDPOINTS.map(async (sub) => {
        const res = await fetch(`/api/trips/${tripId}/${sub}`, { credentials: 'include' })
        if (!res.ok) return
        const data: unknown = await res.json()
        await cacheResponse(`/api/trips/${tripId}/${sub}`, data)
        // Capture day IDs so we can prefetch per-day data
        if (sub === 'days') {
          const daysData = data as { days?: Array<{ id: number }> }
          dayIds = daysData.days?.map(d => d.id) ?? []
        }
      })
    )

    // Fetch per-day assignments and notes for each day
    if (dayIds.length > 0) {
      await Promise.allSettled(
        dayIds.flatMap((dayId) => [
          fetch(`/api/trips/${tripId}/days/${dayId}/assignments`, { credentials: 'include' })
            .then(r => r.ok ? r.json().then(d => cacheResponse(`/api/trips/${tripId}/days/${dayId}/assignments`, d)) : null)
            .catch(() => null),
          fetch(`/api/trips/${tripId}/days/${dayId}/notes`, { credentials: 'include' })
            .then(r => r.ok ? r.json().then(d => cacheResponse(`/api/trips/${tripId}/days/${dayId}/notes`, d)) : null)
            .catch(() => null),
        ])
      )
    }

    return tripData.trip?.name ?? null
  } catch {
    return null
  }
}

/**
 * Prefetches the full trip list and caches it.
 * Returns the list of trip IDs found.
 */
export async function prefetchTripList(): Promise<Array<{ id: number; name: string }>> {
  try {
    const res = await fetch('/api/trips', { credentials: 'include' })
    if (!res.ok) return []
    const data: { trips?: Array<{ id: number; name: string }> } = await res.json()
    await cacheResponse('/api/trips', data)
    return data.trips ?? []
  } catch {
    return []
  }
}
