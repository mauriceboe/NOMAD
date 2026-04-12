import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useTranslation } from '../i18n'
import { authApi } from '../api/client'
import { useAddonStore } from '../store/addonStore'
import { usePwaInstalled } from '../hooks/usePwaInstalled'
import Navbar from '../components/Layout/Navbar'
import DisplaySettingsTab from '../components/Settings/DisplaySettingsTab'
import MapSettingsTab from '../components/Settings/MapSettingsTab'
import NotificationsTab from '../components/Settings/NotificationsTab'
import IntegrationsTab from '../components/Settings/IntegrationsTab'
import AccountTab from '../components/Settings/AccountTab'
import AboutTab from '../components/Settings/AboutTab'
import OfflineTab from '../components/Settings/OfflineTab'

export default function SettingsPage(): React.ReactElement {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const { isEnabled: addonEnabled, loadAddons } = useAddonStore()

  const memoriesEnabled = addonEnabled('memories')
  const mcpEnabled = addonEnabled('mcp')
  const hasIntegrations = memoriesEnabled || mcpEnabled
  const isPwa = usePwaInstalled()

  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('display')

  useEffect(() => {
    loadAddons()
    authApi.getAppConfig?.().then(c => setAppVersion(c?.version)).catch(() => {})
  }, [])

  // Auto-switch to account tab when MFA is required
  useEffect(() => {
    if (searchParams.get('mfa') === 'required') {
      setActiveTab('account')
    }
  }, [searchParams])

  const TABS = [
    { id: 'display', label: t('settings.tabs.display') },
    { id: 'map', label: t('settings.tabs.map') },
    { id: 'notifications', label: t('settings.tabs.notifications') },
    ...(isPwa ? [{ id: 'offline', label: t('settings.tabs.offline') }] : []),
    ...(hasIntegrations ? [{ id: 'integrations', label: t('settings.tabs.integrations') }] : []),
    { id: 'account', label: t('settings.tabs.account') },
    ...(appVersion ? [{ id: 'about', label: t('settings.tabs.about') }] : []),
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-secondary)' }}>
      <Navbar />

      <div style={{ paddingTop: 'var(--nav-h)' }}>
        <div className="max-w-6xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-tertiary)' }}>
              <Settings className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('settings.title')}</h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('settings.subtitle')}</p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="grid grid-cols-3 sm:flex gap-1 mb-6 rounded-xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 'display' && <DisplaySettingsTab />}
          {activeTab === 'map' && <MapSettingsTab />}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'offline' && isPwa && <OfflineTab />}
          {activeTab === 'integrations' && hasIntegrations && <IntegrationsTab />}
          {activeTab === 'account' && <AccountTab />}
          {activeTab === 'about' && appVersion && <AboutTab appVersion={appVersion} />}
        </div>
      </div>
    </div>
  )
}