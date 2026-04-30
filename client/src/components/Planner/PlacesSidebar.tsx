import React from 'react'
import ReactDOM from 'react-dom'
import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { Search, Plus, X, CalendarDays, Pencil, Trash2, ExternalLink, Navigation, Upload, ChevronDown, Check, MapPin, Eye, Route } from 'lucide-react'
import PlaceAvatar from '../shared/PlaceAvatar'
import { getCategoryIcon } from '../shared/categoryIcons'
import { useTranslation } from '../../i18n'
import { useToast } from '../shared/Toast'
import { useContextMenu, ContextMenu } from '../shared/ContextMenu'
import { placesApi } from '../../api/client'
import { useTripStore } from '../../store/tripStore'
import { useCanDo } from '../../store/permissionsStore'
import type { Place, Category, Day, AssignmentsMap } from '../../types'
import FileImportModal from './FileImportModal'
import ConfirmDialog from '../shared/ConfirmDialog'
import Tooltip from '../shared/Tooltip'

interface PlacesSidebarProps {
  tripId: number
  places: Place[]
  categories: Category[]
  assignments: AssignmentsMap
  selectedDayId: number | null
  selectedPlaceId: number | null
  onPlaceClick: (placeId: number | null) => void
  onAddPlace: () => void
  onAssignToDay: (placeId: number, dayId: number) => void
  onEditPlace: (place: Place) => void
  onDeletePlace: (placeId: number) => void
  onBulkDeletePlaces?: (ids: number[]) => void
  onBulkDeleteConfirm?: (ids: number[]) => void
  days: Day[]
  isMobile: boolean
  onCategoryFilterChange?: (categoryIds: Set<string>) => void
  onPlacesFilterChange?: (filter: string) => void
  pushUndo?: (label: string, undoFn: () => Promise<void> | void) => void
  initialScrollTop?: number
  onScrollTopChange?: (top: number) => void
}

interface MemoPlaceRowProps {
  place: Place
  category: Category | undefined
  isSelected: boolean
  isPlanned: boolean
  inDay: boolean
  isChecked: boolean
  selectMode: boolean
  selectedDayId: number | null
  canEditPlaces: boolean
  isMobile: boolean
  t: (key: string, params?: Record<string, any>) => string
  onPlaceClick: (id: number | null) => void
  onContextMenu: (e: React.MouseEvent, place: Place) => void
  onAssignToDay: (placeId: number, dayId?: number) => void
  toggleSelected: (id: number) => void
  setDayPickerPlace: (place: any) => void
}

const MemoPlaceRow = React.memo(function MemoPlaceRow({
  place, category: cat, isSelected, isPlanned, inDay, isChecked,
  selectMode, selectedDayId, canEditPlaces, isMobile, t,
  onPlaceClick, onContextMenu, onAssignToDay, toggleSelected, setDayPickerPlace,
}: MemoPlaceRowProps) {
  const hasGeometry = Boolean(place.route_geometry)
  return (
    <div
      key={place.id}
      draggable={!selectMode}
      onDragStart={e => {
        e.dataTransfer.setData('placeId', String(place.id))
        e.dataTransfer.effectAllowed = 'copy'
        window.__dragData = { placeId: String(place.id) }
      }}
      onClick={() => {
        if (selectMode) {
          toggleSelected(place.id)
        } else if (isMobile) {
          setDayPickerPlace(place)
        } else {
          onPlaceClick(isSelected ? null : place.id)
        }
      }}
      onContextMenu={selectMode ? undefined : e => onContextMenu(e, place)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px 9px 16px',
        cursor: selectMode ? 'pointer' : 'grab',
        background: isChecked ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : isSelected ? 'var(--border-faint)' : 'transparent',
        borderBottom: '1px solid var(--border-faint)',
        transition: 'background 0.1s',
        contentVisibility: 'auto',
        containIntrinsicSize: '0 52px',
      }}
      onMouseEnter={e => { if (!isSelected && !isChecked) e.currentTarget.style.background = 'var(--bg-hover)' }}
      onMouseLeave={e => { if (!isSelected && !isChecked) e.currentTarget.style.background = 'transparent' }}
    >
      {selectMode && (
        <div style={{
          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
          border: isChecked ? 'none' : '1.5px solid var(--border-primary)',
          background: isChecked ? 'var(--accent)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isChecked && <Check size={10} strokeWidth={3} color="white" />}
        </div>
      )}
      <PlaceAvatar place={place} category={cat} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden' }}>
          {hasGeometry && <Route size={11} strokeWidth={2} color="var(--text-faint)" style={{ flexShrink: 0 }} title="Track / Route" />}
          {cat && (() => {
            const CatIcon = getCategoryIcon(cat.icon)
            return <CatIcon size={11} strokeWidth={2} color={cat.color || '#6366f1'} style={{ flexShrink: 0 }} title={cat.name} />
          })()}
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
            {place.name}
          </span>
        </div>
        {(place.description || place.address || cat?.name) && (
          <div style={{ marginTop: 2 }}>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', lineHeight: 1.2 }}>
              {place.description || place.address || cat?.name}
            </span>
          </div>
        )}
      </div>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
        {!selectMode && !inDay && selectedDayId && (
          <button
            onClick={e => { e.stopPropagation(); onAssignToDay(place.id) }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 20, height: 20, borderRadius: 6,
              background: 'var(--bg-hover)', border: 'none', cursor: 'pointer',
              color: 'var(--text-faint)', padding: 0, transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent-text)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-faint)' }}
          ><Plus size={12} strokeWidth={2.5} /></button>
        )}
      </div>
    </div>
  )
})

