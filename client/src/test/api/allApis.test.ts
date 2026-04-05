/**
 * Comprehensive API client tests — covers all remaining API namespaces.
 * Pattern mirrors client.test.ts (mocked axios instance).
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  responseUseMock: vi.fn(),
}))

vi.mock('axios', () => {
  const mockInstance = {
    get: mocks.mockGet,
    post: mocks.mockPost,
    put: mocks.mockPut,
    delete: mocks.mockDelete,
    interceptors: {
      request: { use: vi.fn() },
      response: { use: mocks.responseUseMock },
    },
  }
  return { default: { create: vi.fn(() => mockInstance) } }
})

vi.mock('../api/websocket', () => ({ getSocketId: vi.fn(() => null), connect: vi.fn(), disconnect: vi.fn() }))

import {
  daysApi, placesApi, assignmentsApi, packingApi, tagsApi, categoriesApi,
  budgetApi, reservationsApi, accommodationsApi, dayNotesApi, collabApi,
  filesApi, shareApi, mapsApi, weatherApi, settingsApi, notificationsApi,
  inAppNotificationsApi, adminApi, addonsApi,
} from '../../api/client'

const ok = (data: unknown) => Promise.resolve({ data })

beforeEach(() => { vi.clearAllMocks() })

// ── daysApi ──────────────────────────────────────────────────────────────────
describe('daysApi', () => {
  it('list() → GET /trips/1/days', async () => {
    mocks.mockGet.mockReturnValue(ok({ days: [] }))
    await daysApi.list(1)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/days')
  })
  it('update() → PUT /trips/1/days/2', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await daysApi.update(1, 2, { title: 'Day 1' })
    expect(mocks.mockPut).toHaveBeenCalledWith('/trips/1/days/2', { title: 'Day 1' })
  })
})

// ── placesApi ────────────────────────────────────────────────────────────────
describe('placesApi', () => {
  it('list() → GET /trips/1/places', async () => {
    mocks.mockGet.mockReturnValue(ok({ places: [] }))
    await placesApi.list(1)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/places', { params: undefined })
  })
  it('list() with params', async () => {
    mocks.mockGet.mockReturnValue(ok({ places: [] }))
    await placesApi.list(1, { search: 'Tokyo' })
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/places', { params: { search: 'Tokyo' } })
  })
  it('create() → POST /trips/1/places', async () => {
    mocks.mockPost.mockReturnValue(ok({ place: { id: 1 } }))
    await placesApi.create(1, { name: 'Tokyo Tower', lat: 35.66, lng: 139.74 })
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/places', expect.objectContaining({ name: 'Tokyo Tower' }))
  })
  it('get() → GET /trips/1/places/5', async () => {
    mocks.mockGet.mockReturnValue(ok({ place: {} }))
    await placesApi.get(1, 5)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/places/5')
  })
  it('update() → PUT /trips/1/places/5', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await placesApi.update(1, 5, { name: 'Updated' })
    expect(mocks.mockPut).toHaveBeenCalledWith('/trips/1/places/5', { name: 'Updated' })
  })
  it('delete() → DELETE /trips/1/places/5', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await placesApi.delete(1, 5)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/trips/1/places/5')
  })
  it('importGoogleList() → POST /trips/1/places/import/google-list', async () => {
    mocks.mockPost.mockReturnValue(ok({ places: [], listName: 'My List' }))
    await placesApi.importGoogleList(1, 'https://maps.app.goo.gl/abc')
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/places/import/google-list', { url: 'https://maps.app.goo.gl/abc' })
  })
})

// ── assignmentsApi ───────────────────────────────────────────────────────────
describe('assignmentsApi', () => {
  it('list() → GET /trips/1/days/2/assignments', async () => {
    mocks.mockGet.mockReturnValue(ok({ assignments: [] }))
    await assignmentsApi.list(1, 2)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/days/2/assignments')
  })
  it('create() → POST /trips/1/days/2/assignments', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await assignmentsApi.create(1, 2, { place_id: 10 })
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/days/2/assignments', { place_id: 10 })
  })
  it('delete() → DELETE /trips/1/days/2/assignments/3', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await assignmentsApi.delete(1, 2, 3)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/trips/1/days/2/assignments/3')
  })
})

// ── reservationsApi ──────────────────────────────────────────────────────────
describe('reservationsApi', () => {
  it('list() → GET /trips/1/reservations', async () => {
    mocks.mockGet.mockReturnValue(ok({ reservations: [] }))
    await reservationsApi.list(1)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/reservations')
  })
  it('create() → POST /trips/1/reservations with correct payload', async () => {
    mocks.mockPost.mockReturnValue(ok({ reservation: { id: 1 } }))
    const payload = {
      title: '長榮航空 BR195', type: 'flight', status: 'confirmed',
      reservation_time: '2024-06-15T20:20', reservation_end_time: null,
      location: null, confirmation_number: null, notes: null,
      assignment_id: null, accommodation_id: null,
      metadata: '{"flight_number":"BR195"}',
    }
    await reservationsApi.create(1, payload)
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/reservations', payload)
  })
  it('create() flight — metadata must be a string, not an object', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    const payload = { title: 'Flight', type: 'flight', metadata: '{"flight_number":"BR195"}' }
    await reservationsApi.create(1, payload)
    const [, body] = mocks.mockPost.mock.calls[0]
    expect(typeof body.metadata).toBe('string')
  })
  it('update() → PUT /trips/1/reservations/2', async () => {
    mocks.mockPut.mockReturnValue(ok({ reservation: {} }))
    await reservationsApi.update(1, 2, { status: 'confirmed' })
    expect(mocks.mockPut).toHaveBeenCalledWith('/trips/1/reservations/2', { status: 'confirmed' })
  })
  it('delete() → DELETE /trips/1/reservations/2', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await reservationsApi.delete(1, 2)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/trips/1/reservations/2')
  })
  it('updatePositions() → PUT /trips/1/reservations/positions', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await reservationsApi.updatePositions(1, [{ id: 1, day_plan_position: 0 }])
    expect(mocks.mockPut).toHaveBeenCalledWith('/trips/1/reservations/positions', { positions: [{ id: 1, day_plan_position: 0 }] })
  })
})

// ── packingApi ───────────────────────────────────────────────────────────────
describe('packingApi', () => {
  it('list() → GET /trips/1/packing', async () => {
    mocks.mockGet.mockReturnValue(ok({ items: [] }))
    await packingApi.list(1)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/packing')
  })
  it('create() → POST /trips/1/packing', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await packingApi.create(1, { name: 'Passport', category: 'Documents' })
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/packing', { name: 'Passport', category: 'Documents' })
  })
  it('bulkImport() → POST /trips/1/packing/import', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await packingApi.bulkImport(1, [{ name: 'Passport' }, { name: 'Charger', category: 'Electronics' }])
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/packing/import', { items: [{ name: 'Passport' }, { name: 'Charger', category: 'Electronics' }] })
  })
  it('update() → PUT /trips/1/packing/3', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await packingApi.update(1, 3, { checked: true })
    expect(mocks.mockPut).toHaveBeenCalledWith('/trips/1/packing/3', { checked: true })
  })
  it('delete() → DELETE /trips/1/packing/3', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await packingApi.delete(1, 3)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/trips/1/packing/3')
  })
})

// ── budgetApi ────────────────────────────────────────────────────────────────
describe('budgetApi', () => {
  it('list() → GET /trips/1/budget', async () => {
    mocks.mockGet.mockReturnValue(ok({ items: [] }))
    await budgetApi.list(1)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/budget')
  })
  it('create() → POST /trips/1/budget', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await budgetApi.create(1, { name: 'Hotel', total_price: 200 })
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/budget', { name: 'Hotel', total_price: 200 })
  })
  it('update() → PUT /trips/1/budget/4', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await budgetApi.update(1, 4, { total_price: 250 })
    expect(mocks.mockPut).toHaveBeenCalledWith('/trips/1/budget/4', { total_price: 250 })
  })
  it('delete() → DELETE /trips/1/budget/4', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await budgetApi.delete(1, 4)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/trips/1/budget/4')
  })
  it('setMembers() → PUT /trips/1/budget/4/members', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await budgetApi.setMembers(1, 4, [1, 2, 3])
    expect(mocks.mockPut).toHaveBeenCalledWith('/trips/1/budget/4/members', { user_ids: [1, 2, 3] })
  })
})

// ── accommodationsApi ────────────────────────────────────────────────────────
describe('accommodationsApi', () => {
  it('list() → GET /trips/1/accommodations', async () => {
    mocks.mockGet.mockReturnValue(ok({ accommodations: [] }))
    await accommodationsApi.list(1)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/accommodations')
  })
  it('create() → POST /trips/1/accommodations', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await accommodationsApi.create(1, { place_id: 5, start_day_id: 1, end_day_id: 3 })
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/accommodations', { place_id: 5, start_day_id: 1, end_day_id: 3 })
  })
  it('update() → PUT /trips/1/accommodations/2', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await accommodationsApi.update(1, 2, { check_in: '15:00' })
    expect(mocks.mockPut).toHaveBeenCalledWith('/trips/1/accommodations/2', { check_in: '15:00' })
  })
  it('delete() → DELETE /trips/1/accommodations/2', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await accommodationsApi.delete(1, 2)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/trips/1/accommodations/2')
  })
})

// ── tagsApi ──────────────────────────────────────────────────────────────────
describe('tagsApi', () => {
  it('list() → GET /tags', async () => {
    mocks.mockGet.mockReturnValue(ok({ tags: [] }))
    await tagsApi.list()
    expect(mocks.mockGet).toHaveBeenCalledWith('/tags')
  })
  it('create() → POST /tags', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await tagsApi.create({ name: 'Must-see', color: '#ff0000' })
    expect(mocks.mockPost).toHaveBeenCalledWith('/tags', { name: 'Must-see', color: '#ff0000' })
  })
  it('update() → PUT /tags/1', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await tagsApi.update(1, { name: 'Updated' })
    expect(mocks.mockPut).toHaveBeenCalledWith('/tags/1', { name: 'Updated' })
  })
  it('delete() → DELETE /tags/1', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await tagsApi.delete(1)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/tags/1')
  })
})

// ── categoriesApi ────────────────────────────────────────────────────────────
describe('categoriesApi', () => {
  it('list() → GET /categories', async () => {
    mocks.mockGet.mockReturnValue(ok({ categories: [] }))
    await categoriesApi.list()
    expect(mocks.mockGet).toHaveBeenCalledWith('/categories')
  })
  it('create() → POST /categories', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await categoriesApi.create({ name: 'Museum', icon: 'museum', color: '#blue' })
    expect(mocks.mockPost).toHaveBeenCalledWith('/categories', { name: 'Museum', icon: 'museum', color: '#blue' })
  })
  it('update() → PUT /categories/2', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await categoriesApi.update(2, { name: 'Gallery' })
    expect(mocks.mockPut).toHaveBeenCalledWith('/categories/2', { name: 'Gallery' })
  })
  it('delete() → DELETE /categories/2', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await categoriesApi.delete(2)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/categories/2')
  })
})

// ── dayNotesApi ──────────────────────────────────────────────────────────────
describe('dayNotesApi', () => {
  it('list() → GET /trips/1/days/2/notes', async () => {
    mocks.mockGet.mockReturnValue(ok({ notes: [] }))
    await dayNotesApi.list(1, 2)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/days/2/notes')
  })
  it('create() → POST /trips/1/days/2/notes', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await dayNotesApi.create(1, 2, { text: 'Remember sunscreen' })
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/days/2/notes', { text: 'Remember sunscreen' })
  })
  it('update() → PUT /trips/1/days/2/notes/3', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await dayNotesApi.update(1, 2, 3, { text: 'Updated note' })
    expect(mocks.mockPut).toHaveBeenCalledWith('/trips/1/days/2/notes/3', { text: 'Updated note' })
  })
  it('delete() → DELETE /trips/1/days/2/notes/3', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await dayNotesApi.delete(1, 2, 3)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/trips/1/days/2/notes/3')
  })
})

// ── collabApi ────────────────────────────────────────────────────────────────
describe('collabApi', () => {
  it('getNotes() → GET /trips/1/collab/notes', async () => {
    mocks.mockGet.mockReturnValue(ok({ notes: [] }))
    await collabApi.getNotes(1)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/collab/notes')
  })
  it('createNote() → POST /trips/1/collab/notes', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await collabApi.createNote(1, { title: 'Ideas', content: 'Visit Shibuya' })
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/collab/notes', { title: 'Ideas', content: 'Visit Shibuya' })
  })
  it('updateNote() → PUT /trips/1/collab/notes/3', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await collabApi.updateNote(1, 3, { title: 'Updated' })
    expect(mocks.mockPut).toHaveBeenCalledWith('/trips/1/collab/notes/3', { title: 'Updated' })
  })
  it('deleteNote() → DELETE /trips/1/collab/notes/3', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await collabApi.deleteNote(1, 3)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/trips/1/collab/notes/3')
  })
})

// ── shareApi ─────────────────────────────────────────────────────────────────
describe('shareApi', () => {
  it('getLink() → GET /trips/1/share-link', async () => {
    mocks.mockGet.mockReturnValue(ok({}))
    await shareApi.getLink(1)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/share-link')
  })
  it('createLink() → POST /trips/1/share-link', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await shareApi.createLink(1, { can_edit: false })
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/share-link', { can_edit: false })
  })
  it('createLink() without permissions', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await shareApi.createLink(1)
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/share-link', {})
  })
  it('deleteLink() → DELETE /trips/1/share-link', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await shareApi.deleteLink(1)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/trips/1/share-link')
  })
})

// ── mapsApi ──────────────────────────────────────────────────────────────────
describe('mapsApi', () => {
  it('search() → POST /maps/search with lang param', async () => {
    mocks.mockPost.mockReturnValue(ok({ places: [] }))
    await mapsApi.search('Tokyo Tower', 'en')
    expect(mocks.mockPost).toHaveBeenCalledWith('/maps/search?lang=en', { query: 'Tokyo Tower' })
  })
  it('search() defaults lang to en', async () => {
    mocks.mockPost.mockReturnValue(ok({ places: [] }))
    await mapsApi.search('Eiffel Tower')
    expect(mocks.mockPost).toHaveBeenCalledWith('/maps/search?lang=en', { query: 'Eiffel Tower' })
  })
  it('details() → GET /maps/details/:id', async () => {
    mocks.mockGet.mockReturnValue(ok({ place: {} }))
    await mapsApi.details('ChIJN1t_tDeuEmsRUsoyG83frY4', 'en')
    expect(mocks.mockGet).toHaveBeenCalledWith(
      `/maps/details/${encodeURIComponent('ChIJN1t_tDeuEmsRUsoyG83frY4')}`,
      { params: { lang: 'en' } }
    )
  })
  it('placePhoto() → GET /maps/place-photo/:id', async () => {
    mocks.mockGet.mockReturnValue(ok({ photoUrl: 'http://example.com/photo.jpg' }))
    await mapsApi.placePhoto('place123', 35.66, 139.74, 'Tokyo Tower')
    expect(mocks.mockGet).toHaveBeenCalledWith(
      '/maps/place-photo/place123',
      { params: { lat: 35.66, lng: 139.74, name: 'Tokyo Tower' } }
    )
  })
})

// ── weatherApi ───────────────────────────────────────────────────────────────
describe('weatherApi', () => {
  it('get() → GET /weather with params', async () => {
    mocks.mockGet.mockReturnValue(ok({}))
    await weatherApi.get(35.66, 139.74, '2024-06-15')
    expect(mocks.mockGet).toHaveBeenCalledWith('/weather', { params: { lat: 35.66, lng: 139.74, date: '2024-06-15' } })
  })
  it('getDetailed() → GET /weather/detailed', async () => {
    mocks.mockGet.mockReturnValue(ok({}))
    await weatherApi.getDetailed(35.66, 139.74, '2024-06-15', 'en')
    expect(mocks.mockGet).toHaveBeenCalledWith('/weather/detailed', { params: { lat: 35.66, lng: 139.74, date: '2024-06-15', lang: 'en' } })
  })
})

// ── settingsApi ──────────────────────────────────────────────────────────────
describe('settingsApi', () => {
  it('get() → GET /settings', async () => {
    mocks.mockGet.mockReturnValue(ok({}))
    await settingsApi.get()
    expect(mocks.mockGet).toHaveBeenCalledWith('/settings')
  })
  it('set() → PUT /settings', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await settingsApi.set('theme', 'dark')
    expect(mocks.mockPut).toHaveBeenCalledWith('/settings', { key: 'theme', value: 'dark' })
  })
  it('setBulk() → POST /settings/bulk', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await settingsApi.setBulk({ theme: 'dark', language: 'en' })
    expect(mocks.mockPost).toHaveBeenCalledWith('/settings/bulk', { settings: { theme: 'dark', language: 'en' } })
  })
})

// ── notificationsApi ─────────────────────────────────────────────────────────
describe('notificationsApi', () => {
  it('getPreferences() → GET /notifications/preferences', async () => {
    mocks.mockGet.mockReturnValue(ok({}))
    await notificationsApi.getPreferences()
    expect(mocks.mockGet).toHaveBeenCalledWith('/notifications/preferences')
  })
  it('updatePreferences() → PUT /notifications/preferences', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await notificationsApi.updatePreferences({ email_booking: true })
    expect(mocks.mockPut).toHaveBeenCalledWith('/notifications/preferences', { email_booking: true })
  })
  it('testSmtp() → POST /notifications/test-smtp', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await notificationsApi.testSmtp('test@example.com')
    expect(mocks.mockPost).toHaveBeenCalledWith('/notifications/test-smtp', { email: 'test@example.com' })
  })
})

// ── inAppNotificationsApi ────────────────────────────────────────────────────
describe('inAppNotificationsApi', () => {
  it('list() → GET /notifications/in-app', async () => {
    mocks.mockGet.mockReturnValue(ok({ notifications: [] }))
    await inAppNotificationsApi.list()
    expect(mocks.mockGet).toHaveBeenCalledWith('/notifications/in-app', { params: undefined })
  })
  it('list() with params', async () => {
    mocks.mockGet.mockReturnValue(ok({ notifications: [] }))
    await inAppNotificationsApi.list({ limit: 10, unread_only: true })
    expect(mocks.mockGet).toHaveBeenCalledWith('/notifications/in-app', { params: { limit: 10, unread_only: true } })
  })
  it('unreadCount() → GET /notifications/in-app/unread-count', async () => {
    mocks.mockGet.mockReturnValue(ok({ count: 3 }))
    await inAppNotificationsApi.unreadCount()
    expect(mocks.mockGet).toHaveBeenCalledWith('/notifications/in-app/unread-count')
  })
  it('markRead() → PUT /notifications/in-app/1/read', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await inAppNotificationsApi.markRead(1)
    expect(mocks.mockPut).toHaveBeenCalledWith('/notifications/in-app/1/read')
  })
  it('markAllRead() → PUT /notifications/in-app/read-all', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await inAppNotificationsApi.markAllRead()
    expect(mocks.mockPut).toHaveBeenCalledWith('/notifications/in-app/read-all')
  })
  it('delete() → DELETE /notifications/in-app/1', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await inAppNotificationsApi.delete(1)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/notifications/in-app/1')
  })
})

// ── adminApi ─────────────────────────────────────────────────────────────────
describe('adminApi', () => {
  it('users() → GET /admin/users', async () => {
    mocks.mockGet.mockReturnValue(ok({ users: [] }))
    await adminApi.users()
    expect(mocks.mockGet).toHaveBeenCalledWith('/admin/users')
  })
  it('createUser() → POST /admin/users', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await adminApi.createUser({ email: 'a@b.com', password: 'pass' })
    expect(mocks.mockPost).toHaveBeenCalledWith('/admin/users', { email: 'a@b.com', password: 'pass' })
  })
  it('updateUser() → PUT /admin/users/1', async () => {
    mocks.mockPut.mockReturnValue(ok({}))
    await adminApi.updateUser(1, { role: 'admin' })
    expect(mocks.mockPut).toHaveBeenCalledWith('/admin/users/1', { role: 'admin' })
  })
  it('deleteUser() → DELETE /admin/users/1', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await adminApi.deleteUser(1)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/admin/users/1')
  })
  it('stats() → GET /admin/stats', async () => {
    mocks.mockGet.mockReturnValue(ok({}))
    await adminApi.stats()
    expect(mocks.mockGet).toHaveBeenCalledWith('/admin/stats')
  })
})

// ── addonsApi ────────────────────────────────────────────────────────────────
describe('addonsApi', () => {
  it('enabled() → GET /addons', async () => {
    mocks.mockGet.mockReturnValue(ok({ addons: [] }))
    await addonsApi.enabled()
    expect(mocks.mockGet).toHaveBeenCalledWith('/addons')
  })
})

// ── filesApi ─────────────────────────────────────────────────────────────────
describe('filesApi', () => {
  it('list() → GET /trips/1/files', async () => {
    mocks.mockGet.mockReturnValue(ok({ files: [] }))
    await filesApi.list(1)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/files', { params: {} })
  })
  it('list() with trash=true', async () => {
    mocks.mockGet.mockReturnValue(ok({ files: [] }))
    await filesApi.list(1, true)
    expect(mocks.mockGet).toHaveBeenCalledWith('/trips/1/files', { params: { trash: 'true' } })
  })
  it('delete() → DELETE /trips/1/files/5', async () => {
    mocks.mockDelete.mockReturnValue(ok({}))
    await filesApi.delete(1, 5)
    expect(mocks.mockDelete).toHaveBeenCalledWith('/trips/1/files/5')
  })
  it('restore() → POST /trips/1/files/5/restore', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await filesApi.restore(1, 5)
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/files/5/restore')
  })
  it('addLink() → POST /trips/1/files/5/link', async () => {
    mocks.mockPost.mockReturnValue(ok({}))
    await filesApi.addLink(1, 5, { reservation_id: 2 })
    expect(mocks.mockPost).toHaveBeenCalledWith('/trips/1/files/5/link', { reservation_id: 2 })
  })
})
