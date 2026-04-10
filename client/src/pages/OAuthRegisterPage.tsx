import React, { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { oauthApi } from '../api/client'
import { ALL_SCOPES } from '../api/oauthScopes'
import ScopeGroupPicker from '../components/OAuth/ScopeGroupPicker'
import { Lock, ShieldCheck, AlertTriangle, Loader2, LogIn } from 'lucide-react'

interface ValidateResult {
  valid: boolean
  error?: string
  error_description?: string
  client_name?: string
  requested_scopes?: string[]
  loginRequired?: boolean
}

type PageState = 'loading' | 'login_required' | 'ready' | 'error' | 'done'

export default function OAuthRegisterPage(): React.ReactElement {
  const { isLoading: authLoading, loadUser } = useAuthStore()
  const [pageState, setPageState]       = useState<PageState>('loading')
  const [validation, setValidation]     = useState<ValidateResult | null>(null)
  const [selectedScopes, setSelectedScopes] = useState<string[]>([])
  const [submitting, setSubmitting]     = useState(false)
  const [errorMsg, setErrorMsg]         = useState<string | null>(null)

  const params     = new URLSearchParams(window.location.search)
  const redirectUri = params.get('redirect_uri') || ''
  const clientName  = params.get('client_name') || ''
  const scope       = params.get('scope') || ''
  const state       = params.get('state') || ''

  useEffect(() => {
    loadUser({ silent: true }).catch(() => {})
  }, [loadUser])

  useEffect(() => {
    if (authLoading) return
    validateRequest()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading])

  async function validateRequest() {
    setPageState('loading')
    try {
      const result: ValidateResult = await oauthApi.register.validate({
        redirect_uri: redirectUri,
        client_name:  clientName,
        scope,
        state,
      })
      setValidation(result)

      if (!result.valid) {
        setPageState('error')
        setErrorMsg(result.error_description || result.error || 'Invalid registration request')
        return
      }

      if (result.loginRequired) {
        setPageState('login_required')
        return
      }

      // Pre-check the scopes the client requested; fall back to read-only defaults
      const requested = result.requested_scopes ?? []
      setSelectedScopes(
        requested.length > 0
          ? requested
          : ALL_SCOPES.filter(s => s.endsWith(':read')),
      )
      setPageState('ready')
    } catch {
      setPageState('error')
      setErrorMsg('Failed to validate registration request. Please try again.')
    }
  }

  function handleLoginRedirect() {
    const next = '/oauth/register?' + params.toString()
    window.location.href = '/login?redirect=' + encodeURIComponent(next)
  }

  async function submitRegistration(approved: boolean) {
    setSubmitting(true)
    try {
      const result = await oauthApi.register.submit({
        client_name:  validation?.client_name || clientName || 'MCP Client',
        redirect_uri: redirectUri,
        scopes:       approved ? selectedScopes : [],
        state,
        approved,
      })
      setPageState('done')
      window.location.href = result.redirect
    } catch {
      setPageState('error')
      setErrorMsg('Registration failed. Please try again.')
      setSubmitting(false)
    }
  }

  // ---- Render states ----

  if (pageState === 'loading' || pageState === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent-primary, #4f46e5)' }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</p>
        </div>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-full max-w-sm rounded-xl shadow-lg p-8 space-y-4 text-center" style={{ background: 'var(--bg-card)' }}>
          <AlertTriangle className="w-10 h-10 mx-auto text-red-500" />
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Registration Error</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{errorMsg}</p>
        </div>
      </div>
    )
  }

  if (pageState === 'login_required') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="w-full max-w-sm rounded-xl shadow-lg p-8 space-y-5" style={{ background: 'var(--bg-card)' }}>
          <div className="text-center space-y-2">
            <Lock className="w-10 h-10 mx-auto" style={{ color: 'var(--accent-primary, #4f46e5)' }} />
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Sign in to continue</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <strong>{clientName || 'This application'}</strong> wants to register for access to your TREK account. Please sign in first.
            </p>
          </div>
          <button
            onClick={handleLoginRedirect}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--accent-primary, #4f46e5)' }}>
            <LogIn className="w-4 h-4" />
            Sign in to TREK
          </button>
        </div>
      </div>
    )
  }

  // pageState === 'ready'
  const displayName = validation?.client_name || clientName || 'MCP Client'

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-2xl rounded-xl shadow-lg overflow-hidden flex flex-col sm:flex-row" style={{ background: 'var(--bg-card)' }}>

        {/* Left panel — identity + actions */}
        <div className="sm:w-64 sm:flex-shrink-0 flex flex-col px-8 py-8 sm:border-r" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex-1 space-y-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-secondary)' }}>
              <ShieldCheck className="w-6 h-6" style={{ color: 'var(--accent-primary, #4f46e5)' }} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>Client Registration</p>
              <h1 className="text-lg font-semibold leading-snug" style={{ color: 'var(--text-primary)' }}>
                {displayName}
              </h1>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                This application wants to access your TREK account. Choose which permissions to grant.
              </p>
            </div>

            <div className="text-xs rounded-lg p-2.5 border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
              <p className="font-medium mb-0.5" style={{ color: 'var(--text-secondary)' }}>Will redirect to</p>
              <p className="font-mono break-all" style={{ color: 'var(--text-tertiary)' }}>{redirectUri}</p>
            </div>
          </div>

          <div className="mt-8 space-y-2">
            <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Only grant access to applications you trust. You can revoke this at any time in Settings.
            </p>
            <button
              onClick={() => submitRegistration(true)}
              disabled={submitting || selectedScopes.length === 0}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-opacity"
              style={{ background: 'var(--accent-primary, #4f46e5)' }}>
              {submitting ? 'Registering…' : 'Register & Authorize'}
            </button>
            <button
              onClick={() => submitRegistration(false)}
              disabled={submitting}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60"
              style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
              Cancel
            </button>
          </div>
        </div>

        {/* Right panel — scope picker */}
        <div className="flex-1 px-6 py-8 overflow-y-auto max-h-[80vh] sm:max-h-[600px]">
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
              Select permissions
            </p>
            <ScopeGroupPicker selected={selectedScopes} onChange={setSelectedScopes} />
          </div>
        </div>

      </div>
    </div>
  )
}
