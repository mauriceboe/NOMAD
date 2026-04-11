import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { journeyApi } from '../api/client'
import { useTranslation, SUPPORTED_LANGUAGES } from '../i18n'
import { useSettingsStore } from '../store/settingsStore'
import { List, Grid, MapPin, Camera, BookOpen, Image } from 'lucide-react'
import JourneyMap from '../components/Journey/JourneyMap'
import JournalBody from '../components/Journey/JournalBody'
import PhotoLightbox from '../components/Journey/PhotoLightbox'

interface PublicEntry {
  id: number
  title?: string | null
  story?: string | null
  entry_date: string
  entry_time?: string | null
  location_name?: string | null
  location_lat?: number | null
  location_lng?: number | null
  mood?: string | null
  weather?: string | null
  pros_cons?: { pros: string[]; cons: string[] } | null
  photos: PublicPhoto[]
}

interface PublicPhoto {
  id: number
  entry_id: number
  provider: string
  asset_id?: string | null
  owner_id?: number | null
  file_path?: string | null
  caption?: string | null
}

function photoUrl(p: PublicPhoto, shareToken: string): string {
  if (p.provider === 'local') return `/api/public/journey/${shareToken}/photo/local/${encodeURIComponent(p.file_path || '')}/0/original`
  return `/api/public/journey/${shareToken}/photo/${p.provider}/${p.asset_id}/${p.owner_id}/original`
}

function formatDate(d: string): { weekday: string; month: string; day: number } {
  const date = new Date(d + 'T00:00:00')
  return {
    weekday: date.toLocaleDateString('en', { weekday: 'long' }),
    month: date.toLocaleDateString('en', { month: 'long' }),
    day: date.getDate(),
  }
}

function groupByDate(entries: PublicEntry[]): Map<string, PublicEntry[]> {
  const groups = new Map<string, PublicEntry[]>()
  for (const e of entries) {
    const d = e.entry_date
    if (!groups.has(d)) groups.set(d, [])
    groups.get(d)!.push(e)
  }
  return groups
}

