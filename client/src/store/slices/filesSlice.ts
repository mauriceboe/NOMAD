import { filesApi } from '../../api/client'
import { fileRepo } from '../../repo/fileRepo'
import type { StoreApi } from 'zustand'
import type { TripStoreState } from '../tripStore'
import type { TripFile } from '../../types'
import { getApiErrorMessage } from '../../types'

type SetState = StoreApi<TripStoreState>['setState']
type GetState = StoreApi<TripStoreState>['getState']

export interface FilesSlice {
  loadFiles: (tripId: number | string) => Promise<void>
  addFile: (tripId: number | string, formData: FormData) => Promise<TripFile>
  deleteFile: (tripId: number | string, id: number) => Promise<void>
}

export const createFilesSlice = (set: SetState, get: GetState): FilesSlice => ({
  loadFiles: async (tripId) => {
    try {
      const data = await fileRepo.list(tripId)
      set({ files: data.files })
    } catch (err: unknown) {
      console.error('Failed to load files:', err)
    }
  },

  addFile: async (tripId, formData) => {
    try {
      const data = await filesApi.upload(tripId, formData)
      set(state => ({ files: [data.file, ...state.files] }))
      return data.file
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error uploading file'))
    }
  },

  deleteFile: async (tripId, id) => {
    const prev = get().files
    set(state => ({ files: state.files.filter(f => f.id !== id) }))
    try {
      await fileRepo.delete(tripId, id)
    } catch (err: unknown) {
      set({ files: prev })
      throw new Error(getApiErrorMessage(err, 'Error deleting file'))
    }
  },
})
