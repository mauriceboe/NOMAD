import React, { useState, useEffect, useRef, useMemo } from 'react'
import Modal from '../shared/Modal'
import CustomSelect from '../shared/CustomSelect'
import { mapsApi } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../shared/Toast'
import { Search, Paperclip, X, AlertTriangle } from 'lucide-react'
import { useTranslation } from '../../i18n'
import CustomTimePicker from '../shared/CustomTimePicker'

const DEFAULT_FORM = {
  name: '',
  description: '',
  address: '',
  lat: '',
  lng: '',
  category_id: '',
  place_time: '',
  end_time: '',
  notes: '',
  transport_mode: 'walking',
  website: '',
}

export default function PlaceFormModal({
  isOpen, onClose, onSave, place, tripId, categories,
  onCategoryCreated, assignmentId, dayAssignments = [],
}) {
  const [form, setForm] = useState(DEFAULT_FORM)
  const [mapsSearch, setMapsSearch] = useState('')
  const [mapsResults, setMapsResults] = useState([])
  const [isSearchingMaps, setIsSearchingMaps] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const fileRef = useRef(null)
  const toast = useToast()
  const { t, language } = useTranslation()
  const { hasMapsKey } = useAuthStore()

  useEffect(() => {
    if (place) {
      setForm({
        name: place.name || '',
        description: place.description || '',
        address: place.address || '',
        lat: place.lat || '',
        lng: place.lng || '',
        category_id: place.category_id || '',
        place_time: place.place_time || '',
        end_time: place.end_time || '',
        notes: place.notes || '',
        transport_mode: place.transport_mode || 'walking',
        website: place.website || '',
      })
    } else {
      setForm(DEFAULT_FORM)
    }
    setPendingFiles([])
  }, [place, isOpen])

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const parse_lat_lng_from_text = (raw_text) => {
    if (!raw_text) return null
    const cleaned_text = raw_text.trim().replace(/\s+/g, ' ')
    const matches = cleaned_text.match(/-?\d+(?:\.\d+)?/g)
    if (!matches || matches.length < 2) return null
    const lat_value = matches[0]
    const lng_value = matches[1]
    return { lat: lat_value, lng: lng_value }
  }

  const handle_coordinate_paste = (e) => {
    const pasted_text = e.clipboardData?.getData('text') || ''
    const parsed_coordinates = parse_lat_lng_from_text(pasted_text)
    if (!parsed_coordinates) return
    e.preventDefault()
    setForm(prev => ({
      ...prev,
      lat: parsed_coordinates.lat,
      lng: parsed_coordinates.lng,
    }))
  }

  const handleMapsSearch = async () => {
    if (!mapsSearch.trim()) return
    setIsSearchingMaps(true)
    try {
      const result = await mapsApi.search(mapsSearch, language)
      setMapsResults(result.places || [])
    } catch (err) {
      toast.error(t('places.mapsSearchError'))
    } finally {
      setIsSearchingMaps(false)
    }
  }

  const handleSelectMapsResult = (result) => {
    setForm(prev => ({
      ...prev,
      name: result.name || prev.name,
      address: result.address || prev.address,
      lat: result.lat || prev.lat,
      lng: result.lng || prev.lng,
      google_place_id: result.google_place_id || prev.google_place_id,
    }))
    setMapsResults([])
    setMapsSearch('')
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const cat = await onCategoryCreated?.({ name: newCategoryName, color: '#6366f1', icon: 'MapPin' })
      if (cat) setForm(prev => ({ ...prev, category_id: cat.id }))
      setNewCategoryName('')
      setShowNewCategory(false)
    } catch (err) {
      toast.error(t('places.categoryCreateError'))
    }
  }

  const handleFileAdd = (e) => {
    const files = Array.from(e.target.files || [])
    setPendingFiles(prev => [...prev, ...files])
    e.target.value = ''
  }

  const handleRemoveFile = (idx) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== idx))
  }

  // Paste support for files/images
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type.startsWith('image/') || item.type === 'application/pdf') {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) setPendingFiles(prev => [...prev, file])
        return
      }
    }
  }

  const hasTimeError = place && form.place_time && form.end_time && form.place_time.length >= 5 && form.end_time.length >= 5 && form.end_time <= form.place_time

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error(t('places.nameRequired'))
      return
    }
    setIsSaving(true)
    try {
      await onSave({
        ...form,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        category_id: form.category_id || null,
        _pendingFiles: pendingFiles.length > 0 ? pendingFiles : undefined,
      })
      onClose()
    } catch (err) {
      toast.error(err.message || t('places.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={place ? t('places.editPlace') : t('places.addPlace')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" onPaste={handlePaste}>
        {/* Place Search */}
        <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
          {!hasMapsKey && (
            <p className="mb-2 text-xs" style={{ color: 'var(--text-faint)' }}>
              {t('places.osmActive')}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={mapsSearch}
              onChange={e => setMapsSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleMapsSearch())}
              placeholder={t('places.mapsSearchPlaceholder')}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
            />
            <button
              type="button"
              onClick={handleMapsSearch}
              disabled={isSearchingMaps}
              className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-slate-700 disabled:opacity-60"
            >
              {isSearchingMaps ? '...' : <Search className="w-4 h-4" />}
            </button>
          </div>
          {mapsResults.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden max-h-40 overflow-y-auto mt-2">
              {mapsResults.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectMapsResult(result)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0"
                >
                  <div className="font-medium text-sm">{result.name}</div>
                  <div className="text-xs text-slate-500 truncate">{result.address}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('places.formName')} *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => handleChange('name', e.target.value)}
            required
            placeholder={t('places.formNamePlaceholder')}
            className="form-input"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('places.formDescription')}</label>
          <textarea
            value={form.description}
            onChange={e => handleChange('description', e.target.value)}
            rows={2}
            placeholder={t('places.formDescriptionPlaceholder')}
            className="form-input" style={{ resize: 'none' }}
          />
        </div>

        {/* Address + Coordinates */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('places.formAddress')}</label>
          <input
            type="text"
            value={form.address}
            onChange={e => handleChange('address', e.target.value)}
            placeholder={t('places.formAddressPlaceholder')}
            className="form-input"
          />
          <div className="grid grid-cols-2 gap-2 mt-2">
            <input
              type="number"
              step="any"
              value={form.lat}
              onChange={e => handleChange('lat', e.target.value)}
              onPaste={handle_coordinate_paste}
              placeholder={t('places.formLat')}
              className="form-input"
            />
            <input
              type="number"
              step="any"
              value={form.lng}
              onChange={e => handleChange('lng', e.target.value)}
              onPaste={handle_coordinate_paste}
              placeholder={t('places.formLng')}
              className="form-input"
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('places.formCategory')}</label>
          {!showNewCategory ? (
            <div className="flex gap-2">
              <CustomSelect
                value={form.category_id}
                onChange={value => handleChange('category_id', value)}
                placeholder={t('places.noCategory')}
                options={[
                  { value: '', label: t('places.noCategory') },
                  ...(categories || []).map(c => ({
                    value: c.id,
                    label: c.name,
                  })),
                ]}
                style={{ flex: 1 }}
                size="sm"
              />
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                placeholder={t('places.categoryNamePlaceholder')}
                className="form-input" style={{ flex: 1 }}
              />
              <button type="button" onClick={handleCreateCategory} className="bg-slate-900 text-white px-3 rounded-lg hover:bg-slate-700 text-sm">
                OK
              </button>
              <button type="button" onClick={() => setShowNewCategory(false)} className="text-gray-500 px-2 text-sm">
                {t('common.cancel')}
              </button>
            </div>
          )}
        </div>

        {/* Time — only shown when editing, not when creating */}
        {place && (
          <TimeSection
            form={form}
            handleChange={handleChange}
            assignmentId={assignmentId}
            dayAssignments={dayAssignments}
            hasTimeError={hasTimeError}
            t={t}
          />
        )}

        {/* Website */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('places.formWebsite')}</label>
          <input
            type="url"
            value={form.website}
            onChange={e => handleChange('website', e.target.value)}
            placeholder="https://..."
            className="form-input"
          />
        </div>

        {/* File Attachments */}
        {true && (
          <div className="border border-gray-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">{t('files.title')}</label>
              <button type="button" onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                <Paperclip size={12} /> {t('files.attach')}
              </button>
            </div>
            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileAdd} />
            {pendingFiles.length > 0 && (
              <div className="space-y-1">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 text-xs">
                    <Paperclip size={10} className="text-slate-400 shrink-0" />
                    <span className="truncate flex-1 text-slate-600">{file.name}</span>
                    <button type="button" onClick={() => handleRemoveFile(idx)} className="text-slate-400 hover:text-red-500 shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pendingFiles.length === 0 && (
              <p className="text-xs text-slate-400">{t('files.pasteHint')}</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSaving || hasTimeError}
            className="px-6 py-2 bg-slate-900 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-60 font-medium"
          >
            {isSaving ? t('common.saving') : place ? t('common.update') : t('common.add')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function TimeSection({ form, handleChange, assignmentId, dayAssignments, hasTimeError, t }) {

  const collisions = useMemo(() => {
    if (!assignmentId || !form.place_time || form.place_time.length < 5) return []
    // Find the day_id for the current assignment
    const current = dayAssignments.find(a => a.id === assignmentId)
    if (!current) return []
    const myStart = form.place_time
    const myEnd = form.end_time && form.end_time.length >= 5 ? form.end_time : null
    return dayAssignments.filter(a => {
      if (a.id === assignmentId) return false
      if (a.day_id !== current.day_id) return false
      const aStart = a.place?.place_time
      const aEnd = a.place?.end_time
      if (!aStart) return false
      // Check overlap: two intervals overlap if start < otherEnd AND otherStart < end
      const s1 = myStart, e1 = myEnd || myStart
      const s2 = aStart, e2 = aEnd || aStart
      return s1 < (e2 || '23:59') && s2 < (e1 || '23:59') && s1 !== e2 && s2 !== e1
    })
  }, [assignmentId, dayAssignments, form.place_time, form.end_time])

  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('places.startTime')}</label>
          <CustomTimePicker
            value={form.place_time}
            onChange={v => handleChange('place_time', v)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('places.endTime')}</label>
          <CustomTimePicker
            value={form.end_time}
            onChange={v => handleChange('end_time', v)}
          />
        </div>
      </div>
      {hasTimeError && (
        <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-warning, #fef3c7)', color: 'var(--text-warning, #92400e)' }}>
          <AlertTriangle size={13} className="shrink-0" />
          {t('places.endTimeBeforeStart')}
        </div>
      )}
      {collisions.length > 0 && (
        <div className="flex items-start gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: 'var(--bg-warning, #fef3c7)', color: 'var(--text-warning, #92400e)' }}>
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>
            {t('places.timeCollision')}{' '}
            {collisions.map(a => a.place?.name).filter(Boolean).join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}
