import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X, Camera, Aperture } from 'lucide-react'
import apiClient from '../../api/client'

interface LightboxPhoto {
  id: string
  src: string
  caption?: string | null
  provider?: string
  asset_id?: string | null
  owner_id?: number | null
}

interface ExifData {
  camera?: string
  lens?: string
  focalLength?: string
  aperture?: string
  shutter?: string
  iso?: number
  fileName?: string
}

interface Props {
  photos: LightboxPhoto[]
  startIndex?: number
  onClose: () => void
}

export default function PhotoLightbox({ photos, startIndex = 0, onClose }: Props) {
  const [idx, setIdx] = useState(startIndex)
  const [exif, setExif] = useState<ExifData | null>(null)
  const [exifLoading, setExifLoading] = useState(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const photo = photos[idx]
  const hasPrev = idx > 0
  const hasNext = idx < photos.length - 1

  const prev = useCallback(() => { if (hasPrev) setIdx(i => i - 1) }, [hasPrev])
  const next = useCallback(() => { if (hasNext) setIdx(i => i + 1) }, [hasNext])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onClose])

  // Fetch EXIF data for Immich photos
  useEffect(() => {
    setExif(null)
    if (!photo || photo.provider !== 'immich' || !photo.asset_id || !photo.owner_id) return
    let cancelled = false
    setExifLoading(true)
    apiClient.get(`/integrations/memories/immich/assets/0/${photo.asset_id}/${photo.owner_id}/info`)
      .then(r => {
        if (!cancelled && r.data) {
          const d = r.data
          const parts: Partial<ExifData> = {}
          if (d.camera && d.camera.trim() && d.camera !== 'undefined undefined') parts.camera = d.camera
          if (d.lens) parts.lens = d.lens
          if (d.focalLength) parts.focalLength = d.focalLength
          if (d.aperture) parts.aperture = d.aperture
          if (d.shutter) parts.shutter = d.shutter
          if (d.iso) parts.iso = d.iso
          if (d.fileName) parts.fileName = d.fileName
          if (Object.keys(parts).length > 0) setExif(parts)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setExifLoading(false) })
    return () => { cancelled = true }
  }, [photo])

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y

    // swipe down to close
    if (dy > 80 && Math.abs(dx) < 60) {
      onClose()
      return
    }
    // horizontal swipe
    if (Math.abs(dx) > 50 && Math.abs(dy) < 80) {
      if (dx < 0) next()
      else prev()
    }
    touchStart.current = null
  }

  if (!photo) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          {idx + 1} / {photos.length}
        </span>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer',
        }}>
          <X size={18} />
        </button>
      </div>

      {/* Photo */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {hasPrev && (
          <button onClick={prev} className="hidden sm:flex" style={{
            position: 'absolute', left: 12, zIndex: 2,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', cursor: 'pointer',
          }}>
            <ChevronLeft size={20} />
          </button>
        )}

        <div style={{ position: 'relative', display: 'inline-flex' }}>
          <img
            key={photo.id}
            src={photo.src}
            alt={photo.caption || ''}
            style={{
              maxWidth: '90vw', maxHeight: 'calc(100vh - 140px)',
              objectFit: 'contain', borderRadius: 4,
              animation: 'fadeIn 0.15s ease',
            }}
          />

          {/* EXIF metadata overlay */}
          {exif && !exifLoading && (
            <div style={{
              position: 'absolute', bottom: 12, right: 12,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(16px)',
              borderRadius: 12, padding: '10px 14px',
              color: 'rgba(255,255,255,0.85)', fontSize: 11,
              display: 'flex', flexDirection: 'column', gap: 4,
              maxWidth: 220, border: '1px solid rgba(255,255,255,0.08)',
            }}>
              {exif.camera && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Camera size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
                  <span style={{ fontWeight: 500 }}>{exif.camera}</span>
                </div>
              )}
              {exif.lens && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', paddingLeft: 17 }}>{exif.lens}</div>
              )}
              {(exif.focalLength || exif.aperture || exif.shutter || exif.iso) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <Aperture size={11} style={{ opacity: 0.6, flexShrink: 0 }} />
                  <span style={{ fontWeight: 400, letterSpacing: '0.02em' }}>
                    {[exif.focalLength, exif.aperture, exif.shutter, exif.iso ? `ISO ${exif.iso}` : ''].filter(Boolean).join(' · ')}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {hasNext && (
          <button onClick={next} className="hidden sm:flex" style={{
            position: 'absolute', right: 12, zIndex: 2,
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', cursor: 'pointer',
          }}>
            <ChevronRight size={20} />
          </button>
        )}
      </div>

      {/* Caption */}
      {photo.caption && (
        <div style={{ textAlign: 'center', padding: '12px 24px 20px', flexShrink: 0 }}>
          <p style={{
            fontFamily: 'var(--font-system)', fontSize: 14, fontStyle: 'italic',
            color: 'rgba(255,255,255,0.7)', margin: 0, lineHeight: 1.5,
          }}>{photo.caption}</p>
        </div>
      )}
    </div>
  )
}
