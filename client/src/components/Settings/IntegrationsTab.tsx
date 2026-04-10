import Section from './Section'
import React, { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n'
import { useToast } from '../shared/Toast'
import { Trash2, Copy, Terminal, Plus, Check, KeyRound, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { authApi, oauthApi } from '../../api/client'
import { useAddonStore } from '../../store/addonStore'
import PhotoProvidersSection from './PhotoProvidersSection'
import { ALL_SCOPES } from '../../api/oauthScopes'
import ScopeGroupPicker from '../OAuth/ScopeGroupPicker'

interface OAuthPreset {
  id: string
  label: string
  name: string
  uris: string
  scopes: string[]
}

const OAUTH_PRESETS: OAuthPreset[] = [
  {
    id: 'claude-web',
    label: 'Claude.ai',
    name: 'Claude.ai',
    uris: 'https://claude.ai/api/mcp/auth_callback',
    scopes: ALL_SCOPES.filter(s => !s.includes(':delete')),
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    name: 'Claude Desktop',
    uris: 'http://localhost',
    scopes: ALL_SCOPES.filter(s => !s.includes(':delete')),
  },
  {
    id: 'cursor',
    label: 'Cursor',
    name: 'Cursor',
    uris: 'http://localhost',
    scopes: ALL_SCOPES.filter(s => !s.includes(':delete')),
  },
  {
    id: 'vscode',
    label: 'VS Code',
    name: 'VS Code / Copilot',
    uris: 'http://localhost',
    scopes: ALL_SCOPES.filter(s => s.endsWith(':read')),
  },
  {
    id: 'windsurf',
    label: 'Windsurf',
    name: 'Windsurf',
    uris: 'http://localhost',
    scopes: ALL_SCOPES.filter(s => !s.includes(':delete')),
  },
  {
    id: 'zed',
    label: 'Zed',
    name: 'Zed',
    uris: 'http://localhost',
    scopes: ALL_SCOPES.filter(s => !s.includes(':delete')),
  },
]


interface OAuthClient {
  id: string
  name: string
  client_id: string
  redirect_uris: string[]
  allowed_scopes: string[]
  created_at: string
  client_secret?: string // only present on create
}

interface OAuthSession {
  id: number
  client_id: string
  client_name: string
  scopes: string[]
  access_token_expires_at: string
  refresh_token_expires_at: string
  created_at: string
}

interface McpToken {
  id: number
  name: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
}

export default function IntegrationsTab(): React.ReactElement {
  const { t, locale } = useTranslation()
  const toast = useToast()
  const { isEnabled: addonEnabled, loadAddons } = useAddonStore()
  const mcpEnabled = addonEnabled('mcp')

  useEffect(() => {
    loadAddons()
  }, [loadAddons])

  // OAuth clients state
  const [oauthClients, setOauthClients] = useState<OAuthClient[]>([])
  const [oauthSessions, setOauthSessions] = useState<OAuthSession[]>([])
  const [oauthCreateOpen, setOauthCreateOpen] = useState(false)
  const [oauthNewName, setOauthNewName] = useState('')
  const [oauthNewUris, setOauthNewUris] = useState('')
  const [oauthNewScopes, setOauthNewScopes] = useState<string[]>([])
  const [oauthCreating, setOauthCreating] = useState(false)
  const [oauthCreatedClient, setOauthCreatedClient] = useState<OAuthClient | null>(null)
  const [oauthDeleteId, setOauthDeleteId] = useState<string | null>(null)
  const [oauthRevokeId, setOauthRevokeId] = useState<number | null>(null)
  const [oauthRotateId, setOauthRotateId] = useState<string | null>(null)
  const [oauthRotatedSecret, setOauthRotatedSecret] = useState<string | null>(null)
  const [oauthRotating, setOauthRotating] = useState(false)
  // oauthScopesOpen is managed internally by ScopeGroupPicker
  const [oauthScopesExpanded, setOauthScopesExpanded] = useState<Record<string, boolean>>({})

  // MCP sub-tab state
  const [activeMcpTab, setActiveMcpTab] = useState<'oauth' | 'apitokens'>('oauth')
  const [configOpenOAuth, setConfigOpenOAuth] = useState(false)
  const [configOpenToken, setConfigOpenToken] = useState(false)

  // MCP state
  const [mcpTokens, setMcpTokens] = useState<McpToken[]>([])
  const [mcpModalOpen, setMcpModalOpen] = useState(false)
  const [mcpNewName, setMcpNewName] = useState('')
  const [mcpCreatedToken, setMcpCreatedToken] = useState<string | null>(null)
  const [mcpCreating, setMcpCreating] = useState(false)
  const [mcpDeleteId, setMcpDeleteId] = useState<number | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const mcpEndpoint = `${window.location.origin}/mcp`
  const mcpJsonConfigOAuth = `{
  "mcpServers": {
    "trek": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${mcpEndpoint}",
        "--static-oauth-client-info",
        "{\\"client_id\\": \\"<your_client_id>\\", \\"client_secret\\": \\"<your_client_secret>\\"}"
      ]
    }
  }
}`
  const mcpJsonConfig = `{
  "mcpServers": {
    "trek": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "${mcpEndpoint}",
        "--header",
        "Authorization: Bearer <your_token>"
      ]
    }
  }
}`

  useEffect(() => {
    if (mcpEnabled) {
      authApi.mcpTokens.list().then(d => setMcpTokens(d.tokens || [])).catch(() => {})
    }
  }, [mcpEnabled])

  const handleCreateMcpToken = async () => {
    if (!mcpNewName.trim()) return
    setMcpCreating(true)
    try {
      const d = await authApi.mcpTokens.create(mcpNewName.trim())
      setMcpCreatedToken(d.token.raw_token)
      setMcpNewName('')
      setMcpTokens(prev => [{ id: d.token.id, name: d.token.name, token_prefix: d.token.token_prefix, created_at: d.token.created_at, last_used_at: null }, ...prev])
    } catch {
      toast.error(t('settings.mcp.toast.createError'))
    } finally {
      setMcpCreating(false)
    }
  }

  const handleDeleteMcpToken = async (id: number) => {
    try {
      await authApi.mcpTokens.delete(id)
      setMcpTokens(prev => prev.filter(tk => tk.id !== id))
      setMcpDeleteId(null)
      toast.success(t('settings.mcp.toast.deleted'))
    } catch {
      toast.error(t('settings.mcp.toast.deleteError'))
    }
  }

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2000)
    })
  }

  // Load OAuth clients and sessions
  useEffect(() => {
    if (mcpEnabled) {
      oauthApi.clients.list().then(d => setOauthClients(d.clients || [])).catch(() => {})
      oauthApi.sessions.list().then(d => setOauthSessions(d.sessions || [])).catch(() => {})
    }
  }, [mcpEnabled])

  const handleCreateOAuthClient = async () => {
    if (!oauthNewName.trim() || !oauthNewUris.trim()) return
    setOauthCreating(true)
    try {
      const uris = oauthNewUris.split('\n').map(u => u.trim()).filter(Boolean)
      const d = await oauthApi.clients.create({ name: oauthNewName.trim(), redirect_uris: uris, allowed_scopes: oauthNewScopes })
      setOauthCreatedClient(d.client)
      setOauthClients(prev => [...prev, { ...d.client, client_secret: undefined }])
      setOauthNewName('')
      setOauthNewUris('')
      setOauthNewScopes([])
    } catch {
      toast.error(t('settings.oauth.toast.createError'))
    } finally {
      setOauthCreating(false)
    }
  }

  const handleDeleteOAuthClient = async (id: string) => {
    try {
      await oauthApi.clients.delete(id)
      setOauthClients(prev => prev.filter(c => c.id !== id))
      setOauthDeleteId(null)
      toast.success(t('settings.oauth.toast.deleted'))
    } catch {
      toast.error(t('settings.oauth.toast.deleteError'))
    }
  }

  const handleRotateSecret = async (id: string) => {
    setOauthRotating(true)
    try {
      const d = await oauthApi.clients.rotate(id)
      setOauthRotatedSecret(d.client_secret)
      setOauthRotateId(null)
    } catch {
      toast.error(t('settings.oauth.toast.rotateError'))
    } finally {
      setOauthRotating(false)
    }
  }

  const handleRevokeSession = async (id: number) => {
    try {
      await oauthApi.sessions.revoke(id)
      setOauthSessions(prev => prev.filter(s => s.id !== id))
      setOauthRevokeId(null)
      toast.success(t('settings.oauth.toast.revoked'))
    } catch {
      toast.error(t('settings.oauth.toast.revokeError'))
    }
  }

  return (
    <>
      <PhotoProvidersSection />
      {mcpEnabled && (
        <Section title={t('settings.mcp.title')} icon={Terminal}>
          {/* Endpoint URL */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('settings.mcp.endpoint')}</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg text-sm font-mono border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                {mcpEndpoint}
              </code>
              <button onClick={() => handleCopy(mcpEndpoint, 'endpoint')}
                className="p-2 rounded-lg border transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                style={{ borderColor: 'var(--border-primary)' }} title={t('settings.mcp.copy')}>
                {copiedKey === 'endpoint' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />}
              </button>
            </div>
          </div>

          {/* Sub-tab bar */}
          <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
            <button
              onClick={() => setActiveMcpTab('oauth')}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeMcpTab === 'oauth' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}>
              {t('settings.oauth.clients')}
            </button>
            <button
              onClick={() => setActiveMcpTab('apitokens')}
              className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
                activeMcpTab === 'apitokens' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}>
              {t('settings.mcp.apiTokens')}
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ background: 'rgba(245,158,11,0.15)', color: '#b45309', border: '1px solid rgba(245,158,11,0.4)' }}>
                Deprecated
              </span>
            </button>
          </div>

          {/* OAuth 2.1 Clients tab */}
          {activeMcpTab === 'oauth' && (
            <>
              {/* JSON config — OAuth (collapsible) */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
                <button
                  onClick={() => setConfigOpenOAuth(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('settings.mcp.clientConfig')}</span>
                  {configOpenOAuth ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} /> : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />}
                </button>
                {configOpenOAuth && (
                  <div className="p-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="flex justify-end mb-1.5">
                      <button onClick={() => handleCopy(mcpJsonConfigOAuth, 'json-oauth')}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                        {copiedKey === 'json-oauth' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        {copiedKey === 'json-oauth' ? t('settings.mcp.copied') : t('settings.mcp.copy')}
                      </button>
                    </div>
                    <pre className="p-3 rounded-lg text-xs font-mono overflow-x-auto border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                      {mcpJsonConfigOAuth}
                    </pre>
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('settings.mcp.clientConfigHintOAuth')}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>{t('settings.oauth.clientsHint')}</p>

                <div className="flex justify-end mb-2">
                  <button onClick={() => { setOauthCreateOpen(true); setOauthCreatedClient(null); setOauthNewName(''); setOauthNewUris(''); setOauthNewScopes([]) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-slate-900 text-white hover:bg-slate-700">
                    <Plus className="w-3.5 h-3.5" /> {t('settings.oauth.createClient')}
                  </button>
                </div>

                {oauthClients.length === 0 ? (
                  <p className="text-sm py-3 text-center rounded-lg border" style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-primary)' }}>
                    {t('settings.oauth.noClients')}
                  </p>
                ) : (
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
                    {oauthClients.map((client, i) => (
                      <div key={client.id} className="px-4 py-3"
                        style={{ borderBottom: i < oauthClients.length - 1 ? '1px solid var(--border-primary)' : undefined }}>
                        <div className="flex items-center gap-3">
                          <KeyRound className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
                            <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                              {t('settings.oauth.clientId')}: {client.client_id}
                              <span className="ml-3 font-sans">{t('settings.mcp.tokenCreatedAt')} {new Date(client.created_at).toLocaleDateString(locale)}</span>
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {(oauthScopesExpanded[client.id] ? client.allowed_scopes : client.allowed_scopes.slice(0, 5)).map(s => (
                                <span key={s} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', border: '1px solid var(--border-primary)' }}>{s}</span>
                              ))}
                              {client.allowed_scopes.length > 5 && (
                                <button
                                  onClick={() => setOauthScopesExpanded(prev => ({ ...prev, [client.id]: !prev[client.id] }))}
                                  className="px-1.5 py-0.5 rounded text-xs transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                                  style={{ color: 'var(--text-tertiary)', border: '1px solid var(--border-primary)' }}>
                                  {oauthScopesExpanded[client.id] ? '−' : `+${client.allowed_scopes.length - 5}`}
                                </button>
                              )}
                            </div>
                          </div>
                          <button onClick={() => setOauthRotateId(client.id)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20"
                            style={{ color: 'var(--text-tertiary)' }} title={t('settings.oauth.rotateSecret')}>
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button onClick={() => setOauthDeleteId(client.id)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                            style={{ color: 'var(--text-tertiary)' }} title={t('settings.oauth.deleteClient')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active OAuth Sessions */}
              {oauthSessions.length > 0 && (
                <div>
                  <label className="text-sm font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.activeSessions')}</label>
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
                    {oauthSessions.map((session, i) => (
                      <div key={session.id} className="flex items-center gap-3 px-4 py-3"
                        style={{ borderBottom: i < oauthSessions.length - 1 ? '1px solid var(--border-primary)' : undefined }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{session.client_name}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                            {t('settings.oauth.sessionScopes')}: {session.scopes.join(', ')}
                            <span className="ml-3">{t('settings.oauth.sessionExpires')} {new Date(session.access_token_expires_at).toLocaleDateString(locale)}</span>
                          </p>
                        </div>
                        <button onClick={() => setOauthRevokeId(session.id)}
                          className="px-2.5 py-1 rounded text-xs border transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-tertiary)' }}>
                          {t('settings.oauth.revoke')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* API Tokens tab (deprecated) */}
          {activeMcpTab === 'apitokens' && (
            <>
              <div className="flex items-baseline gap-2 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <span className="text-amber-500 flex-shrink-0 leading-none">⚠</span>
                <p className="text-xs" style={{ color: '#92400e' }}>{t('settings.mcp.apiTokensDeprecated')}</p>
              </div>

              {/* JSON config — API Token (collapsible) */}
              <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
                <button
                  onClick={() => setConfigOpenToken(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                  style={{ background: 'var(--bg-secondary)' }}>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('settings.mcp.clientConfig')}</span>
                  {configOpenToken ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} /> : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />}
                </button>
                {configOpenToken && (
                  <div className="p-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                    <div className="flex justify-end mb-1.5">
                      <button onClick={() => handleCopy(mcpJsonConfig, 'json-token')}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                        {copiedKey === 'json-token' ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                        {copiedKey === 'json-token' ? t('settings.mcp.copied') : t('settings.mcp.copy')}
                      </button>
                    </div>
                    <pre className="p-3 rounded-lg text-xs font-mono overflow-x-auto border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                      {mcpJsonConfig}
                    </pre>
                    <p className="mt-1.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('settings.mcp.clientConfigHint')}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button onClick={() => { setMcpModalOpen(true); setMcpCreatedToken(null); setMcpNewName('') }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors opacity-60"
                  style={{ background: 'var(--bg-tertiary, #e5e7eb)', color: 'var(--text-secondary)' }}>
                  <Plus className="w-3.5 h-3.5" /> {t('settings.mcp.createToken')}
                </button>
              </div>

              {mcpTokens.length === 0 ? (
                <p className="text-sm py-2 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  {t('settings.mcp.noTokens')}
                </p>
              ) : (
                <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
                  {mcpTokens.map((token, i) => (
                    <div key={token.id} className="flex items-center gap-3 px-4 py-3"
                      style={{ borderBottom: i < mcpTokens.length - 1 ? '1px solid var(--border-primary)' : undefined }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{token.name}</p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                          {token.token_prefix}...
                          <span className="ml-3 font-sans">{t('settings.mcp.tokenCreatedAt')} {new Date(token.created_at).toLocaleDateString(locale)}</span>
                          {token.last_used_at && (
                            <span className="ml-2">· {t('settings.mcp.tokenUsedAt')} {new Date(token.last_used_at).toLocaleDateString(locale)}</span>
                          )}
                        </p>
                      </div>
                      <button onClick={() => setMcpDeleteId(token.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        style={{ color: 'var(--text-tertiary)' }} title={t('settings.mcp.deleteTokenTitle')}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Section>
      )}

      {/* Create MCP Token modal */}
      {mcpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget && !mcpCreatedToken) setMcpModalOpen(false) }}>
          <div className="rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--bg-card)' }}>
            {!mcpCreatedToken ? (
              <>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.mcp.modal.createTitle')}</h3>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('settings.mcp.modal.tokenName')}</label>
                  <input type="text" value={mcpNewName} onChange={e => setMcpNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateMcpToken()}
                    placeholder={t('settings.mcp.modal.tokenNamePlaceholder')}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    autoFocus />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => setMcpModalOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleCreateMcpToken} disabled={!mcpNewName.trim() || mcpCreating}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-50">
                    {mcpCreating ? t('settings.mcp.modal.creating') : t('settings.mcp.modal.create')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.mcp.modal.createdTitle')}</h3>
                <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200" style={{ background: 'rgba(251,191,36,0.1)' }}>
                  <span className="text-amber-500 mt-0.5">⚠</span>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('settings.mcp.modal.createdWarning')}</p>
                </div>
                <div className="relative">
                  <pre className="p-3 pr-10 rounded-lg text-xs font-mono break-all border whitespace-pre-wrap" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                    {mcpCreatedToken}
                  </pre>
                  <button onClick={() => handleCopy(mcpCreatedToken, 'new-token')}
                    className="absolute top-2 right-2 p-1.5 rounded transition-colors hover:bg-slate-200 dark:hover:bg-slate-600"
                    style={{ color: 'var(--text-secondary)' }} title={t('settings.mcp.copy')}>
                    {copiedKey === 'new-token' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => { setMcpModalOpen(false); setMcpCreatedToken(null) }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-700">
                    {t('settings.mcp.modal.done')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete MCP Token confirm */}
      {mcpDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setMcpDeleteId(null) }}>
          <div className="rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" style={{ background: 'var(--bg-card)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.mcp.deleteTokenTitle')}</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('settings.mcp.deleteTokenMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setMcpDeleteId(null)}
                className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                {t('common.cancel')}
              </button>
              <button onClick={() => handleDeleteMcpToken(mcpDeleteId)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                {t('settings.mcp.deleteTokenTitle')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create OAuth Client modal */}
      {oauthCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget && !oauthCreatedClient) setOauthCreateOpen(false) }}>
          <div className="rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 overflow-y-auto max-h-[90vh]" style={{ background: 'var(--bg-card)' }}>
            {!oauthCreatedClient ? (
              <>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.oauth.modal.createTitle')}</h3>

                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('settings.oauth.modal.presets')}</label>
                  <div className="flex flex-wrap gap-1.5">
                    {OAUTH_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setOauthNewName(preset.name)
                          setOauthNewUris(preset.uris)
                          setOauthNewScopes(preset.scopes)
                        }}
                        className="px-2.5 py-1 rounded-md text-xs font-medium border transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                        style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.modal.clientName')}</label>
                  <input type="text" value={oauthNewName} onChange={e => setOauthNewName(e.target.value)}
                    placeholder={t('settings.oauth.modal.clientNamePlaceholder')}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                    style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                    autoFocus />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.modal.redirectUris')}</label>
                  <textarea value={oauthNewUris} onChange={e => setOauthNewUris(e.target.value)}
                    placeholder={t('settings.oauth.modal.redirectUrisPlaceholder')}
                    rows={3}
                    className="w-full px-3 py-2.5 border rounded-lg text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-slate-400"
                    style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }} />
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('settings.oauth.modal.redirectUrisHint')}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.modal.scopes')}</label>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>{t('settings.oauth.modal.scopesHint')}</p>
                  <ScopeGroupPicker selected={oauthNewScopes} onChange={setOauthNewScopes} />
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => setOauthCreateOpen(false)}
                    className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleCreateOAuthClient}
                    disabled={!oauthNewName.trim() || !oauthNewUris.trim() || oauthCreating}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-50">
                    {oauthCreating ? t('settings.oauth.modal.creating') : t('settings.oauth.modal.create')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.oauth.modal.createdTitle')}</h3>
                <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200" style={{ background: 'rgba(251,191,36,0.1)' }}>
                  <span className="text-amber-500 mt-0.5">⚠</span>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.modal.createdWarning')}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.clientId')}</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 rounded-lg text-xs font-mono border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                        {oauthCreatedClient.client_id}
                      </code>
                      <button onClick={() => handleCopy(oauthCreatedClient.client_id, 'new-client-id')}
                        className="p-2 rounded-lg border transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                        style={{ borderColor: 'var(--border-primary)' }}>
                        {copiedKey === 'new-client-id' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.clientSecret')}</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 px-3 py-2 rounded-lg text-xs font-mono border break-all" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                        {oauthCreatedClient.client_secret}
                      </code>
                      <button onClick={() => handleCopy(oauthCreatedClient.client_secret!, 'new-client-secret')}
                        className="p-2 rounded-lg border transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                        style={{ borderColor: 'var(--border-primary)' }}>
                        {copiedKey === 'new-client-secret' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={() => { setOauthCreateOpen(false); setOauthCreatedClient(null) }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-700">
                    {t('settings.mcp.modal.done')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Delete OAuth Client confirm */}
      {oauthDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setOauthDeleteId(null) }}>
          <div className="rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" style={{ background: 'var(--bg-card)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.oauth.deleteClient')}</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.deleteClientMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOauthDeleteId(null)}
                className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                {t('common.cancel')}
              </button>
              <button onClick={() => handleDeleteOAuthClient(oauthDeleteId)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                {t('settings.oauth.deleteClient')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rotate OAuth Client Secret confirm */}
      {oauthRotateId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setOauthRotateId(null) }}>
          <div className="rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" style={{ background: 'var(--bg-card)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.oauth.rotateSecret')}</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.rotateSecretMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOauthRotateId(null)}
                className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                {t('common.cancel')}
              </button>
              <button onClick={() => handleRotateSecret(oauthRotateId)} disabled={oauthRotating}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-50">
                {oauthRotating ? t('settings.oauth.rotateSecretConfirming') : t('settings.oauth.rotateSecretConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rotated Secret display */}
      {oauthRotatedSecret !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl shadow-xl w-full max-w-md p-6 space-y-4" style={{ background: 'var(--bg-card)' }}>
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.oauth.rotateSecretDoneTitle')}</h3>
            <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-200" style={{ background: 'rgba(251,191,36,0.1)' }}>
              <span className="text-amber-500 mt-0.5">⚠</span>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.rotateSecretDoneWarning')}</p>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.clientSecret')}</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg text-xs font-mono border break-all" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
                  {oauthRotatedSecret}
                </code>
                <button onClick={() => handleCopy(oauthRotatedSecret, 'rotated-secret')}
                  className="p-2 rounded-lg border transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
                  style={{ borderColor: 'var(--border-primary)' }}>
                  {copiedKey === 'rotated-secret' ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => setOauthRotatedSecret(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-slate-900 hover:bg-slate-700">
                {t('settings.mcp.modal.done')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke OAuth Session confirm */}
      {oauthRevokeId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={e => { if (e.target === e.currentTarget) setOauthRevokeId(null) }}>
          <div className="rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4" style={{ background: 'var(--bg-card)' }}>
            <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('settings.oauth.revokeSession')}</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('settings.oauth.revokeSessionMessage')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setOauthRevokeId(null)}
                className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
                {t('common.cancel')}
              </button>
              <button onClick={() => handleRevokeSession(oauthRevokeId)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700">
                {t('settings.oauth.revoke')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
