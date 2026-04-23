import React, { useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from '../../i18n'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = true,
}: ConfirmDialogProps) {
  const { t } = useTranslation()

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
    }
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
        className="trek-modal-enter rounded-2xl shadow-2xl w-full max-w-sm p-6"
        style={{ background: 'var(--bg-card)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          {danger && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title || t('common.confirm')}
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {message}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            style={{
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-secondary)',
            }}
          >
            {cancelLabel || t('common.cancel')}
          </button>
          <button
            onClick={() => { onConfirm(); onClose() }}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors text-white ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmLabel || t('common.delete')}
          </button>
        </div>
      </div>

    </div>
  )
}
