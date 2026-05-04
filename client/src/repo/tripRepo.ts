import { tripsApi } from '../api/client'
import { offlineDb, upsertTrip } from '../db/offlineDb'
import { mutationQueue, generateUUID } from '../sync/mutationQueue'
import type { Trip } from '../types'

export const tripRepo = {
  async list(): Promise<{ trips: Trip[]; archivedTrips: Trip[] }> {
    if (!navigator.onLine) {
      const all = await offlineDb.trips.toArray()
      return {
        trips: all.filter(t => !t.is_archived),
        archivedTrips: all.filter(t => t.is_archived),
      }
    }
    const [active, archived] = await Promise.all([
      tripsApi.list(),
      tripsApi.list({ archived: 1 }),
    ])
    active.trips.forEach(t => upsertTrip(t))
    archived.trips.forEach(t => upsertTrip(t))
    return { trips: active.trips, archivedTrips: archived.trips }
  },

  async get(tripId: number | string): Promise<{ trip: Trip }> {
    if (!navigator.onLine) {
      const cached = await offlineDb.trips.get(Number(tripId))
      if (cached) return { trip: cached }
      throw new Error('No cached trip data available offline')
    }
    const result = await tripsApi.get(tripId)
    upsertTrip(result.trip)
    return result
  },

  async update(tripId: number | string, data: Partial<Trip>): Promise<{ trip: Trip }> {
    if (!navigator.onLine) {
      const existing = await offlineDb.trips.get(Number(tripId))
      const optimistic: Trip = { ...(existing ?? {} as Trip), ...(data as Partial<Trip>), id: Number(tripId) }
      await offlineDb.trips.put(optimistic)
      await mutationQueue.enqueue({
        id: generateUUID(),
        tripId: Number(tripId),
        method: 'PUT',
        url: `/trips/${tripId}`,
        body: data as Record<string, unknown>,
        resource: 'trips',
      })
      return { trip: optimistic }
    }
    const result = await tripsApi.update(tripId, data as Record<string, unknown>)
    upsertTrip(result.trip)
    return result
  },
}
