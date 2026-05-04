import { daysApi } from '../api/client'
import { offlineDb, upsertDays } from '../db/offlineDb'
import { mutationQueue, generateUUID } from '../sync/mutationQueue'
import type { Day } from '../types'

export const dayRepo = {
  async list(tripId: number | string): Promise<{ days: Day[] }> {
    if (!navigator.onLine) {
      const cached = await offlineDb.days
        .where('trip_id')
        .equals(Number(tripId))
        .sortBy('day_number' as keyof Day)
      return { days: cached as Day[] }
    }
    const result = await daysApi.list(tripId)
    upsertDays(result.days)
    return result
  },

  async update(tripId: number | string, dayId: number | string, data: Record<string, unknown>): Promise<{ day: Day }> {
    if (!navigator.onLine) {
      const existing = await offlineDb.days.get(Number(dayId))
      const optimistic: Day = { ...(existing ?? {} as Day), ...(data as Partial<Day>), id: Number(dayId) }
      await offlineDb.days.put(optimistic)
      await mutationQueue.enqueue({
        id: generateUUID(),
        tripId: Number(tripId),
        method: 'PUT',
        url: `/trips/${tripId}/days/${dayId}`,
        body: data,
        resource: 'days',
      })
      return { day: optimistic }
    }
    const result = await daysApi.update(tripId, dayId, data)
    offlineDb.days.put(result.day)
    return result
  },
}
