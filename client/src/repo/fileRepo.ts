import { filesApi } from '../api/client'
import { offlineDb, upsertTripFiles } from '../db/offlineDb'
import { mutationQueue, generateUUID } from '../sync/mutationQueue'
import type { TripFile } from '../types'

export const fileRepo = {
  async list(tripId: number | string): Promise<{ files: TripFile[] }> {
    if (!navigator.onLine) {
      const cached = await offlineDb.tripFiles
        .where('trip_id')
        .equals(Number(tripId))
        .toArray()
      return { files: cached }
    }
    const result = await filesApi.list(tripId)
    upsertTripFiles(result.files)
    return result
  },

  async update(tripId: number | string, id: number, data: Record<string, unknown>): Promise<unknown> {
    if (!navigator.onLine) {
      const existing = await offlineDb.tripFiles.get(id)
      if (existing) await offlineDb.tripFiles.put({ ...existing, ...(data as Partial<TripFile>) })
      await mutationQueue.enqueue({
        id: generateUUID(),
        tripId: Number(tripId),
        method: 'PUT',
        url: `/trips/${tripId}/files/${id}`,
        body: data,
        resource: 'tripFiles',
      })
      return { success: true }
    }
    const result = await filesApi.update(tripId, id, data)
    const file = (result as { file?: TripFile }).file
    if (file) offlineDb.tripFiles.put(file)
    return result
  },

  async toggleStar(tripId: number | string, id: number): Promise<unknown> {
    if (!navigator.onLine) {
      const existing = await offlineDb.tripFiles.get(id)
      if (existing) {
        await offlineDb.tripFiles.put({ ...existing, starred: existing.starred ? 0 : 1 })
      }
      await mutationQueue.enqueue({
        id: generateUUID(),
        tripId: Number(tripId),
        method: 'PATCH',
        url: `/trips/${tripId}/files/${id}/star`,
        body: undefined,
      })
      return { success: true }
    }
    return filesApi.toggleStar(tripId, id)
  },

  async delete(tripId: number | string, id: number): Promise<unknown> {
    if (!navigator.onLine) {
      await offlineDb.tripFiles.delete(id)
      await mutationQueue.enqueue({
        id: generateUUID(),
        tripId: Number(tripId),
        method: 'DELETE',
        url: `/trips/${tripId}/files/${id}`,
        body: undefined,
        resource: 'tripFiles',
        entityId: id,
      })
      return { success: true }
    }
    const result = await filesApi.delete(tripId, id)
    offlineDb.tripFiles.delete(id)
    return result
  },
}
