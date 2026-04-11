import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react'
import L from 'leaflet'
import { useSettingsStore } from '../../store/settingsStore'

export interface MapMarkerItem {
  id: string
  lat: number
  lng: number
  label: string
  mood?: string | null
  time: string
}

export interface JourneyMapHandle {
  highlightMarker: (id: string | null) => void
  focusMarker: (id: string) => void
}

interface MapEntry {
  id: string
  lat: number
  lng: number
  title?: string | null
  mood?: string | null
  entry_date: string
}

interface Props {
  checkins: any[]
  entries: MapEntry[]
  trail?: { lat: number; lng: number }[]
  height?: number
  dark?: boolean
  activeMarkerId?: string | null
  onMarkerClick?: (id: string, type?: string) => void
}

function buildMarkerItems(entries: MapEntry[]): MapMarkerItem[] {
  const items: MapMarkerItem[] = []
  for (const e of entries) {
    if (e.lat && e.lng) {
      items.push({
        id: e.id,
        lat: e.lat,
        lng: e.lng,
        label: e.title || 'Entry',
        mood: e.mood,
        time: e.entry_date,
      })
    }
  }
  items.sort((a, b) => a.time.localeCompare(b.time))
  return items
}

const MARKER_W = 28
const MARKER_H = 36

function markerSvg(index: number, highlighted: boolean, dark: boolean): string {
  const fill = dark
    ? (highlighted ? '#FAFAFA' : '#FAFAFA')
    : (highlighted ? '#18181B' : '#18181B')
  const textColor = dark
    ? (highlighted ? '#18181B' : '#18181B')
    : (highlighted ? '#fff' : '#fff')
  const stroke = dark ? '#3F3F46' : '#fff'
  const shadow = highlighted
    ? 'filter:drop-shadow(0 0 8px rgba(0,0,0,0.4)) drop-shadow(0 2px 6px rgba(0,0,0,0.3))'
    : 'filter:drop-shadow(0 2px 4px rgba(0,0,0,0.25))'
  const label = String(index + 1)
  const scale = highlighted ? 1.2 : 1

  return `<div style="transform:scale(${scale});transition:transform 0.2s ease;${shadow};transform-origin:bottom center">
    <svg width="${MARKER_W}" height="${MARKER_H}" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 34C14 34 26 22.36 26 13C26 6.37 20.63 1 14 1C7.37 1 2 6.37 2 13C2 22.36 14 34 14 34Z" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
      <circle cx="14" cy="13" r="8" fill="${fill}"/>
      <text x="14" y="13" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-family="-apple-system,system-ui,sans-serif" font-size="11" font-weight="700">${label}</text>
    </svg>
  </div>`
}

const EMPTY_TRAIL: { lat: number; lng: number }[] = []

