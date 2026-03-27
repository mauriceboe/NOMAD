import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { MapPin, Plus, Navigation, Loader, Search, X } from 'lucide-react'

const NEARBY_TRIP_RADIUS_KM = 1
const MAX_POI_RESULTS = 30
const RADIUS_STEPS = [50, 100, 150, 200, 250, 300, 400, 500, 750, 1000]

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(1)} km`
}

function formatRadius(m) {
  return m >= 1000 ? `${m / 1000} km` : `${m} m`
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'en' } }
    )
    if (res.ok) {
      const data = await res.json()
      return data.display_name || null
    }
  } catch {}
  return null
}

function buildAddressFromTags(tags) {
  const parts = []
  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`)
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street'])
  }
  const cityParts = [tags['addr:postcode'], tags['addr:city']].filter(Boolean)
  if (cityParts.length) parts.push(cityParts.join(' '))
  return parts.length ? parts.join(', ') : null
}

const btnBase = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '6px 12px', borderRadius: 10, minHeight: 30,
  fontSize: 12, fontWeight: 500, cursor: 'pointer',
  fontFamily: 'inherit', transition: 'background 0.15s, opacity 0.15s', border: 'none',
}

export default function NearbyPlacesModal({ lat, lng, existingPlaces, onClose, onAddPlace, radiusM, onRadiusChange }) {
  const [pois, setPois] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [searched, setSearched] = useState(false)
  const [addingId, setAddingId] = useState(null)

  const radiusIdx = RADIUS_STEPS.indexOf(radiusM)
  const effectiveIdx = radiusIdx >= 0 ? radiusIdx : 3

  // Clear results when radius changes
  useEffect(() => {
    setPois([])
    setSearched(false)
    setError(null)
  }, [radiusM])

  const nearbyTrip = useMemo(() => {
    return (existingPlaces || [])
      .filter(p => p.lat && p.lng)
      .map(p => ({ ...p, distKm: haversineKm(lat, lng, p.lat, p.lng) }))
      .filter(p => p.distKm <= NEARBY_TRIP_RADIUS_KM)
      .sort((a, b) => a.distKm - b.distKm)
  }, [existingPlaces, lat, lng])

  const fetchPois = useCallback(async () => {
    setLoading(true)
    setError(null)
    setSearched(false)
    const query = `
      [out:json][timeout:10];
      (
        node["amenity"]["name"](around:${radiusM},${lat},${lng});
        node["tourism"]["name"](around:${radiusM},${lat},${lng});
        node["historic"]["name"](around:${radiusM},${lat},${lng});
        node["leisure"]["name"](around:${radiusM},${lat},${lng});
        node["shop"]["name"](around:${radiusM},${lat},${lng});
      );
      out body;
    `
    try {
      const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      if (!res.ok) throw new Error('Overpass request failed')
      const data = await res.json()
      const results = (data.elements || [])
        .filter(el => el.tags?.name)
        .map(el => {
          const typeKey = ['amenity', 'tourism', 'historic', 'leisure', 'shop'].find(k => el.tags[k])
          return {
            id: el.id,
            name: el.tags.name,
            type: typeKey ? (el.tags[typeKey] || typeKey) : 'place',
            lat: el.lat,
            lng: el.lon,
            distKm: haversineKm(lat, lng, el.lat, el.lon),
            _tags: el.tags,
          }
        })
        .sort((a, b) => a.distKm - b.distKm)
        .slice(0, MAX_POI_RESULTS)
      setPois(results)
      setSearched(true)
    } catch (err) {
      setError('Could not load nearby places. Check your connection.')
    } finally {
      setLoading(false)
    }
  }, [lat, lng, radiusM])

  const handleAdd = useCallback(async (poi) => {
    setAddingId(poi.id)
    let address = buildAddressFromTags(poi._tags || {})
    if (!address) address = await reverseGeocode(poi.lat, poi.lng)
    setAddingId(null)
    onAddPlace({ name: poi.name, lat: poi.lat, lng: poi.lng, ...(address ? { address } : {}) })
  }, [onAddPlace])

  const sectionStyle = {
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: 'var(--text-muted)',
    padding: '12px 16px 6px',
  }

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    borderBottom: '1px solid var(--border-faint)',
    transition: 'background 0.1s',
  }

  const renderTripRow = (place) => (
    <div key={place.id} style={rowStyle}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: place.category_color || '#6b7280',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 14,
      }}>
        {place.category_icon || '📍'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {place.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
          {place.category_name && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{place.category_name}</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Navigation size={9} />
            {formatDist(place.distKm)}
          </span>
        </div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--text-faint)', flexShrink: 0, fontStyle: 'italic' }}>already in list</span>
    </div>
  )

  const renderPoiRow = (poi) => (
    <div key={poi.id} style={rowStyle}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: 'var(--bg-tertiary)',
        border: '1.5px solid var(--border-secondary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {poi.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{poi.type}</span>
          <span style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Navigation size={9} />
            {formatDist(poi.distKm)}
          </span>
        </div>
      </div>
      <button
        onClick={() => onAddPlace({ name: poi.name, lat: poi.lat, lng: poi.lng })}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 10px', borderRadius: 8, border: 'none',
          background: 'var(--accent)', color: 'var(--accent-text)',
          fontSize: 11, fontWeight: 600, cursor: 'pointer',
          flexShrink: 0, transition: 'opacity 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        <Plus size={11} />
        Add
      </button>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      width: 'min(800px, calc(100vw - 32px))', zIndex: 50,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
    }}>
      <div style={{
        background: 'var(--bg-elevated)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        borderRadius: 20,
        boxShadow: '0 8px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        maxHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Header — matches PlaceInspector header layout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 16px 14px', borderBottom: '1px solid var(--border-faint)' }}>
          <div style={{ borderRadius: '50%', padding: 2.5, background: 'transparent', flexShrink: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={24} color="rgba(255,255,255,0.92)" strokeWidth={1.8} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>Close Places</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              {Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-hover)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-start', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          >
            <X size={14} strokeWidth={2} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Radius slider */}
          <div style={{ background: 'var(--bg-hover)', borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Search radius</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 6 }}>
                {formatRadius(radiusM)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={RADIUS_STEPS.length - 1}
              step={1}
              value={effectiveIdx}
              onChange={e => onRadiusChange(RADIUS_STEPS[Number(e.target.value)])}
              style={{ width: '100%', accentColor: '#6366f1', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {[0, Math.floor((RADIUS_STEPS.length - 1) / 2), RADIUS_STEPS.length - 1].map(i => (
                <span key={i} style={{ fontSize: 10, color: 'var(--text-faint)' }}>{formatRadius(RADIUS_STEPS[i])}</span>
              ))}
            </div>
          </div>

          {/* Existing trip places within 1 km */}
          {nearbyTrip.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                In your trip list
              </div>
              <div style={{ background: 'var(--bg-hover)', borderRadius: 10, overflow: 'hidden' }}>
                {nearbyTrip.map((place, idx) => (
                  <div key={place.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: idx < nearbyTrip.length - 1 ? '1px solid var(--border-faint)' : 'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: place.category_color || '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                      {place.category_icon || '📍'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{place.name}</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 1 }}>
                        {place.category_name && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{place.category_name}</span>}
                        <span style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Navigation size={9} />{formatDist(place.distKm)}
                        </span>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic', flexShrink: 0 }}>in list</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* POI results */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              <Loader size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> Searching…
            </div>
          )}
          {!loading && error && <p style={{ fontSize: 13, color: '#ef4444', margin: 0 }}>{error}</p>}
          {!loading && searched && !error && pois.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>No named places found within {formatRadius(radiusM)}.</p>
          )}
          {!loading && !error && pois.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                Nearby · {formatRadius(radiusM)}
              </div>
              <div style={{ background: 'var(--bg-hover)', borderRadius: 10, overflow: 'hidden' }}>
                {pois.map((poi, idx) => (
                  <div key={poi.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: idx < pois.length - 1 ? '1px solid var(--border-faint)' : 'none' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1.5px solid var(--border-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <MapPin size={14} color="var(--text-muted)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{poi.name}</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 1 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{poi.type}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Navigation size={9} />{formatDist(poi.distKm)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAdd(poi)}
                      disabled={!!addingId}
                      style={{ ...btnBase, background: 'var(--bg-elevated)', color: 'var(--text-secondary)', opacity: addingId === poi.id ? 0.6 : 1, cursor: addingId === poi.id ? 'wait' : 'pointer' }}
                    >
                      {addingId === poi.id
                        ? <Loader size={11} style={{ animation: 'spin 0.8s linear infinite' }} />
                        : <Plus size={11} />}
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer — matches PlaceInspector footer */}
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-faint)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => onAddPlace({ lat, lng })}
            style={{ ...btnBase, background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Add custom place here</span>
            <span className="sm:hidden">Custom</span>
          </button>
          <button
            onClick={fetchPois}
            disabled={loading}
            style={{ ...btnBase, background: '#111827', color: 'white', opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? <Loader size={11} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Search size={11} />}
            Search
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
