import React, { useState, useEffect } from 'react'
import Modal from '../shared/Modal'
import { mapsApi, tagsApi, categoriesApi } from '../../api/client'
import { useToast } from '../shared/Toast'
import { useAuthStore } from '../../store/authStore'
import { useTranslation } from '../../i18n'
import { Search, Plus, MapPin, Loader } from 'lucide-react'

const STATUSES = [
  { value: 'none', label: 'None' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
]

export default function PlaceFormModal({
  isOpen,
  onClose,
  onSave,
  place,
  tripId,
  categories: initialCategories = [],
  tags: initialTags = [],
  onCategoryCreated,
  onTagCreated,
}) {
  const isEditing = !!place
  const { user, hasMapsKey } = useAuthStore()
  const { t } = useTranslation()
  const toast = useToast()

  const [categories, setCategories] = useState(initialCategories)
  const [tags, setTags] = useState(initialTags)

  useEffect(() => { setCategories(initialCategories) }, [initialCategories])
  useEffect(() => { setTags(initialTags) }, [initialTags])

  const emptyForm = {
    name: '',
    description: '',
    address: '',
    lat: '',
    lng: '',
    category_id: '',
    place_time: '',
    reservation_status: 'none',
    reservation_notes: '',
    reservation_datetime: '',
    google_place_id: '',
    website: '',
    tags: [],
  }

  const [formData, setFormData] = useState(emptyForm)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Maps search state
  const [mapQuery, setMapQuery] = useState('')
  const [mapResults, setMapResults] = useState([])
  const [mapSearching, setMapSearching] = useState(false)

  // New category/tag
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState('#374151')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#374151')
  const [showNewTag, setShowNewTag] = useState(false)

  useEffect(() => {
    if (place && isOpen) {
      setFormData({
        name: place.name || '',
        description: place.description || '',
        address: place.address || '',
        lat: place.lat ?? '',
        lng: place.lng ?? '',
        category_id: place.category_id || '',
        place_time: place.place_time || '',
        reservation_status: place.reservation_status || 'none',
        reservation_notes: place.reservation_notes || '',
        reservation_datetime: place.reservation_datetime || '',
        google_place_id: place.google_place_id || '',
        website: place.website || '',
        tags: (place.tags || []).map(t => t.id),
      })
    } else if (!place && isOpen) {
      setFormData(emptyForm)
    }
    setError('')
    setMapResults([])
    setMapQuery('')
  }, [place, isOpen])

  const update = (field, value) => setFormData(prev => ({ ...prev, [field]: value }))

  const parse_lat_lng_from_text = (raw_text) => {
    if (!raw_text) return null
    const cleaned_text = raw_text.trim().replace(/\s+/g, ' ')
    const matches = cleaned_text.match(/-?\d+(?:\.\d+)?/g)
    if (!matches || matches.length < 2) return null
    return { lat: matches[0], lng: matches[1] }
  }

  const handle_coordinate_paste = (e) => {
    const pasted_text = e.clipboardData?.getData('text') || ''
    const parsed_coordinates = parse_lat_lng_from_text(pasted_text)
    if (!parsed_coordinates) return
    e.preventDefault()
    setFormData(prev => ({
      ...prev,
      lat: parsed_coordinates.lat,
      lng: parsed_coordinates.lng,
    }))
  }

  const toggleTag = (tagId) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(id => id !== tagId)
        : [...prev.tags, tagId]
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setError('Place name is required')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      await onSave({
        ...formData,
        lat: formData.lat !== '' ? parseFloat(formData.lat) : null,
        lng: formData.lng !== '' ? parseFloat(formData.lng) : null,
        category_id: formData.category_id || null,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save place')
    } finally {
      setIsLoading(false)
    }
  }

  const [searchSource, setSearchSource] = useState(null)

  const handleMapSearch = async () => {
    if (!mapQuery.trim()) return
    setMapSearching(true)
    try {
      const data = await mapsApi.search(mapQuery)
      setMapResults(data.places || [])
      setSearchSource(data.source || 'google')
    } catch (err) {
      toast.error(err.response?.data?.error || t('places.mapsSearchError'))
    } finally {
      setMapSearching(false)
    }
  }

  const selectMapPlace = (p) => {
    setFormData(prev => ({
      ...prev,
      name: p.name || prev.name,
      address: p.address || prev.address,
      lat: p.lat ?? prev.lat,
      lng: p.lng ?? prev.lng,
      google_place_id: p.google_place_id || prev.google_place_id,
      website: p.website || prev.website,
    }))
    setMapResults([])
    setMapQuery('')
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const data = await categoriesApi.create({ name: newCategoryName, color: newCategoryColor, icon: 'MapPin' })
      setCategories(prev => [...prev, data.category])
      if (onCategoryCreated) onCategoryCreated(data.category)
      setFormData(prev => ({ ...prev, category_id: data.category.id }))
      setNewCategoryName('')
      setShowNewCategory(false)
      toast.success('Category created')
    } catch (err) {
      toast.error('Failed to create category')
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    try {
      const data = await tagsApi.create({ name: newTagName, color: newTagColor })
      setTags(prev => [...prev, data.tag])
      if (onTagCreated) onTagCreated(data.tag)
      setFormData(prev => ({ ...prev, tags: [...prev.tags, data.tag.id] }))
      setNewTagName('')
      setShowNewTag(false)
      toast.success('Tag created')
    } catch (err) {
      toast.error('Failed to create tag')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Place' : 'Add Place'}
      size="xl"
      footer={
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="px-4 py-2 text-sm bg-slate-900 hover:bg-slate-700 disabled:bg-slate-400 text-white rounded-lg flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Saving...
              </>
            ) : isEditing ? 'Save Changes' : 'Add Place'}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Place search — Google Maps or OpenStreetMap fallback */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
            {!hasMapsKey && (
              <p className="mb-2 text-xs" style={{ color: 'var(--text-faint)' }}>
                {t('places.osmActive')}
              </p>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={mapQuery}
                  onChange={e => setMapQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleMapSearch()}
                  placeholder={t('places.mapsSearchPlaceholder')}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white"
                />
              </div>
              <button
                onClick={handleMapSearch}
                disabled={mapSearching}
                className="px-3 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50"
              >
                {mapSearching ? <Loader className="w-4 h-4 animate-spin" /> : t('common.search')}
              </button>
            </div>

            {mapResults.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 max-h-48 overflow-y-auto mt-2">
                {mapResults.map((p, i) => (
                  <button
                    key={p.google_place_id || i}
                    onClick={() => selectMapPlace(p)}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                  >
                    <p className="text-sm font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {p.address}
                    </p>
                    {p.rating && (
                      <p className="text-xs text-amber-600 mt-0.5">★ {p.rating}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={e => update('name', e.target.value)}
            required
            placeholder="e.g. Eiffel Tower"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
          <textarea
            value={formData.description}
            onChange={e => update('description', e.target.value)}
            placeholder="Notes about this place..."
            rows={2}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none"
          />
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
          <input
            type="text"
            value={formData.address}
            onChange={e => update('address', e.target.value)}
            placeholder="Street address"
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>

        {/* Lat / Lng */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Latitude</label>
            <input
              type="number"
              step="any"
              value={formData.lat}
              onChange={e => update('lat', e.target.value)}
              onPaste={handle_coordinate_paste}
              placeholder="e.g. 48.8584"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Longitude</label>
            <input
              type="number"
              step="any"
              value={formData.lng}
              onChange={e => update('lng', e.target.value)}
              onPaste={handle_coordinate_paste}
              placeholder="e.g. 2.2945"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Category</label>
          <div className="flex gap-2">
            <select
              value={formData.category_id}
              onChange={e => update('category_id', e.target.value)}
              className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white"
            >
              <option value="">No category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewCategory(!showNewCategory)}
              className="px-3 py-2.5 border border-slate-300 rounded-lg text-slate-500 hover:text-slate-700 hover:border-slate-400 transition-colors"
              title="Create new category"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showNewCategory && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent"
              />
              <input
                type="color"
                value={newCategoryColor}
                onChange={e => setNewCategoryColor(e.target.value)}
                className="w-10 h-10 border border-slate-300 rounded-lg cursor-pointer p-1"
                title="Category color"
              />
              <button
                type="button"
                onClick={handleCreateCategory}
                className="px-3 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                  formData.tags.includes(tag.id)
                    ? 'text-white shadow-sm ring-2 ring-offset-1'
                    : 'text-white opacity-50 hover:opacity-80'
                }`}
                style={{
                  backgroundColor: tag.color || '#374151',
                  ringColor: formData.tags.includes(tag.id) ? tag.color : 'transparent'
                }}
              >
                {tag.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowNewTag(!showNewTag)}
              className="text-xs px-2.5 py-1 border border-dashed border-slate-300 rounded-full text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
            >
              <Plus className="inline w-3 h-3 mr-0.5" />
              New tag
            </button>
          </div>

          {showNewTag && (
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                placeholder="Tag name"
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent"
              />
              <input
                type="color"
                value={newTagColor}
                onChange={e => setNewTagColor(e.target.value)}
                className="w-10 h-10 border border-slate-300 rounded-lg cursor-pointer p-1"
              />
              <button
                type="button"
                onClick={handleCreateTag}
                className="px-3 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Reservation */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Reservation</label>
            <select
              value={formData.reservation_status}
              onChange={e => update('reservation_status', e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white"
            >
              {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Reservation details */}
        {formData.reservation_status !== 'none' && (
          <div className="space-y-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Reservation Date & Time</label>
              <input
                type="datetime-local"
                value={formData.reservation_datetime}
                onChange={e => update('reservation_datetime', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-400 focus:border-transparent bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Reservation Notes</label>
              <textarea
                value={formData.reservation_notes}
                onChange={e => update('reservation_notes', e.target.value)}
                placeholder="Confirmation number, special requests..."
                rows={2}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-transparent resize-none bg-white"
              />
            </div>
          </div>
        )}

        {/* Website */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label>
          <input
            type="url"
            value={formData.website}
            onChange={e => update('website', e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          />
        </div>
      </div>
    </Modal>
  )
}