export default function JourneyPublicPage() {
  const { token } = useParams()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [view, setView] = useState<'timeline' | 'gallery' | 'map'>('timeline')
  const [lightbox, setLightbox] = useState<{ photos: { id: string; src: string; caption?: string | null }[]; index: number } | null>(null)
  const { t } = useTranslation()
  const [showLangPicker, setShowLangPicker] = useState(false)
  const locale = useSettingsStore(s => s.settings.language) || 'en'

  useEffect(() => {
    if (!token) return
    journeyApi.getPublicJourney(token)
      .then(d => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [token])

  const entries = (data?.entries || []) as PublicEntry[]
  const perms = data?.permissions || {}
  const journey = data?.journey || {}
  const stats = data?.stats || {}

  const groupedEntries = useMemo(() => groupByDate(entries), [entries])
  const sortedDates = useMemo(() => [...groupedEntries.keys()].sort(), [groupedEntries])
  const mapEntries = useMemo(() => entries.filter(e => e.location_lat && e.location_lng), [entries])
  const allPhotos = useMemo(() => entries.flatMap(e => (e.photos || []).map(p => ({ photo: p, entry: e }))), [entries])

  // Set default view based on permissions
  useEffect(() => {
    if (!perms.share_timeline && perms.share_gallery) setView('gallery')
    else if (!perms.share_timeline && !perms.share_gallery && perms.share_map) setView('map')
  }, [perms])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">{t('journey.public.notFound')}</h1>
          <p className="text-zinc-500">{t('journey.public.notFoundMessage')}</p>
        </div>
      </div>
    )
  }

  const availableViews = [
    perms.share_timeline && { id: 'timeline' as const, icon: List, label: t('journey.share.timeline') },
    perms.share_gallery && { id: 'gallery' as const, icon: Grid, label: t('journey.share.gallery') },
    perms.share_map && { id: 'map' as const, icon: MapPin, label: t('journey.share.map') },
  ].filter(Boolean) as { id: 'timeline' | 'gallery' | 'map'; icon: any; label: string }[]

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero */}
      <div className="relative text-center text-white" style={{ background: 'linear-gradient(135deg, #000 0%, #0f172a 50%, #1e293b 100%)', padding: '32px 20px 28px' }}>
        {/* Cover image background */}
        {journey.cover_image && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(/uploads/${journey.cover_image})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }} />
        )}
        {/* Decorative circles */}
        <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', bottom: -40, left: -40, width: 150, height: 150, borderRadius: '50%', background: 'rgba(255,255,255,0.02)' }} />

        {/* Language picker */}
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
          <button onClick={() => setShowLangPicker(v => !v)} style={{
            padding: '5px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)',
            color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {SUPPORTED_LANGUAGES.find(l => l.value === (locale?.split('-')[0] || 'en'))?.label || 'Language'}
          </button>
          {showLangPicker && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, background: 'white', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', padding: 4, zIndex: 50, minWidth: 150 }}>
              {SUPPORTED_LANGUAGES.map(lang => (
                <button key={lang.value} onClick={() => {
                  useSettingsStore.setState(s => ({ settings: { ...s.settings, language: lang.value } }))
                  setShowLangPicker(false)
                }}
                  style={{ display: 'block', width: '100%', padding: '6px 12px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: 12, color: '#374151', borderRadius: 6, fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >{lang.label}</button>
              ))}
            </div>
          )}
        </div>

        {/* Logo */}
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)', marginBottom: 12, border: '1px solid rgba(255,255,255,0.1)', position: 'relative' }}>
          <img src="/icons/icon-white.svg" alt="TREK" width={26} height={26} />
        </div>

        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.35, marginBottom: 12, position: 'relative' }}>{t('journey.public.tagline')}</div>

        <h1 className="relative" style={{ margin: '0 0 4px', fontSize: 26, fontWeight: 700, letterSpacing: -0.5 }}>{journey.title}</h1>

        {journey.subtitle && (
          <div className="relative" style={{ fontSize: 13, opacity: 0.5, maxWidth: 400, margin: '0 auto', lineHeight: 1.5 }}>{journey.subtitle}</div>
        )}

        {/* Stats pill */}
        <div className="relative" style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 18px', borderRadius: 20, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 5 }}><BookOpen size={12} /> {stats.entries} {t('journey.stats.entries')}</span>
          <span style={{ fontSize: 11, opacity: 0.4 }}>·</span>
          <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 5 }}><Camera size={12} /> {stats.photos} {t('journey.stats.photos')}</span>
          <span style={{ fontSize: 11, opacity: 0.4 }}>·</span>
          <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.8, display: 'flex', alignItems: 'center', gap: 5 }}><MapPin size={12} /> {stats.cities} {t('journey.stats.places')}</span>
        </div>

        <div className="relative" style={{ marginTop: 12, fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.25 }}>{t('journey.public.readOnly')}</div>
      </div>

      {/* Content */}
      <div className="max-w-[900px] mx-auto px-4 md:px-8 py-6">

        {/* View tabs */}
        {availableViews.length > 1 && (
          <div className="flex bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden mb-6 w-fit">
            {availableViews.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-[7px] text-[12px] font-medium ${
                  view === v.id
                    ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <v.icon size={13} />
                {v.label}
              </button>
            ))}
          </div>
        )}

        {/* Timeline */}
        {view === 'timeline' && perms.share_timeline && (
          <div className="flex flex-col gap-6">
            {sortedDates.map(date => {
              const dayEntries = groupedEntries.get(date)!
              const fd = formatDate(date)
              return (
                <div key={date}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center text-[14px] font-bold">{fd.day}</div>
                    <div>
                      <div className="text-[14px] font-semibold text-zinc-900 dark:text-white">{fd.weekday}</div>
                      <div className="text-[11px] text-zinc-500">{fd.month} {fd.day}</div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 pl-[52px]">
                    {dayEntries.map(entry => (
                      <div key={entry.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl overflow-hidden">
                        {entry.photos.length > 0 && (
                          <div className="relative">
                            <img
                              src={photoUrl(entry.photos[0], token!)}
                              className="w-full h-52 object-cover cursor-pointer"
                              alt=""
                              onClick={() => setLightbox({ photos: entry.photos.map(p => ({ id: String(p.id), src: photoUrl(p, token!), caption: p.caption })), index: 0 })}
                            />
                            {entry.photos.length > 1 && (
                              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur text-white rounded-full px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1">
                                <Image size={10} /> +{entry.photos.length - 1}
                              </div>
                            )}
                            {entry.title && (
                              <div className="absolute inset-x-0 bottom-0 p-4" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)' }}>
                                <h3 className="text-[18px] font-bold text-white drop-shadow-sm">{entry.title}</h3>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="px-5 py-4">
                          {!entry.photos.length && entry.title && (
                            <h3 className="text-[16px] font-semibold text-zinc-900 dark:text-white mb-1">{entry.title}</h3>
                          )}
                          {entry.location_name && (
                            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 mb-2">
                              <MapPin size={11} /> {entry.location_name}
                            </div>
                          )}
                          {entry.story && (
                            <div className="text-[13px] text-zinc-700 dark:text-zinc-300 leading-relaxed">
                              <JournalBody text={entry.story} />
                            </div>
                          )}
                          {entry.pros_cons && ((entry.pros_cons.pros?.length ?? 0) > 0 || (entry.pros_cons.cons?.length ?? 0) > 0) && (
                            <div className="grid grid-cols-2 gap-3 mt-4">
                              {(entry.pros_cons.pros?.length ?? 0) > 0 && (
                                <div className="rounded-xl border border-green-200 dark:border-green-800/30 p-3" style={{ background: 'linear-gradient(180deg, #F0FDF4 0%, white 100%)' }}>
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-green-700 mb-2">{t('journey.editor.pros')}</div>
                                  {entry.pros_cons.pros!.map((p, i) => (
                                    <div key={i} className="flex items-start gap-1.5 text-[12px] text-green-900 mb-1">
                                      <span className="w-[5px] h-[5px] rounded-full bg-green-500 flex-shrink-0 mt-[6px]" />{p}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {(entry.pros_cons.cons?.length ?? 0) > 0 && (
                                <div className="rounded-xl border border-red-200 dark:border-red-800/30 p-3" style={{ background: 'linear-gradient(180deg, #FEF2F2 0%, white 100%)' }}>
                                  <div className="text-[10px] font-bold uppercase tracking-wide text-red-700 mb-2">{t('journey.editor.cons')}</div>
                                  {entry.pros_cons.cons!.map((c, i) => (
                                    <div key={i} className="flex items-start gap-1.5 text-[12px] text-red-900 mb-1">
                                      <span className="w-[5px] h-[5px] rounded-full bg-red-500 flex-shrink-0 mt-[6px]" />{c}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Gallery */}
        {view === 'gallery' && perms.share_gallery && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
            {allPhotos.map(({ photo }, idx) => (
              <div
                key={photo.id}
                className="aspect-square rounded-lg overflow-hidden cursor-pointer"
                onClick={() => setLightbox({ photos: allPhotos.map(({ photo: p }) => ({ id: String(p.id), src: photoUrl(p, token!), caption: p.caption })), index: idx })}
              >
                <img src={photoUrl(photo, token!)} className="w-full h-full object-cover hover:scale-105 transition-transform" alt="" loading="lazy" />
              </div>
            ))}
          </div>
        )}

        {/* Map */}
        {view === 'map' && perms.share_map && (
          <div className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-700">
            <JourneyMap
              checkins={[]}
              entries={mapEntries.map(e => ({
                id: String(e.id),
                lat: e.location_lat!,
                lng: e.location_lng!,
                title: e.title || '',
                mood: e.mood,
                created_at: e.entry_date,
                entry_date: e.entry_date,
              })) as any}
              height={500}
            />
          </div>
        )}
      </div>

      {/* Powered by */}
      <div className="flex flex-col items-center py-8 gap-2">
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20, background: 'white', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <img src="/icons/icon.svg" alt="TREK" width={18} height={18} style={{ borderRadius: 4 }} />
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{t('journey.public.sharedVia')} <strong style={{ color: '#6b7280' }}>TREK</strong></span>
        </div>
        <div style={{ fontSize: 10, color: '#d1d5db' }}>
          Made with <span style={{ color: '#ef4444' }}>♥</span> by Maurice · <a href="https://github.com/mauriceboe/TREK" style={{ color: '#9ca3af', textDecoration: 'none' }}>GitHub</a>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <PhotoLightbox
          photos={lightbox.photos}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
