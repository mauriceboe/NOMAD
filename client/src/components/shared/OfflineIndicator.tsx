import React from 'react'
import { WifiOff } from 'lucide-react'
import { useNetworkStatus } from '../../hooks/useNetworkStatus'
import { useOfflineStore } from '../../store/offlineStore'
import { useTranslation } from '../../i18n'

export default function OfflineIndicator(): React.ReactElement | null {
  const { isOnline } = useNetworkStatus()
  const offlineModeEnabled = useOfflineStore(s => s.offlineModeEnabled)
  const { t } = useTranslation()

  if (isOnline || !offlineModeEnabled) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 16px',
      borderRadius: 24,
      background: 'var(--bg-card)',
      border: '1px solid var(--border-primary)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      fontSize: 13,
      color: 'var(--text-secondary)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    }}>
      <WifiOff size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
      {t('offline.banner')}
    </div>
  )
}
