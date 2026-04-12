import React from 'react'
import { WifiOff, RefreshCw, CheckCircle } from 'lucide-react'
import { useTranslation } from '../../i18n'
import { useOfflineStore } from '../../store/offlineStore'
import Section from './Section'
import ToggleSwitch from './ToggleSwitch'

function formatRelativeTime(isoString: string | null, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (!isoString) return ''
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (minutes < 1) return t('common.justNow')
  if (hours < 1) return `${minutes}m ago`
  if (days < 1) return t('common.hoursAgo', { count: hours })
  return t('common.daysAgo', { count: days })
}

export default function OfflineTab(): React.ReactElement {
  const { t } = useTranslation()
  const {
    offlineModeEnabled,
    setOfflineMode,
    cachedTrips,
    cachedDocuments,
    lastSyncAt,
    isSyncing,
    syncAllTrips,
  } = useOfflineStore()

  const cachedTripList = Object.values(cachedTrips)
  const cachedDocCount = Object.keys(cachedDocuments).length

  return (
    <>
      {/* Offline mode toggle */}
      <Section title={t('offline.title')} icon={WifiOff}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', marginBottom: 4 }}>
              {t('offline.enabled')}
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {t('offline.description')}
            </p>
          </div>
          <ToggleSwitch
            on={offlineModeEnabled}
            onToggle={() => setOfflineMode(!offlineModeEnabled)}
          />
        </div>

        {offlineModeEnabled && (
          <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--border-secondary)' }}>
            {/* Last sync + Sync Now button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {isSyncing
                  ? <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={13} className="animate-spin" />{t('offline.syncing')}</span>
                  : lastSyncAt
                    ? t('offline.lastSync', { time: formatRelativeTime(lastSyncAt, t) })
                    : t('offline.neverSynced')}
              </span>
              <button
                onClick={() => syncAllTrips()}
                disabled={isSyncing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                  borderRadius: 8, border: '1px solid var(--border-primary)',
                  background: 'var(--bg-card)', color: 'var(--text-primary)',
                  cursor: isSyncing ? 'not-allowed' : 'pointer', opacity: isSyncing ? 0.5 : 1,
                  fontSize: 13, fontFamily: 'inherit',
                }}
              >
                <RefreshCw size={13} />
                {t('offline.syncNow')}
              </button>
            </div>

            {/* Cached trips list */}
            {cachedTripList.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  {t('offline.cachedTrips')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {cachedTripList.map((trip) => (
                    <div key={trip.tripId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {trip.tripName}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
                        <CheckCircle size={12} style={{ color: '#22c55e' }} />
                        {formatRelativeTime(trip.cachedAt, t)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Document cache summary */}
            {cachedDocCount > 0 && (
              <p style={{ marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
                {t('offline.cachedDocuments', { count: cachedDocCount })}
              </p>
            )}
          </div>
        )}
      </Section>
    </>
  )
}
