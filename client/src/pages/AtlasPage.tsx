import React, { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { getIntlLanguage, getLocaleForLanguage, useTranslation } from '../i18n'
import { useSettingsStore } from '../store/settingsStore'
import Navbar from '../components/Layout/Navbar'
import apiClient from '../api/client'
import { Globe, MapPin, Briefcase, Calendar, Flag, ChevronRight, PanelLeftOpen, PanelLeftClose, X } from 'lucide-react'
import L from 'leaflet'
import type { AtlasPlace, GeoJsonFeatureCollection, TranslationFn } from '../types'

// Convert country code to flag emoji
interface AtlasCountry {
  code: string
  tripCount: number
  placeCount: number
  firstVisit?: string | null
  lastVisit?: string | null
}

interface AtlasStats {
  totalTrips: number
  totalPlaces: number
  totalCountries: number
  totalDays: number
  totalCities?: number
}

interface AtlasData {
  countries: AtlasCountry[]
  stats: AtlasStats
  mostVisited?: AtlasCountry | null
  continents?: Record<string, number>
  lastTrip?: { id: number; title: string; countryCode?: string } | null
  nextTrip?: { id: number; title: string; countryCode?: string } | null
  streak?: number
  firstYear?: number
  tripsThisYear?: number
}

interface CountryDetail {
  places: AtlasPlace[]
  trips: { id: number; title: string }[]
}

function MobileStats({ data, stats, countries, resolveName, t, dark }: { data: AtlasData | null; stats: AtlasStats; countries: AtlasCountry[]; resolveName: (code: string) => string; t: TranslationFn; dark: boolean }): React.ReactElement {
  const tp = dark ? '#f1f5f9' : '#0f172a'
  const tf = dark ? '#475569' : '#94a3b8'
  const { continents, lastTrip, nextTrip, streak, firstYear, tripsThisYear } = data || {}
  const CL = { 'Europe': t('atlas.europe'), 'Asia': t('atlas.asia'), 'North America': t('atlas.northAmerica'), 'South America': t('atlas.southAmerica'), 'Africa': t('atlas.africa'), 'Oceania': t('atlas.oceania') }
  const thisYear = new Date().getFullYear()

  return (
    <div className="space-y-4">
      {/* Stats grid */}
      <div className="grid grid-cols-5 gap-2">
        {[[stats.totalCountries, t('atlas.countries')], [stats.totalTrips, t('atlas.trips')], [stats.totalPlaces, t('atlas.places')], [stats.totalCities || 0, t('atlas.cities')], [stats.totalDays, t('atlas.days')]].map(([v, l], i) => (
          <div key={i} className="text-center py-2">
            <p className="text-xl font-black tabular-nums" style={{ color: tp }}>{v}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: tf }}>{l}</p>
          </div>
        ))}
      </div>
      {/* Continents */}
      <div className="grid grid-cols-6 gap-1">
        {['Europe', 'Asia', 'North America', 'South America', 'Africa', 'Oceania'].map(cont => {
          const count = continents?.[cont] || 0
          return (
            <div key={cont} className="text-center py-1">
              <p className="text-base font-bold tabular-nums" style={{ color: count > 0 ? tp : (dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)') }}>{count}</p>
              <p className="text-[8px] font-semibold uppercase" style={{ color: count > 0 ? tf : (dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') }}>{CL[cont]}</p>
            </div>
          )
        })}
      </div>
      {/* Highlights */}
      <div className="flex gap-3">
        {streak > 0 && (
          <div className="text-center flex-1 py-2">
            <p className="text-xl font-black tabular-nums" style={{ color: tp }}>{streak}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: tf }}>{streak === 1 ? t('atlas.yearInRow') : t('atlas.yearsInRow')}</p>
          </div>
        )}
        {tripsThisYear > 0 && (
          <div className="text-center flex-1 py-2">
            <p className="text-xl font-black tabular-nums" style={{ color: tp }}>{tripsThisYear}</p>
            <p className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: tf }}>{tripsThisYear === 1 ? t('atlas.tripIn') : t('atlas.tripsIn')} {thisYear}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65))
}

function useCountryNames(language: string): (code: string) => string {
  const [resolver, setResolver] = useState<(code: string) => string>(() => (code: string) => code)
  useEffect(() => {
    try {
      const dn = new Intl.DisplayNames([getIntlLanguage(language)], { type: 'region' })
      setResolver(() => (code: string) => { try { return dn.of(code) || code } catch { return code } })
    } catch { /* */ }
  }, [language])
  return resolver
}

// Map visited country codes to ISO-3166 alpha3 (GeoJSON uses alpha3)
const A2_TO_A3: Record<string, string> = {"AF":"AFG","AL":"ALB","DZ":"DZA","AD":"AND","AO":"AGO","AR":"ARG","AM":"ARM","AU":"AUS","AT":"AUT","AZ":"AZE","BR":"BRA","BE":"BEL","BG":"BGR","CA":"CAN","CL":"CHL","CN":"CHN","CO":"COL","HR":"HRV","CZ":"CZE","DK":"DNK","EG":"EGY","EE":"EST","FI":"FIN","FR":"FRA","DE":"DEU","GR":"GRC","HU":"HUN","IS":"ISL","IN":"IND","ID":"IDN","IR":"IRN","IQ":"IRQ","IE":"IRL","IL":"ISR","IT":"ITA","JP":"JPN","KE":"KEN","KR":"KOR","LV":"LVA","LT":"LTU","LU":"LUX","MY":"MYS","MX":"MEX","MA":"MAR","NL":"NLD","NZ":"NZL","NO":"NOR","PK":"PAK","PE":"PER","PH":"PHL","PL":"POL","PT":"PRT","RO":"ROU","RU":"RUS","SA":"SAU","RS":"SRB","SK":"SVK","SI":"SVN","ZA":"ZAF","ES":"ESP","SE":"SWE","CH":"CHE","TH":"THA","TR":"TUR","UA":"UKR","AE":"ARE","GB":"GBR","US":"USA","VN":"VNM","NG":"NGA"}

export default function AtlasPage(): React.ReactElement {
  const { t, language } = useTranslation()
  const { settings } = useSettingsStore()
  const navigate = useNavigate()
  const resolveName = useCountryNames(language)
  const dm = settings.dark_mode
  const dark = dm === true || dm === 'dark' || (dm === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const geoLayerRef = useRef<L.GeoJSON | null>(null)
  const glareRef = useRef<HTMLDivElement>(null)
  const borderGlareRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const handlePanelMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!panelRef.current || !glareRef.current || !borderGlareRef.current) return
    const rect = panelRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    // Subtle inner glow
    glareRef.current.style.background = `radial-gradient(circle 300px at ${x}px ${y}px, ${dark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.25)'} 0%, transparent 70%)`
    glareRef.current.style.opacity = '1'
    // Border glow that follows cursor
    borderGlareRef.current.style.opacity = '1'
    borderGlareRef.current.style.maskImage = `radial-gradient(circle 150px at ${x}px ${y}px, black 0%, transparent 100%)`
    borderGlareRef.current.style.WebkitMaskImage = `radial-gradient(circle 150px at ${x}px ${y}px, black 0%, transparent 100%)`
  }
  const handlePanelMouseLeave = () => {
    if (glareRef.current) glareRef.current.style.opacity = '0'
    if (borderGlareRef.current) borderGlareRef.current.style.opacity = '0'
  }

  const [data, setData] = useState<AtlasData | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [countryDetail, setCountryDetail] = useState<CountryDetail | null>(null)
  const [geoData, setGeoData] = useState<GeoJsonFeatureCollection | null>(null)

  // Load atlas data
  useEffect(() => {
    apiClient.get('/addons/atlas/stats').then(r => {
      setData(r.data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // Load GeoJSON world data (direct GeoJSON, no conversion needed)
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson')
      .then(r => r.json())
      .then(geo => setGeoData(geo))
      .catch(() => {})
  }, [])

  // Initialize map — runs after loading is done and mapRef is available
  useEffect(() => {
    if (loading || !mapRef.current) return
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null }

    const map = L.map(mapRef.current, {
      center: [25, 0],
      zoom: 3,
      minZoom: 3,
      maxZoom: 7,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [[-90, -220], [90, 220]],
      maxBoundsViscosity: 1.0,
      fadeAnimation: false,
      preferCanvas: true,
    })

    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const tileUrl = dark
      ? 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
      : 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'

    L.tileLayer(tileUrl, {
      maxZoom: 8,
      keepBuffer: 25,
      updateWhenZooming: true,
      updateWhenIdle: false,
      tileSize: 256,
      zoomOffset: 0,
      crossOrigin: true,
      loading: true,
    }).addTo(map)

    // Preload adjacent zoom level tiles
    L.tileLayer(tileUrl, {
      maxZoom: 8,
      keepBuffer: 10,
      opacity: 0,
      tileSize: 256,
      crossOrigin: true,
    }).addTo(map)

    mapInstance.current = map
    return () => { map.remove(); mapInstance.current = null }
  }, [dark, loading])

  // Render GeoJSON countries
  useEffect(() => {
    if (!mapInstance.current || !geoData || !data) return

    const visitedA3 = new Set(data.countries.map(c => A2_TO_A3[c.code]).filter(Boolean))
    const countryMap = {}
    data.countries.forEach(c => { if (A2_TO_A3[c.code]) countryMap[A2_TO_A3[c.code]] = c })

    if (geoLayerRef.current) {
      mapInstance.current.removeLayer(geoLayerRef.current)
    }

    // Generate deterministic color per country code
    const VISITED_COLORS = ['#6366f1','#ec4899','#14b8a6','#f97316','#8b5cf6','#ef4444','#3b82f6','#22c55e','#06b6d4','#f43f5e','#a855f7','#10b981','#0ea5e9','#e11d48','#0d9488','#7c3aed','#2563eb','#dc2626','#059669','#d946ef']
    // Assign colors in order of visit (by index in countries array) so no two neighbors share a color easily
    const visitedA3List = [...visitedA3]
    const colorMap = {}
    visitedA3List.forEach((a3, i) => { colorMap[a3] = VISITED_COLORS[i % VISITED_COLORS.length] })
    const colorForCode = (a3) => colorMap[a3] || VISITED_COLORS[0]

    const canvasRenderer = L.canvas({ padding: 0.5, tolerance: 5 })

    geoLayerRef.current = L.geoJSON(geoData, {
      renderer: canvasRenderer,
      interactive: true,
      bubblingMouseEvents: false,
      style: (feature) => {
        const a3 = feature.properties?.ISO_A3 || feature.properties?.ADM0_A3 || feature.properties?.['ISO3166-1-Alpha-3'] || feature.id
        const visited = visitedA3.has(a3)
        return {
          fillColor: visited ? colorForCode(a3) : (dark ? '#1e1e2e' : '#e2e8f0'),
          fillOpacity: visited ? 0.7 : 0.3,
          color: dark ? '#333' : '#cbd5e1',
          weight: 0.5,
        }
      },
      onEachFeature: (feature, layer) => {
        const a3 = feature.properties?.ISO_A3 || feature.properties?.ADM0_A3 || feature.properties?.['ISO3166-1-Alpha-3'] || feature.id
        const c = countryMap[a3]
        if (c) {
          const name = resolveName(c.code)
          const formatDate = (d) => { if (!d) return '—'; const dt = new Date(d); return dt.toLocaleDateString(getLocaleForLanguage(language), { month: 'short', year: 'numeric' }) }
          const tooltipHtml = `
            <div style="display:flex;flex-direction:column;gap:8px;min-width:160px">
              <div style="font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;padding-bottom:6px;border-bottom:1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}">${name}</div>
              <div style="display:flex;gap:14px">
                <div><span style="font-size:16px;font-weight:800">${c.tripCount}</span> <span style="font-size:10px;opacity:0.5;text-transform:uppercase;letter-spacing:0.05em">${c.tripCount === 1 ? t('atlas.tripSingular') : t('atlas.tripPlural')}</span></div>
                <div><span style="font-size:16px;font-weight:800">${c.placeCount}</span> <span style="font-size:10px;opacity:0.5;text-transform:uppercase;letter-spacing:0.05em">${c.placeCount === 1 ? t('atlas.placeVisited') : t('atlas.placesVisited')}</span></div>
              </div>
              <div style="display:flex;gap:2px;border-top:1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};padding-top:8px">
                <div style="flex:1;display:flex;flex-direction:column;gap:2px">
                  <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.4">${t('atlas.firstVisit')}</span>
                  <span style="font-size:12px;font-weight:700">${formatDate(c.firstVisit)}</span>
                </div>
                <div style="flex:1;display:flex;flex-direction:column;gap:2px">
                  <span style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.4">${t('atlas.lastVisitLabel')}</span>
                  <span style="font-size:12px;font-weight:700">${formatDate(c.lastVisit)}</span>
                </div>
              </div>
              </div>
            </div>`
          layer.bindTooltip(tooltipHtml, {
            sticky: false, permanent: false, className: 'atlas-tooltip', direction: 'top', offset: [0, -10], opacity: 1
          })
          layer.on('click', () => loadCountryDetail(c.code))
          layer.on('mouseover', (e) => {
            e.target.setStyle({ fillOpacity: 0.9, weight: 2, color: dark ? '#818cf8' : '#4f46e5' })
          })
          layer.on('mouseout', (e) => {
            geoLayerRef.current.resetStyle(e.target)
          })
        }
      }
    }).addTo(mapInstance.current)
  }, [geoData, data, dark])

  const loadCountryDetail = async (code: string): Promise<void> => {
    setSelectedCountry(code)
    try {
      const r = await apiClient.get(`/addons/atlas/country/${code}`)
      setCountryDetail(r.data)
    } catch { /* */ }
  }

  const stats = data?.stats || { totalTrips: 0, totalPlaces: 0, totalCountries: 0, totalDays: 0 }
  const countries = data?.countries || []

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <Navbar />
        <div className="flex items-center justify-center" style={{ paddingTop: 'var(--nav-h)', minHeight: 'calc(100vh - var(--nav-h))' }}>
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'var(--text-primary)' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <Navbar />
      <div style={{ position: 'fixed', top: 'var(--nav-h)', left: 0, right: 0, bottom: 0 }}>
        {/* Map */}
        <div ref={mapRef} style={{ position: 'absolute', inset: 0, zIndex: 1, background: dark ? '#1a1a2e' : '#f0f0f0' }} />

        {/* Mobile: Bottom bar */}
        <div className="md:hidden absolute bottom-3 left-0 right-0 z-10 flex justify-center" style={{ touchAction: 'manipulation' }}>
          <div className="flex items-center gap-4 px-5 py-4 rounded-2xl"
            style={{ background: dark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.5)', backdropFilter: 'blur(16px)' }}>
            {/* Countries highlighted */}
            <div className="text-center px-3 py-1.5 rounded-xl" style={{ background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }}>
              <p className="text-3xl font-black tabular-nums leading-none" style={{ color: 'var(--text-primary)' }}>{stats.totalCountries}</p>
              <p className="text-[9px] font-semibold uppercase tracking-wide mt-1" style={{ color: 'var(--text-faint)' }}>{t('atlas.countries')}</p>
            </div>
            {[[stats.totalTrips, t('atlas.trips')], [stats.totalPlaces, t('atlas.places')], [stats.totalCities || 0, t('atlas.cities')], [stats.totalDays, t('atlas.days')]].map(([v, l], i) => (
              <div key={i} className="text-center px-1">
                <p className="text-xl font-black tabular-nums leading-none" style={{ color: 'var(--text-primary)' }}>{v}</p>
                <p className="text-[9px] font-semibold uppercase tracking-wide mt-1" style={{ color: 'var(--text-faint)' }}>{l}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Panel — bottom center, glass effect */}
        <div
          ref={panelRef}
          onMouseMove={handlePanelMouseMove}
          onMouseLeave={handlePanelMouseLeave}
          className="hidden md:flex flex-col absolute z-10 overflow-hidden transition-all duration-300"
          style={{
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'fit-content',
            background: dark ? 'rgba(10,10,15,0.55)' : 'rgba(255,255,255,0.2)',
            backdropFilter: 'blur(24px) saturate(180%)',
            WebkitBackdropFilter: 'blur(24px) saturate(180%)',
            border: '1px solid ' + (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
            borderRadius: 20,
            boxShadow: dark
              ? '0 8px 32px rgba(0,0,0,0.3)'
              : '0 8px 32px rgba(0,0,0,0.08)',
          }}
        >
          {/* Liquid glass glare effect */}
          <div ref={glareRef} className="absolute inset-0 pointer-events-none" style={{ opacity: 0, transition: 'opacity 0.3s ease', borderRadius: 20 }} />
          {/* Border glow that follows cursor */}
          <div ref={borderGlareRef} className="absolute inset-0 pointer-events-none" style={{
            opacity: 0, transition: 'opacity 0.3s ease', borderRadius: 20,
            border: dark ? '1.5px solid rgba(255,255,255,0.5)' : '2px solid rgba(0,0,0,0.15)',
          }} />
          <SidebarContent
            data={data} stats={stats} countries={countries} selectedCountry={selectedCountry}
            countryDetail={countryDetail} resolveName={resolveName}
            onCountryClick={loadCountryDetail} onTripClick={(id) => navigate(`/trips/${id}`)}
            t={t} dark={dark}
          />
        </div>


      </div>
    </div>
  )
}

interface SidebarContentProps {
  data: AtlasData | null
  stats: AtlasStats
  countries: AtlasCountry[]
  selectedCountry: string | null
  countryDetail: CountryDetail | null
  resolveName: (code: string) => string
  onCountryClick: (code: string) => void
  onTripClick: (id: number) => void
  t: TranslationFn
  dark: boolean
}

function SidebarContent({ data, stats, countries, selectedCountry, countryDetail, resolveName, onCountryClick, onTripClick, t, dark }: SidebarContentProps): React.ReactElement {
  const bg = (o) => dark ? `rgba(255,255,255,${o})` : `rgba(0,0,0,${o})`
  const tp = dark ? '#f1f5f9' : '#0f172a'
  const tm = dark ? '#94a3b8' : '#64748b'
  const tf = dark ? '#475569' : '#94a3b8'
  const accent = '#818cf8'

  const { mostVisited, continents, lastTrip, nextTrip, streak, firstYear, tripsThisYear } = data || {}
  const contEntries = continents ? Object.entries(continents).sort((a, b) => b[1] - a[1]) : []
  const maxCont = contEntries.length > 0 ? contEntries[0][1] : 1
  const CL = { 'Europe': t('atlas.europe'), 'Asia': t('atlas.asia'), 'North America': t('atlas.northAmerica'), 'South America': t('atlas.southAmerica'), 'Africa': t('atlas.africa'), 'Oceania': t('atlas.oceania') }
  const contColors = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#fb923c', '#22d3ee']

  if (countries.length === 0 && !lastTrip) {
    return (
      <div className="p-8 text-center">
        <Globe size={28} className="mx-auto mb-2" style={{ color: tf, opacity: 0.4 }} />
        <p className="text-sm font-medium" style={{ color: tm }}>{t('atlas.noData')}</p>
        <p className="text-xs mt-1" style={{ color: tf }}>{t('atlas.noDataHint')}</p>
      </div>
    )
  }

  const thisYear = new Date().getFullYear()
  const divider = `2px solid ${bg(0.08)}`

  return (
    <div className="flex items-stretch justify-center">

      {/* ═══ SECTION 1: Numbers ═══ */}
      {/* Countries hero */}
      <div className="flex items-baseline gap-1.5 px-5 py-4 mx-2 my-2 rounded-xl" style={{ background: bg(0.08) }}>
        <span className="text-5xl font-black tabular-nums leading-none" style={{ color: tp }}>{stats.totalCountries}</span>
        <span className="text-sm font-medium" style={{ color: tm }}>{t('atlas.countries')}</span>
      </div>
      {/* Other stats */}
      {[[stats.totalTrips, t('atlas.trips')], [stats.totalPlaces, t('atlas.places')], [stats.totalCities || 0, t('atlas.cities')], [stats.totalDays, t('atlas.days')]].map(([v, l], i) => (
        <div key={i} className="flex flex-col items-center justify-center px-3 py-5 shrink-0">
          <span className="text-2xl font-black tabular-nums leading-none" style={{ color: tp }}>{v}</span>
          <span className="text-[9px] font-semibold mt-1.5 uppercase tracking-wide whitespace-nowrap" style={{ color: tf }}>{l}</span>
        </div>
      ))}

      {/* ═══ DIVIDER ═══ */}
      <div style={{ width: 2, background: bg(0.08), margin: '12px 14px' }} />

      {/* ═══ SECTION 2: Continents ═══ */}
      <div className="flex items-center gap-4 px-3 py-4 shrink-0">
        {['Europe', 'Asia', 'North America', 'South America', 'Africa', 'Oceania'].map((cont) => {
          const count = continents?.[cont] || 0
          const active = count > 0
          return (
            <div key={cont} className="flex flex-col items-center shrink-0">
              <span className="text-2xl font-black tabular-nums leading-none" style={{ color: active ? tp : bg(0.15) }}>{count}</span>
              <span className="text-[9px] font-semibold mt-1.5 uppercase tracking-wide whitespace-nowrap" style={{ color: active ? tf : bg(0.1) }}>{CL[cont]}</span>
            </div>
          )
        })}
      </div>

      {/* ═══ DIVIDER ═══ */}
      <div style={{ width: 2, background: bg(0.08), margin: '12px 14px' }} />

      {/* ═══ SECTION 3: Highlights & Streaks ═══ */}
      <div className="flex items-center gap-5 px-3 py-4">
        {/* Last trip */}
        {lastTrip && (
          <button onClick={() => onTripClick(lastTrip.id)} className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-75">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: bg(0.06) }}>
              {lastTrip.countryCode ? countryCodeToFlag(lastTrip.countryCode) : <MapPin size={16} style={{ color: tm }} />}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: tf }}>{t('atlas.lastTrip')}</p>
              <p className="text-[13px] font-bold truncate" style={{ color: tp }}>{lastTrip.title}</p>
            </div>
          </button>
        )}
        {/* Streak */}
        {streak > 0 && (
          <div className="flex flex-col items-center justify-center px-3">
            <span className="text-2xl font-black tabular-nums leading-none" style={{ color: tp }}>{streak}</span>
            <span className="text-[9px] font-semibold mt-1.5 uppercase tracking-wide text-center leading-tight whitespace-nowrap" style={{ color: tf }}>
              {streak === 1 ? t('atlas.yearInRow') : t('atlas.yearsInRow')}
            </span>
          </div>
        )}
        {/* This year */}
        {tripsThisYear > 0 && (
          <div className="flex flex-col items-center justify-center px-3">
            <span className="text-2xl font-black tabular-nums leading-none" style={{ color: tp }}>{tripsThisYear}</span>
            <span className="text-[9px] font-semibold mt-1.5 uppercase tracking-wide text-center leading-tight whitespace-nowrap" style={{ color: tf }}>
              {tripsThisYear === 1 ? t('atlas.tripIn') : t('atlas.tripsIn')} {thisYear}
            </span>
          </div>
        )}
      </div>

      {/* ═══ Country detail overlay ═══ */}
      {selectedCountry && countryDetail && (
        <>
          <div style={{ width: 2, background: bg(0.08), margin: '12px 0' }} />
          <div className="flex items-center gap-3 px-6 py-4">
            <span className="text-3xl">{countryCodeToFlag(selectedCountry)}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: tp }}>{resolveName(selectedCountry)}</p>
              <p className="text-[10px] mb-1" style={{ color: tf }}>{countryDetail.places.length} {t('atlas.places')} · {countryDetail.trips.length} Trips</p>
              <div className="flex flex-wrap gap-1">
                {countryDetail.trips.slice(0, 3).map(trip => (
                  <button key={trip.id} onClick={() => onTripClick(trip.id)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-opacity hover:opacity-75"
                    style={{ background: bg(0.08), color: tp }}>
                    <Briefcase size={9} style={{ color: tm }} />
                    {trip.title}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
