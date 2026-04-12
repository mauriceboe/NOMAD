import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

interface LightboxPhoto {
  id: string
  src: string
  caption?: string | null
  provider?: string
  asset_id?: string | null
  owner_id?: number | null
}

interface Props {
  photos: LightboxPhoto[]
  startIndex?: number
  onClose: () => void
}

export default function PhotoLightbox({ photos, startIndex = 0, onClose }: Props) {
  const [idx, setIdx] = useState(startIndex)
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
      {/* Photo area — centered with nav overlays */}
      <div
        className="group/lightbox"
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}
      >
        {/* Top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500 }}>
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

        {/* Prev button — visible on hover (desktop), always visible (mobile) */}
        {hasPrev && (
          <button onClick={prev} className="flex sm:opacity-0 sm:group-hover/lightbox:opacity-100 transition-opacity" style={{
            position: 'absolute', left: 16, zIndex: 5,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', cursor: 'pointer',
          }}>
            <ChevronLeft size={22} />
          </button>
        )}

        {/* Photo */}
        <img
          key={photo.id}
          src={photo.src}
          alt={photo.caption || ''}
          style={{
            maxWidth: '92vw', maxHeight: '92vh',
            objectFit: 'contain', borderRadius: 4,
            animation: 'fadeIn 0.15s ease',
          }}
        />

        {/* Next button */}
        {hasNext && (
          <button onClick={next} className="flex sm:opacity-0 sm:group-hover/lightbox:opacity-100 transition-opacity" style={{
            position: 'absolute', right: 16, zIndex: 5,
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            alignItems: 'center', justifyContent: 'center',
            color: '#fff', cursor: 'pointer',
          }}>
            <ChevronRight size={22} />
          </button>
        )}

        {/* Caption — bottom center overlay */}
        {photo.caption && (
          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 5, maxWidth: '70%', textAlign: 'center' }}>
            <p style={{
              fontSize: 14, fontStyle: 'italic',
              color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5,
              background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)',
              padding: '6px 14px', borderRadius: 10,
            }}>{photo.caption}</p>
          </div>
        )}
      </div>
    </div>
  )
}
