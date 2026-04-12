import React from 'react'
import { CloudOff, CheckCircle2 } from 'lucide-react'
import { useOfflineStore } from '../../store/offlineStore'

interface CacheBadgeProps {
  tripId: number
  fileId: number
}

export default function CacheBadge({ tripId, fileId }: CacheBadgeProps): React.ReactElement | null {
  const offlineModeEnabled = useOfflineStore(s => s.offlineModeEnabled)
  const cachedDocuments = useOfflineStore(s => s.cachedDocuments)

  if (!offlineModeEnabled) return null

  const key = `${tripId}/${fileId}`
  const isCached = key in cachedDocuments

  return (
    <span
      title={isCached ? 'Cached for offline' : 'Not cached'}
      style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
    >
      {isCached
        ? <CheckCircle2 size={13} style={{ color: '#22c55e' }} />
        : <CloudOff size={13} style={{ color: 'var(--text-faint)' }} />}
    </span>
  )
}
