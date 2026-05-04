import { reservationRepo } from '../../repo/reservationRepo'
import type { StoreApi } from 'zustand'
import type { TripStoreState } from '../tripStore'
import type { Reservation } from '../../types'
import { getApiErrorMessage } from '../../types'

type SetState = StoreApi<TripStoreState>['setState']
type GetState = StoreApi<TripStoreState>['getState']

export interface ReservationsSlice {
  loadReservations: (tripId: number | string) => Promise<void>
  addReservation: (tripId: number | string, data: Partial<Reservation>) => Promise<Reservation>
  updateReservation: (tripId: number | string, id: number, data: Partial<Reservation>) => Promise<Reservation>
  toggleReservationStatus: (tripId: number | string, id: number) => Promise<void>
  deleteReservation: (tripId: number | string, id: number) => Promise<void>
}

export const createReservationsSlice = (set: SetState, get: GetState): ReservationsSlice => ({
  loadReservations: async (tripId) => {
    try {
      const data = await reservationRepo.list(tripId)
      set({ reservations: data.reservations })
    } catch (err: unknown) {
      console.error('Failed to load reservations:', err)
    }
  },

  addReservation: async (tripId, data) => {
    try {
      const result = await reservationRepo.create(tripId, data as Record<string, unknown>)
      set(state => ({ reservations: [result.reservation, ...state.reservations] }))
      return result.reservation
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error creating reservation'))
    }
  },

  updateReservation: async (tripId, id, data) => {
    try {
      const result = await reservationRepo.update(tripId, id, data as Record<string, unknown>)
      set(state => ({
        reservations: state.reservations.map(r => r.id === id ? result.reservation : r)
      }))
      return result.reservation
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error updating reservation'))
    }
  },

  toggleReservationStatus: async (tripId, id) => {
    const prev = get().reservations
    const current = prev.find(r => r.id === id)
    if (!current) return
    const newStatus: 'pending' | 'confirmed' = current.status === 'confirmed' ? 'pending' : 'confirmed'
    set(state => ({
      reservations: state.reservations.map(r => r.id === id ? { ...r, status: newStatus } : r)
    }))
    try {
      await reservationRepo.update(tripId, id, { status: newStatus })
    } catch {
      set({ reservations: prev })
    }
  },

  deleteReservation: async (tripId, id) => {
    const prev = get().reservations
    set(state => ({ reservations: state.reservations.filter(r => r.id !== id) }))
    try {
      await reservationRepo.delete(tripId, id)
    } catch (err: unknown) {
      set({ reservations: prev })
      throw new Error(getApiErrorMessage(err, 'Error deleting reservation'))
    }
  },
})
