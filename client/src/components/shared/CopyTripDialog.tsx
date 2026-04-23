import React, { useEffect, useCallback } from 'react'
import { Check, X } from 'lucide-react'
import { useTranslation } from '../../i18n'

interface CopyTripDialogProps {
  isOpen: boolean
  tripTitle: string
  onClose: () => void
  onConfirm: () => void
}

const WILL_COPY_KEYS = [
  'dashboard.confirm.copy.will1',
  'dashboard.confirm.copy.will2',
  'dashboard.confirm.copy.will3',
  'dashboard.confirm.copy.will4',
  'dashboard.confirm.copy.will5',
  'dashboard.confirm.copy.will6',
]

const WONT_COPY_KEYS = [
  'dashboard.confirm.copy.wont1',
  'dashboard.confirm.copy.wont2',
  'dashboard.confirm.copy.wont3',
  'dashboard.confirm.copy.wont4',
]

export default function CopyTripDialog({ isOpen, tripTitle, onClose, onConfirm }: CopyTripDialogProps) {
  const { t } = useTranslation()

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, handleEsc])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center px-4 trek-backdrop-enter"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)', paddingBottom: 'var(--bottom-nav-h)' }}
      onClick={onClose}
    >
      <div
        className="trek-modal-enter rounded-2xl shadow-2xl w-full max-w-md p-6"
        style={{ background: 'var(--bg-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {t('dashboard.confirm.copy.title')}
        </h3>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          {tripTitle}
        </p>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-secondary)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#16a34a' }}>
              {t('dashboard.confirm.copy.willCopy')}
            </p>
            <ul className="flex flex-col gap-1">
              {WILL_COPY_KEYS.map(key => (
                <li key={key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Check size={13} className="flex-shrink-0" style={{ color: '#16a34a' }} />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl p-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-secondary)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
              {t('dashboard.confirm.copy.wontCopy')}
            </p>
            <ul className="flex flex-col gap-1">
              {WONT_COPY_KEYS.map(key => (
                <li key={key} className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <X size={13} className="flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-secondary)' }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors text-white bg-blue-600 hover:bg-blue-700"
          >
            {t('dashboard.confirm.copy.confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