const JourneyMap = forwardRef<JourneyMapHandle, Props>(function JourneyMap(
  { entries, trail, height = 220, dark, activeMarkerId, onMarkerClick },
  ref
) {
  const stableTrail = trail || EMPTY_TRAIL
  const mapTileUrl = useSettingsStore(s => s.settings.map_tile_url)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())
  const itemsRef = useRef<MapMarkerItem[]>([])
  const highlightedRef = useRef<string | null>(null)
  const onMarkerClickRef = useRef(onMarkerClick)
  onMarkerClickRef.current = onMarkerClick

  const darkRef = useRef(dark)
  darkRef.current = dark

  const highlightMarker = useCallback((id: string | null) => {
    const prev = highlightedRef.current
    highlightedRef.current = id
    const isDark = !!darkRef.current

    if (prev && prev !== id) {
      const marker = markersRef.current.get(prev)
      const item = itemsRef.current.find(i => i.id === prev)
      if (marker && item) {
        const idx = itemsRef.current.indexOf(item)
        marker.setIcon(L.divIcon({
          className: '',
          iconSize: [MARKER_W, MARKER_H],
          iconAnchor: [MARKER_W / 2, MARKER_H],
          html: markerSvg(idx, false, isDark),
        }))
        marker.setZIndexOffset(0)
      }
    }

    if (id) {
      const marker = markersRef.current.get(id)
      const item = itemsRef.current.find(i => i.id === id)
      if (marker && item) {
        const idx = itemsRef.current.indexOf(item)
        marker.setIcon(L.divIcon({
          className: '',
          iconSize: [MARKER_W, MARKER_H],
          iconAnchor: [MARKER_W / 2, MARKER_H],
          html: markerSvg(idx, true, isDark),
        }))
        marker.setZIndexOffset(1000)
      }
    }
  }, [])

  const focusMarker = useCallback((id: string) => {
    highlightMarker(id)
    const marker = markersRef.current.get(id)
    if (marker && mapRef.current) {
      mapRef.current.flyTo(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 12), { duration: 0.5 })
    }
  }, [])

  useImperativeHandle(ref, () => ({ highlightMarker, focusMarker }), [])

  useEffect(() => {
    if (!containerRef.current) return

    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }
    markersRef.current.clear()

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: true,
      touchZoom: true,
    })
    mapRef.current = map

    const defaultTile = dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    L.tileLayer(mapTileUrl || defaultTile, { maxZoom: 18 }).addTo(map)

    const items = buildMarkerItems(entries)
    itemsRef.current = items

    const allCoords: L.LatLngTuple[] = []

    if (stableTrail.length > 1) {
      const coords = stableTrail.map(p => [p.lat, p.lng] as L.LatLngTuple)
      L.polyline(coords, {
        color: '#6366f1', weight: 3, opacity: 0.4,
        dashArray: '6 4', lineCap: 'round',
      }).addTo(map)
      coords.forEach(c => allCoords.push(c))
    }

    // route polyline — subtle dashed connection
    if (items.length > 1) {
      const routeCoords = items.map(i => [i.lat, i.lng] as L.LatLngTuple)
      L.polyline(routeCoords, {
        color: dark ? '#71717A' : '#A1A1AA',
        weight: 1.5,
        opacity: 0.5,
        dashArray: '4 6',
        lineCap: 'round', lineJoin: 'round',
      }).addTo(map)
    }

    // place markers
    items.forEach((item, i) => {
      const pos: L.LatLngTuple = [item.lat, item.lng]
      allCoords.push(pos)

      const icon = L.divIcon({
        className: '',
        iconSize: [MARKER_W, MARKER_H],
        iconAnchor: [MARKER_W / 2, MARKER_H],
        html: markerSvg(i, false, !!dark),
      })

      const marker = L.marker(pos, { icon }).addTo(map)
      marker.bindTooltip(item.label, {
        direction: 'top',
        offset: [0, -MARKER_H],
        className: 'map-tooltip',
      })

      marker.on('click', () => {
        onMarkerClickRef.current?.(item.id)
      })

      markersRef.current.set(item.id, marker)
    })

    // fit bounds
    requestAnimationFrame(() => {
      if (!mapRef.current) return
      try {
        map.invalidateSize()
        if (allCoords.length > 0) {
          map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50], maxZoom: 14 })
        } else {
          map.setView([30, 0], 2)
        }
      } catch {}
    })

    setTimeout(() => {
      if (mapRef.current) map.invalidateSize()
    }, 200)

    return () => {
      map.remove()
      mapRef.current = null
      markersRef.current.clear()
    }
  }, [entries, stableTrail, dark, mapTileUrl])

  // react to activeMarkerId prop changes — runs after map is built
  useEffect(() => {
    if (!activeMarkerId || !mapRef.current) return
    // small delay to ensure markers are rendered after map build
    const timer = setTimeout(() => {
      highlightMarker(activeMarkerId)
      const marker = markersRef.current.get(activeMarkerId)
      if (marker && mapRef.current) {
        mapRef.current.flyTo(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 12), { duration: 0.5 })
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [activeMarkerId])

  const zoomIn = () => mapRef.current?.zoomIn()
  const zoomOut = () => mapRef.current?.zoomOut()

  return (
    <div style={{ position: 'relative', height: height === 9999 ? '100%' : height, width: '100%', borderRadius: 'inherit', overflow: 'hidden' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%' }}
      />
      <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 400, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          onClick={zoomIn}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
            color: dark ? '#fff' : '#18181B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1,
          }}
        >+</button>
        <button
          onClick={zoomOut}
          style={{
            width: 32, height: 32, borderRadius: 8,
            background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
            color: dark ? '#fff' : '#18181B',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, fontWeight: 700, lineHeight: 1,
          }}
        >−</button>
      </div>
    </div>
  )
})

export default JourneyMap