const PlacesSidebar = React.memo(function PlacesSidebar({
  tripId, places, categories, assignments, selectedDayId, selectedPlaceId,
  onPlaceClick, onAddPlace, onAssignToDay, onEditPlace, onDeletePlace, onBulkDeletePlaces, onBulkDeleteConfirm, days, isMobile, onCategoryFilterChange, onPlacesFilterChange, pushUndo,
  initialScrollTop, onScrollTopChange,
}: PlacesSidebarProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const ctxMenu = useContextMenu()
  const trip = useTripStore((s) => s.trip)
  const loadTrip = useTripStore((s) => s.loadTrip)
  const can = useCanDo()
  const canEditPlaces = can('place_edit', trip)
  const isNaverListImportEnabled = true

  const [fileImportOpen, setFileImportOpen] = useState(false)
  const [sidebarDropFile, setSidebarDropFile] = useState<File | null>(null)
  const [sidebarDragOver, setSidebarDragOver] = useState(false)
  const sidebarDragCounter = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (scrollContainerRef.current && initialScrollTop) {
      scrollContainerRef.current.scrollTop = initialScrollTop
    }
  }, [])

  const handleSidebarDragEnter = (e: React.DragEvent) => {
    if (!canEditPlaces) return
    e.preventDefault()
    sidebarDragCounter.current++
    setSidebarDragOver(true)
  }

  const handleSidebarDragOver = (e: React.DragEvent) => {
    if (!canEditPlaces) return
    e.preventDefault()
  }

  const handleSidebarDragLeave = () => {
    sidebarDragCounter.current--
    if (sidebarDragCounter.current === 0) setSidebarDragOver(false)
  }

  const handleSidebarDrop = (e: React.DragEvent) => {
    e.preventDefault()
    sidebarDragCounter.current = 0
    setSidebarDragOver(false)
    if (!canEditPlaces) return
    const f = e.dataTransfer.files[0]
    if (!f) return
    setSidebarDropFile(f)
    setFileImportOpen(true)
  }

  const [listImportOpen, setListImportOpen] = useState(false)
  const [listImportUrl, setListImportUrl] = useState('')
  const [listImportLoading, setListImportLoading] = useState(false)
  const [listImportProvider, setListImportProvider] = useState<'google' | 'naver'>('google')
  const availableListImportProviders: Array<'google' | 'naver'> = isNaverListImportEnabled ? ['google', 'naver'] : ['google']
  const hasMultipleListImportProviders = availableListImportProviders.length > 1

  useEffect(() => {
    if (!isNaverListImportEnabled && listImportProvider === 'naver') {
      setListImportProvider('google')
    }
  }, [isNaverListImportEnabled, listImportProvider])

  const handleListImport = async () => {
    if (!listImportUrl.trim()) return
    setListImportLoading(true)
    const provider = listImportProvider === 'naver' && isNaverListImportEnabled ? 'naver' : 'google'
    try {
      const result = provider === 'google'
        ? await placesApi.importGoogleList(tripId, listImportUrl.trim())
        : await placesApi.importNaverList(tripId, listImportUrl.trim())
      await loadTrip(tripId)
      if (result.count === 0 && result.skipped > 0) {
        toast.warning(t('places.importAllSkipped'))
      } else {
        toast.success(t(provider === 'google' ? 'places.googleListImported' : 'places.naverListImported', { count: result.count, list: result.listName }))
      }
      setListImportOpen(false)
      setListImportUrl('')
      if (result.places?.length > 0) {
        const importedIds: number[] = result.places.map((p: { id: number }) => p.id)
        pushUndo?.(t(provider === 'google' ? 'undo.importGoogleList' : 'undo.importNaverList'), async () => {
          try { await placesApi.bulkDelete(tripId, importedIds) } catch {}
          await loadTrip(tripId)
        })
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t(provider === 'google' ? 'places.googleListError' : 'places.naverListError'))
    } finally {
      setListImportLoading(false)
    }
  }

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [categoryFilters, setCategoryFiltersLocal] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [pendingDeleteIds, setPendingDeleteIds] = useState<number[] | null>(null)

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()) }

  // Auto-exit when all selected places have been removed from the store (e.g. after bulk delete)
  useEffect(() => {
    if (!selectMode || selectedIds.size === 0) return
    const placeIdSet = new Set(places.map(p => p.id))
    if ([...selectedIds].every(id => !placeIdSet.has(id))) {
      setSelectMode(false)
      setSelectedIds(new Set())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places])

  const toggleSelected = useCallback((id: number) => setSelectedIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  }), [])

  const toggleCategoryFilter = (catId: string) => {
    setCategoryFiltersLocal(prev => {
      const next = new Set(prev)
      if (next.has(catId)) next.delete(catId); else next.add(catId)
      onCategoryFilterChange?.(next)
      return next
    })
  }
  const [dayPickerPlace, setDayPickerPlace] = useState(null)
  const [catDropOpen, setCatDropOpen] = useState(false)
  const [mobileShowDays, setMobileShowDays] = useState(false)

  // Alle geplanten Ort-IDs abrufen (einem Tag zugewiesen)
  const hasTracks = useMemo(() => places.some(p => p.route_geometry), [places])
  useEffect(() => { if (filter === 'tracks' && !hasTracks) setFilter('all') }, [hasTracks, filter])

  const plannedIds = useMemo(() => new Set(
    Object.values(assignments).flatMap(da => da.map(a => a.place?.id).filter(Boolean))
  ), [assignments])

  const filtered = useMemo(() => places.filter(p => {
    if (filter === 'unplanned' && plannedIds.has(p.id)) return false
    if (filter === 'tracks' && !p.route_geometry) return false
    if (categoryFilters.size > 0) {
      if (p.category_id == null) {
        if (!categoryFilters.has('uncategorized')) return false
      } else if (!categoryFilters.has(String(p.category_id))) return false
    }
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.address || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [places, filter, categoryFilters, search, plannedIds])

  const isAssignedToSelectedDay = (placeId) =>
    selectedDayId && (assignments[String(selectedDayId)] || []).some(a => a.place?.id === placeId)

  const selectedDayIdRef = useRef<number | null>(selectedDayId)
  useEffect(() => { selectedDayIdRef.current = selectedDayId }, [selectedDayId])

  const inDaySet = useMemo(() => {
    if (!selectedDayId) return new Set<number>()
    return new Set<number>((assignments[String(selectedDayId)] || []).map((a: any) => a.place?.id).filter(Boolean))
  }, [assignments, selectedDayId])

  const openContextMenu = useCallback((e: React.MouseEvent, place: Place) => {
    const selDayId = selectedDayIdRef.current
    ctxMenu.open(e, [
      canEditPlaces && { label: t('common.edit'), icon: Pencil, onClick: () => onEditPlace(place) },
      selDayId && { label: t('planner.addToDay'), icon: CalendarDays, onClick: () => onAssignToDay(place.id, selDayId) },
      place.website && { label: t('inspector.website'), icon: ExternalLink, onClick: () => window.open(place.website, '_blank') },
      (place.lat && place.lng) && { label: 'Google Maps', icon: Navigation, onClick: () => window.open(`https://www.google.com/maps/search/?api=1&query=${(place as any).google_place_id ? encodeURIComponent(place.name) + '&query_place_id=' + (place as any).google_place_id : place.lat + ',' + place.lng}`, '_blank') },
      { divider: true },
      canEditPlaces && { label: t('common.delete'), icon: Trash2, danger: true, onClick: () => onDeletePlace(place.id) },
    ])
  }, [ctxMenu.open, canEditPlaces, t, onEditPlace, onAssignToDay, onDeletePlace])

  return (
    <div
      onDragEnter={handleSidebarDragEnter}
      onDragOver={handleSidebarDragOver}
      onDragLeave={handleSidebarDragLeave}
      onDrop={handleSidebarDrop}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif", position: 'relative' }}
    >
      {sidebarDragOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
          border: '2px dashed var(--accent)',
          borderRadius: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 10, pointerEvents: 'none',
        }}>
          <Upload size={28} strokeWidth={1.5} color="var(--accent)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>{t('places.sidebarDrop')}</span>
        </div>
      )}
      {/* Kopfbereich */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border-faint)', flexShrink: 0 }}>
        {canEditPlaces && <button
          onClick={onAddPlace}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '8px 12px', borderRadius: 12, border: 'none',
            background: 'var(--accent)', color: 'var(--accent-text)', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10,
          }}
        >
          <Plus size={14} strokeWidth={2} /> {t('places.addPlace')}
        </button>}
        {canEditPlaces && <>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            onClick={() => setFileImportOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              flex: 1, padding: '5px 12px', borderRadius: 8,
              border: '1px dashed var(--border-primary)', background: 'none',
              color: 'var(--text-faint)', fontSize: 11, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <Upload size={11} strokeWidth={2} /> {t('places.importFile')}
          </button>
          <button
            onClick={() => setListImportOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              flex: 1, padding: '5px 12px', borderRadius: 8,
              border: '1px dashed var(--border-primary)', background: 'none',
              color: 'var(--text-faint)', fontSize: 11, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <MapPin size={11} strokeWidth={2} /> {t(hasMultipleListImportProviders ? 'places.importList' : 'places.importGoogleList')}
          </button>
        </div>
        <div style={{ height: 1, background: 'var(--border-primary)', margin: '2px 0 10px' }} />
        </>}

        {/* Filter-Tabs */}
        {(() => {
          const baseFiltered = places.filter(p => {
            if (categoryFilters.size > 0) {
              if (p.category_id == null) {
                if (!categoryFilters.has('uncategorized')) return false
              } else if (!categoryFilters.has(String(p.category_id))) return false
            }
            if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
                !(p.address || '').toLowerCase().includes(search.toLowerCase())) return false
            return true
          })
          const counts = {
            all: baseFiltered.length,
            unplanned: baseFiltered.filter(p => !plannedIds.has(p.id)).length,
            tracks: baseFiltered.filter(p => p.route_geometry).length,
          }
          const tabs = ([
            { id: 'all', label: t('places.all') },
            { id: 'unplanned', label: t('places.unplanned') },
            hasTracks ? { id: 'tracks', label: t('places.filterTracks') } : null,
          ] as const).filter(Boolean) as Array<{ id: 'all' | 'unplanned' | 'tracks'; label: string }>
          return (
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {tabs.map(f => {
                const active = filter === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => { setFilter(f.id); onPlacesFilterChange?.(f.id); setSelectedIds(new Set()) }}
                    style={{
                      appearance: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 9px', borderRadius: 99,
                      fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap',
                      background: active ? 'var(--accent)' : 'var(--bg-card)',
                      color: active ? 'var(--accent-text)' : 'var(--text-primary)',
                      boxShadow: active ? 'none' : '0 1px 2px rgba(0,0,0,0.06)',
                      transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
                    }}
                  >
                    {f.label}
                    <span style={{
                      fontSize: 9, fontWeight: 600, lineHeight: 1,
                      background: active ? 'color-mix(in srgb, var(--accent-text) 22%, transparent)' : 'var(--bg-tertiary)',
                      color: active ? 'var(--accent-text)' : 'var(--text-faint)',
                      padding: '1px 5px', borderRadius: 99, minWidth: 14, textAlign: 'center',
                    }}>
                      {counts[f.id]}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })()}

        {/* Suchfeld */}
        <div style={{ position: 'relative' }}>
          <Search size={13} strokeWidth={1.8} color="var(--text-faint)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); if (selectMode) setSelectedIds(new Set()) }}
            placeholder={t('places.search')}
            style={{
              width: '100%', padding: '7px 30px 7px 30px', borderRadius: 10,
              border: 'none', background: 'var(--bg-tertiary)', fontSize: 12, color: 'var(--text-primary)',
              outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={12} strokeWidth={2} color="var(--text-faint)" />
            </button>
          )}
        </div>

        {/* Category multi-select dropdown */}
        {categories.length > 0 && (() => {
          const label = categoryFilters.size === 0
            ? t('places.allCategories')
            : categoryFilters.size === 1
              ? (categoryFilters.has('uncategorized') ? t('places.noCategory') : categories.find(c => categoryFilters.has(String(c.id)))?.name || t('places.allCategories'))
              : `${categoryFilters.size} ${t('places.categoriesSelected')}`
          return (
            <div style={{ marginTop: 6, position: 'relative', display: 'flex', gap: 6, alignItems: 'stretch' }}>
              <button onClick={() => setCatDropOpen(v => !v)} style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border-primary)',
                background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-primary)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--text-faint)', transform: catDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
              </button>
              {canEditPlaces && (
                <Tooltip label={t('common.select')} placement="bottom">
                <button
                  onClick={() => { setSelectMode(v => !v); setSelectedIds(new Set()) }}
                  aria-label={t('common.select')}
                  aria-pressed={selectMode}
                  style={{
                    position: 'relative', width: 30, flexShrink: 0, borderRadius: 8,
                    border: `1px solid ${selectMode ? 'var(--accent)' : 'var(--border-primary)'}`,
                    background: selectMode ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--bg-card)',
                    color: selectMode ? 'var(--accent)' : 'var(--text-faint)',
                    cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                    transition: 'background 0.18s, color 0.18s, border-color 0.18s',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'opacity 0.18s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    opacity: selectMode ? 0 : 1,
                    transform: selectMode ? 'rotate(-90deg) scale(0.6)' : 'rotate(0) scale(1)',
                  }}>
                    <Check size={13} strokeWidth={2.4} />
                  </span>
                  <span style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'opacity 0.18s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
                    opacity: selectMode ? 1 : 0,
                    transform: selectMode ? 'rotate(0) scale(1)' : 'rotate(90deg) scale(0.6)',
                  }}>
                    <X size={13} strokeWidth={2.4} />
                  </span>
                </button>
                </Tooltip>
              )}
              {catDropOpen && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 10,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: 4, maxHeight: 200, overflowY: 'auto',
                }}>
                  {categories.map(c => {
                    const active = categoryFilters.has(String(c.id))
                    const CatIcon = getCategoryIcon(c.icon)
                    return (
                      <button key={c.id} onClick={() => toggleCategoryFilter(String(c.id))} style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: active ? 'var(--bg-hover)' : 'transparent',
                        fontFamily: 'inherit', fontSize: 12, color: 'var(--text-primary)',
                        textAlign: 'left',
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          border: active ? 'none' : '1.5px solid var(--border-primary)',
                          background: active ? (c.color || 'var(--accent)') : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {active && <Check size={10} strokeWidth={3} color="white" />}
                        </div>
                        <CatIcon size={12} strokeWidth={2} color={c.color || 'var(--text-muted)'} />
                        <span style={{ flex: 1 }}>{c.name}</span>
                      </button>
                    )
                  })}
                  {places.some(p => p.category_id == null) && (() => {
                    const active = categoryFilters.has('uncategorized')
                    return (
                      <button onClick={() => toggleCategoryFilter('uncategorized')} style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                        background: active ? 'var(--bg-hover)' : 'transparent',
                        fontFamily: 'inherit', fontSize: 12, color: 'var(--text-muted)',
                        textAlign: 'left', borderTop: '1px solid var(--border-faint)', marginTop: 2,
                      }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          border: active ? 'none' : '1.5px solid var(--border-primary)',
                          background: active ? 'var(--text-faint)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {active && <Check size={10} strokeWidth={3} color="white" />}
                        </div>
                        <MapPin size={12} strokeWidth={2} color="var(--text-faint)" />
                        <span style={{ flex: 1 }}>{t('places.noCategory')}</span>
                      </button>
                    )
                  })()}
                  {categoryFilters.size > 0 && (
                    <button onClick={() => { setCategoryFiltersLocal(new Set()); onCategoryFilterChange?.(new Set()) }} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      width: '100%', padding: '6px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: 'transparent', fontFamily: 'inherit', fontSize: 11, color: 'var(--text-faint)',
                      marginTop: 2, borderTop: '1px solid var(--border-faint)',
                    }}>
                      <X size={10} /> {t('places.clearFilter')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {/* Anzahl / Auswahl-Leiste */}
      {selectMode ? (
        <div style={{
          margin: '6px 16px', padding: '5px 8px 5px 10px', borderRadius: 8,
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, fontSize: 11,
        }}>
          <span style={{ flex: 1, color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {t('places.selectionCount', { count: selectedIds.size })}
          </span>
          <Tooltip label={selectedIds.size === filtered.length && filtered.length > 0 ? t('common.deselectAll') : t('common.selectAll')} placement="bottom">
          <button
            onClick={() => {
              if (selectedIds.size === filtered.length) setSelectedIds(new Set())
              else setSelectedIds(new Set(filtered.map(p => p.id)))
            }}
            aria-label={selectedIds.size === filtered.length && filtered.length > 0 ? t('common.deselectAll') : t('common.selectAll')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: 6, border: 'none',
              background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', padding: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Check size={13} strokeWidth={2.2} />
          </button>
          </Tooltip>
          <Tooltip label={t('places.deleteSelected')} placement="bottom">
          <button
            onClick={() => {
              if (selectedIds.size === 0) return
              if (isMobile) setPendingDeleteIds(Array.from(selectedIds))
              else onBulkDeletePlaces?.(Array.from(selectedIds))
            }}
            disabled={selectedIds.size === 0}
            aria-label={t('places.deleteSelected')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 24, height: 24, borderRadius: 6, border: 'none',
              background: 'transparent',
              color: selectedIds.size > 0 ? '#ef4444' : 'var(--text-faint)',
              cursor: selectedIds.size > 0 ? 'pointer' : 'default', padding: 0,
            }}
            onMouseEnter={e => { if (selectedIds.size > 0) e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 14%, transparent)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
          </Tooltip>
        </div>
      ) : (
        <div style={{ padding: '6px 16px', flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{filtered.length === 1 ? t('places.countSingular') : t('places.count', { count: filtered.length })}</span>
        </div>
      )}

      {/* Liste */}
      <div className="trek-stagger" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} ref={scrollContainerRef} onScroll={(e) => onScrollTopChange?.((e.currentTarget as HTMLElement).scrollTop)}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>
              {filter === 'unplanned' ? t('places.allPlanned') : t('places.noneFound')}
            </span>
            {canEditPlaces && <button onClick={onAddPlace} style={{ fontSize: 12, color: 'var(--text-primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>
              {t('places.addPlace')}
            </button>}
          </div>
        ) : (
          filtered.map(place => {
            const cat = categories.find(c => c.id === place.category_id)
            const isSelected = place.id === selectedPlaceId
            const isPlanned = plannedIds.has(place.id)
            const inDay = inDaySet.has(place.id)
            const isChecked = selectedIds.has(place.id)
            return (
              <MemoPlaceRow
                key={place.id}
                place={place}
                category={cat}
                isSelected={isSelected}
                isPlanned={isPlanned}
                inDay={inDay}
                isChecked={isChecked}
                selectMode={selectMode}
                selectedDayId={selectedDayId}
                canEditPlaces={canEditPlaces}
                isMobile={isMobile}
                t={t}
                onPlaceClick={onPlaceClick}
                onContextMenu={openContextMenu}
                onAssignToDay={onAssignToDay}
                toggleSelected={toggleSelected}
                setDayPickerPlace={setDayPickerPlace}
              />
            )
          })
        )}
      </div>

      {dayPickerPlace && ReactDOM.createPortal(
        <div
          onClick={() => { setDayPickerPlace(null); setMobileShowDays(false) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 500, maxHeight: '70vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 'var(--bottom-nav-h)' }}
          >
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border-secondary)' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{dayPickerPlace.name}</div>
              {dayPickerPlace.address && <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 2 }}>{dayPickerPlace.address}</div>}
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 12px' }}>
              {/* View details */}
              <button
                onClick={() => { onPlaceClick(dayPickerPlace.id); setDayPickerPlace(null); setMobileShowDays(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', textAlign: 'left', fontSize: 14, color: 'var(--text-primary)' }}
              >
                <Eye size={18} color="var(--text-muted)" /> {t('places.viewDetails')}
              </button>
              {/* Edit */}
              {canEditPlaces && (
                <button
                  onClick={() => { onEditPlace(dayPickerPlace); setDayPickerPlace(null); setMobileShowDays(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', textAlign: 'left', fontSize: 14, color: 'var(--text-primary)' }}
                >
                  <Pencil size={18} color="var(--text-muted)" /> {t('common.edit')}
                </button>
              )}
              {/* Assign to day */}
              {days?.length > 0 && (
                <>
                  <button
                    onClick={() => setMobileShowDays(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', textAlign: 'left', fontSize: 14, color: 'var(--text-primary)' }}
                  >
                    <CalendarDays size={18} color="var(--text-muted)" /> {t('places.assignToDay')}
                    <ChevronDown size={14} style={{ marginLeft: 'auto', color: 'var(--text-faint)', transform: mobileShowDays ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                  </button>
                  {mobileShowDays && (
                    <div style={{ paddingLeft: 20 }}>
                      {days.map((day, i) => (
                        <button
                          key={day.id}
                          onClick={() => { onAssignToDay(dayPickerPlace.id, day.id); setDayPickerPlace(null); setMobileShowDays(false) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', textAlign: 'left' }}
                        >
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', flexShrink: 0 }}>{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{day.title || t('dayplan.dayN', { n: i + 1 })}</div>
                            {day.date && <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>{new Date(day.date + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' })}</div>}
                          </div>
                          {(assignments[String(day.id)] || []).some(a => a.place?.id === dayPickerPlace.id) && <Check size={14} color="var(--text-faint)" />}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              {/* Delete */}
              {canEditPlaces && (
                <button
                  onClick={() => { onDeletePlace(dayPickerPlace.id); setDayPickerPlace(null); setMobileShowDays(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'inherit', textAlign: 'left', fontSize: 14, color: '#ef4444' }}
                >
                  <Trash2 size={18} /> {t('common.delete')}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {listImportOpen && ReactDOM.createPortal(
        <div
          onClick={() => { setListImportOpen(false); setListImportUrl('') }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 440, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              {t('places.importList')}
            </div>
            {hasMultipleListImportProviders && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                {availableListImportProviders.map(provider => (
                  <button
                    key={provider}
                    onClick={() => setListImportProvider(provider)}
                    style={{
                      padding: '6px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                      background: listImportProvider === provider ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: listImportProvider === provider ? 'var(--accent-text)' : 'var(--text-muted)',
                    }}
                  >
                    {provider === 'google' ? t('places.importGoogleList') : t('places.importNaverList')}
                  </button>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 16 }}>
              {t(listImportProvider === 'google' ? 'places.googleListHint' : 'places.naverListHint')}
            </div>
            <input
              type="text"
              value={listImportUrl}
              onChange={e => setListImportUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !listImportLoading) handleListImport() }}
              placeholder={listImportProvider === 'google' ? 'https://maps.app.goo.gl/...' : 'https://naver.me/...'}
              autoFocus
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 10,
                border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)',
                fontSize: 13, color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setListImportOpen(false); setListImportUrl('') }}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border-primary)',
                  background: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleListImport}
                disabled={!listImportUrl.trim() || listImportLoading}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: 'none',
                  background: !listImportUrl.trim() || listImportLoading ? 'var(--bg-tertiary)' : 'var(--accent)',
                  color: !listImportUrl.trim() || listImportLoading ? 'var(--text-faint)' : 'var(--accent-text)',
                  fontSize: 13, fontWeight: 500, cursor: !listImportUrl.trim() || listImportLoading ? 'default' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {listImportLoading ? t('common.loading') : t('common.import')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <FileImportModal
        isOpen={fileImportOpen}
        onClose={() => { setFileImportOpen(false); setSidebarDropFile(null) }}
        tripId={tripId}
        pushUndo={pushUndo}
        initialFile={sidebarDropFile}
      />
      <ContextMenu menu={ctxMenu.menu} onClose={ctxMenu.close} />
      {isMobile && (
        <ConfirmDialog
          isOpen={!!pendingDeleteIds?.length}
          onClose={() => setPendingDeleteIds(null)}
          onConfirm={() => { onBulkDeleteConfirm?.(pendingDeleteIds!); setPendingDeleteIds(null) }}
          message={t('trip.confirm.deletePlaces', { count: pendingDeleteIds?.length ?? 0 })}
        />
      )}
    </div>
  )
})

export default PlacesSidebar
