import { todoRepo } from '../../repo/todoRepo'
import type { StoreApi } from 'zustand'
import type { TripStoreState } from '../tripStore'
import type { TodoItem } from '../../types'
import { getApiErrorMessage } from '../../types'

type SetState = StoreApi<TripStoreState>['setState']
type GetState = StoreApi<TripStoreState>['getState']

export interface TodoSlice {
  addTodoItem: (tripId: number | string, data: Partial<TodoItem>) => Promise<TodoItem>
  updateTodoItem: (tripId: number | string, id: number, data: Partial<TodoItem>) => Promise<TodoItem>
  deleteTodoItem: (tripId: number | string, id: number) => Promise<void>
  toggleTodoItem: (tripId: number | string, id: number, checked: boolean) => Promise<void>
}

export const createTodoSlice = (set: SetState, get: GetState): TodoSlice => ({
  addTodoItem: async (tripId, data) => {
    try {
      const result = await todoRepo.create(tripId, data as Record<string, unknown>)
      set(state => ({ todoItems: [...state.todoItems, result.item] }))
      return result.item
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error adding todo'))
    }
  },

  updateTodoItem: async (tripId, id, data) => {
    try {
      const result = await todoRepo.update(tripId, id, data as Record<string, unknown>)
      set(state => ({
        todoItems: state.todoItems.map(item => item.id === id ? result.item : item)
      }))
      return result.item
    } catch (err: unknown) {
      throw new Error(getApiErrorMessage(err, 'Error updating todo'))
    }
  },

  deleteTodoItem: async (tripId, id) => {
    const prev = get().todoItems
    set(state => ({ todoItems: state.todoItems.filter(item => item.id !== id) }))
    try {
      await todoRepo.delete(tripId, id)
    } catch (err: unknown) {
      set({ todoItems: prev })
      throw new Error(getApiErrorMessage(err, 'Error deleting todo'))
    }
  },

  toggleTodoItem: async (tripId, id, checked) => {
    set(state => ({
      todoItems: state.todoItems.map(item =>
        item.id === id ? { ...item, checked: checked ? 1 : 0 } : item
      )
    }))
    try {
      await todoRepo.update(tripId, id, { checked })
    } catch {
      set(state => ({
        todoItems: state.todoItems.map(item =>
          item.id === id ? { ...item, checked: checked ? 0 : 1 } : item
        )
      }))
    }
  },
})
