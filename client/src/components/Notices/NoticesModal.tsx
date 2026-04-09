import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNoticesStore } from '../../store/noticesStore'
import { useTranslation } from '../../i18n'
import { fireNoticeAction } from '../../lib/noticeActions'

type SlideDir = 'left' | 'right' | null

export default function NoticesModal() {
  const { notices, currentIndex, dismissAll, prev, next } = useNoticesStore()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [slideDir, setSlideDir] = useState<SlideDir>(null)
  const [animKey, setAnimKey] = useState(0)
  const prevIndexRef = useRef(currentIndex)

  useEffect(() => {
    if (notices.length > 0) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [notices.length])

  useEffect(() => {
    if (currentIndex !== prevIndexRef.current) {
      setSlideDir(currentIndex > prevIndexRef.current ? 'left' : 'right')
      setAnimKey((k) => k + 1)
      prevIndexRef.current = currentIndex
    }
  }, [currentIndex])

  if (notices.length === 0) return null

  const notice = notices[currentIndex]
  const total = notices.length
  const isFirst = currentIndex === 0
  const isLast = currentIndex === total - 1

  const handlePrev = () => { prev() }
  const handleNext = () => { next() }

  const handleDismiss = async () => {
    await dismissAll()
  }

  const handleCta = async () => {
    await dismissAll()
    if (notice.cta_action) {
      const fired = fireNoticeAction(notice.cta_action)
      if (!fired && notice.cta_url) navigate(notice.cta_url)
    } else if (notice.cta_url) {
      navigate(notice.cta_url)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(9, 9, 11, 0.65)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-[540px] rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-card)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.3), 0 0 0 1px var(--border-faint)',
          animation: 'noticeCardIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient accent bar */}
        <div
          className="h-1 w-full flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)' }}
        />

        {/* Icon + title area */}
        <div className="flex flex-col items-center px-8 pt-8 pb-6 text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Sparkles className="w-6 h-6 text-white" />
          </div>

          {/* Slide content wrapper */}
          <div
            key={animKey}
            className="w-full"
            style={{ animation: slideDir ? `noticeSlideIn${slideDir === 'left' ? 'Left' : 'Right'} 0.28s cubic-bezier(0.22,1,0.36,1) forwards` : undefined }}
          >
            <h2
              className="text-xl font-bold leading-snug mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              {t(notice.title_key)}
            </h2>
          </div>

          {/* Dot indicators */}
          {total > 1 && (
            <div className="flex items-center gap-2 mt-1">
              {Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (i < currentIndex) { for (let n = currentIndex; n > i; n--) prev() }
                    else if (i > currentIndex) { for (let n = currentIndex; n < i; n++) next() }
                  }}
                  className="rounded-full transition-all duration-200 flex-shrink-0"
                  style={{
                    width: i === currentIndex ? 20 : 6,
                    height: 6,
                    background: i === currentIndex
                      ? 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                      : 'var(--border-primary)',
                  }}
                  aria-label={`Go to notice ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div
          key={`body-${animKey}`}
          className="px-8 pb-6 text-sm leading-relaxed overflow-y-auto"
          style={{
            color: 'var(--text-secondary)',
            maxHeight: 220,
            animation: slideDir ? `noticeSlideIn${slideDir === 'left' ? 'Left' : 'Right'} 0.28s cubic-bezier(0.22,1,0.36,1) forwards` : undefined,
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'underline' }}>
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{children}</strong>
              ),
              ul: ({ children }) => <ul className="list-disc pl-5 space-y-1 mt-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1 mt-2">{children}</ol>,
              code: ({ children }) => (
                <code
                  className="px-1.5 py-0.5 rounded text-xs font-mono"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                >
                  {children}
                </code>
              ),
            }}
          >
            {t(notice.body_key)}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 px-6 py-4"
          style={{ borderTop: '1px solid var(--border-secondary)' }}
        >
          {/* Prev */}
          <button
            onClick={handlePrev}
            disabled={isFirst}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-0 disabled:pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          >
            <ChevronLeft className="w-4 h-4" />
            {t('notices.prev')}
          </button>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {notice.cta_label_key && notice.cta_url ? (
              <>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {t('notices.gotIt')}
                </button>
                <button
                  onClick={handleCta}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {t(notice.cta_label_key)}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={handleDismiss}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
              >
                {t('notices.gotIt')}
              </button>
            )}
          </div>

          {/* Next */}
          <button
            onClick={handleNext}
            disabled={isLast}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-0 disabled:pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          >
            {t('notices.next')}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes noticeCardIn {
          from { opacity: 0; transform: scale(0.92) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes noticeSlideInLeft {
          from { opacity: 0; transform: translateX(32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes noticeSlideInRight {
          from { opacity: 0; transform: translateX(-32px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
