import React, { useState, useEffect } from 'react'
import { adminApi, tripsApi } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import { useToast } from '../shared/Toast'
import { Bell, Send, Zap, ArrowRight, CheckCircle, XCircle, Navigation, User } from 'lucide-react'

interface Trip {
  id: number
  title: string
}

interface AppUser {
  id: number
  username: string
  email: string
}

export default function DevNotificationsPanel(): React.ReactElement {
  const toast = useToast()
  const user = useAuthStore(s => s.user)
  const [sending, setSending] = useState<string | null>(null)
  const [trips, setTrips] = useState<Trip[]>([])
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  useEffect(() => {
    tripsApi.list().then(data => {
      const list = (data.trips || data || []) as Trip[]
      setTrips(list)
      if (list.length > 0) setSelectedTripId(list[0].id)
    }).catch(() => {})
    adminApi.users().then(data => {
      const list = (data.users || data || []) as AppUser[]
      setUsers(list)
      if (list.length > 0) setSelectedUserId(list[0].id)
    }).catch(() => {})
  }, [])

  const send = async (label: string, payload: Record<string, unknown>) => {
    setSending(label)
    try {
      await adminApi.sendTestNotification(payload)
      toast.success(`Sent: ${label}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed')
    } finally {
      setSending(null)
    }
  }

  const buttons = [
    {
      label: 'Simple → Me',
      icon: Bell,
      color: '#6366f1',
      payload: {
        type: 'simple',
        scope: 'user',
        target: user?.id,
        title_key: 'notifications.test.title',
        title_params: { actor: user?.username || 'Admin' },
        text_key: 'notifications.test.text',
        text_params: {},
      },
    },
    {
      label: 'Boolean → Me',
      icon: CheckCircle,
      color: '#10b981',
      payload: {
        type: 'boolean',
        scope: 'user',
        target: user?.id,
        title_key: 'notifications.test.booleanTitle',
        title_params: { actor: user?.username || 'Admin' },
        text_key: 'notifications.test.booleanText',
        text_params: {},
        positive_text_key: 'notifications.test.accept',
        negative_text_key: 'notifications.test.decline',
        positive_callback: { action: 'test_approve', payload: {} },
        negative_callback: { action: 'test_deny', payload: {} },
      },
    },
    {
      label: 'Navigate → Me',
      icon: Navigation,
      color: '#f59e0b',
      payload: {
        type: 'navigate',
        scope: 'user',
        target: user?.id,
        title_key: 'notifications.test.navigateTitle',
        title_params: {},
        text_key: 'notifications.test.navigateText',
        text_params: {},
        navigate_text_key: 'notifications.test.goThere',
        navigate_target: '/dashboard',
      },
    },
    {
      label: 'Simple → Admins',
      icon: Zap,
      color: '#ef4444',
      payload: {
        type: 'simple',
        scope: 'admin',
        target: 0,
        title_key: 'notifications.test.adminTitle',
        title_params: {},
        text_key: 'notifications.test.adminText',
        text_params: { actor: user?.username || 'Admin' },
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="px-2 py-0.5 rounded text-xs font-mono font-bold" style={{ background: '#fbbf24', color: '#000' }}>
          DEV ONLY
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          Notification Testing
        </span>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Send test notifications to yourself, all admins, or trip members. These use test i18n keys.
      </p>

      {/* Quick-fire buttons */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Quick Send</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {buttons.map(btn => {
            const Icon = btn.icon
            return (
              <button
                key={btn.label}
                onClick={() => send(btn.label, btn.payload)}
                disabled={sending !== null}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left"
                style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: `${btn.color}20`, color: btn.color }}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{btn.label}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>
                    {btn.payload.type} · {btn.payload.scope}
                  </p>
                </div>
                {sending === btn.label && (
                  <div className="ml-auto w-4 h-4 border-2 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Trip-scoped notifications */}
      {trips.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>Trip-Scoped</h3>
          <div className="flex gap-2 mb-2">
            <select
              value={selectedTripId ?? ''}
              onChange={e => setSelectedTripId(Number(e.target.value))}
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            >
              {trips.map(trip => (
                <option key={trip.id} value={trip.id}>{trip.title}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => selectedTripId && send('Simple → Trip', {
                type: 'simple',
                scope: 'trip',
                target: selectedTripId,
                title_key: 'notifications.test.tripTitle',
                title_params: { actor: user?.username || 'Admin' },
                text_key: 'notifications.test.tripText',
                text_params: { trip: trips.find(t => t.id === selectedTripId)?.title || 'Trip' },
              })}
              disabled={sending !== null || !selectedTripId}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#8b5cf620', color: '#8b5cf6' }}>
                <Send className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Simple → Trip Members</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>simple · trip</p>
              </div>
            </button>
            <button
              onClick={() => selectedTripId && send('Navigate → Trip', {
                type: 'navigate',
                scope: 'trip',
                target: selectedTripId,
                title_key: 'notifications.test.tripTitle',
                title_params: { actor: user?.username || 'Admin' },
                text_key: 'notifications.test.tripText',
                text_params: { trip: trips.find(t => t.id === selectedTripId)?.title || 'Trip' },
                navigate_text_key: 'notifications.test.goThere',
                navigate_target: `/trips/${selectedTripId}`,
              })}
              disabled={sending !== null || !selectedTripId}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#f59e0b20', color: '#f59e0b' }}>
                <ArrowRight className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Navigate → Trip Members</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>navigate · trip</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* User-scoped notifications */}
      {users.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>User-Scoped</h3>
          <div className="flex gap-2 mb-2">
            <select
              value={selectedUserId ?? ''}
              onChange={e => setSelectedUserId(Number(e.target.value))}
              className="flex-1 px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.username} ({u.email})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => selectedUserId && send(`Simple → ${users.find(u => u.id === selectedUserId)?.username}`, {
                type: 'simple',
                scope: 'user',
                target: selectedUserId,
                title_key: 'notifications.test.title',
                title_params: { actor: user?.username || 'Admin' },
                text_key: 'notifications.test.text',
                text_params: {},
              })}
              disabled={sending !== null || !selectedUserId}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#06b6d420', color: '#06b6d4' }}>
                <User className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Simple → User</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>simple · user</p>
              </div>
            </button>
            <button
              onClick={() => selectedUserId && send(`Boolean → ${users.find(u => u.id === selectedUserId)?.username}`, {
                type: 'boolean',
                scope: 'user',
                target: selectedUserId,
                title_key: 'notifications.test.booleanTitle',
                title_params: { actor: user?.username || 'Admin' },
                text_key: 'notifications.test.booleanText',
                text_params: {},
                positive_text_key: 'notifications.test.accept',
                negative_text_key: 'notifications.test.decline',
                positive_callback: { action: 'test_approve', payload: {} },
                negative_callback: { action: 'test_deny', payload: {} },
              })}
              disabled={sending !== null || !selectedUserId}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#10b98120', color: '#10b981' }}>
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Boolean → User</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>boolean · user</p>
              </div>
            </button>
            <button
              onClick={() => selectedUserId && send(`Navigate → ${users.find(u => u.id === selectedUserId)?.username}`, {
                type: 'navigate',
                scope: 'user',
                target: selectedUserId,
                title_key: 'notifications.test.navigateTitle',
                title_params: {},
                text_key: 'notifications.test.navigateText',
                text_params: {},
                navigate_text_key: 'notifications.test.goThere',
                navigate_target: '/dashboard',
              })}
              disabled={sending !== null || !selectedUserId}
              className="flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left"
              style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-card)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: '#f59e0b20', color: '#f59e0b' }}>
                <ArrowRight className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Navigate → User</p>
                <p className="text-xs" style={{ color: 'var(--text-faint)' }}>navigate · user</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
