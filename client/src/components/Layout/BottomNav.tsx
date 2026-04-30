import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAddonStore } from '../../store/addonStore'
import { useAuthStore } from '../../store/authStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useTranslation } from '../../i18n'
import { Plane, CalendarDays, Globe, Compass, User, Settings, Shield, LogOut, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ADDON_NAV: Record<string, { icon: LucideIcon; labelKey: string }> = {
  vacay:   { icon: CalendarDays, labelKey: 'admin.addons.catalog.vacay.name' },
  atlas:   { icon: Globe,        labelKey: 'admin.addons.catalog.atlas.name' },
  journey: { icon: Compass,      labelKey: 'admin.addons.catalog.journey.name' },
}

export default function BottomNav() {
  const { t } = useTranslation()
  const darkMode = useSettingsStore(s => s.settings.dark_mode)
  const dark = darkMode === true || darkMode === 'dark' || (darkMode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const addons = useAddonStore(s => s.addons)
  const globalAddons = addons.filter(a => a.type === 'global' && a.enabled)
  const [showProfile, setShowProfile] = useState(false)

  const items: { to: string; label: string; icon: LucideIcon }[] = [
    { to: '/trips', label: t('nav.myTrips'), icon: Plane },
    ...globalAddons.flatMap(addon => {
      const nav = ADDON_NAV[addon.id]
      return nav ? [{ to: `/${addon.id}`, label: t(nav.labelKey), icon: nav.icon }] : []
    }),
  ]

  return (
    <>
      <nav
        className="md:hidden sticky bottom-0 border-t border-zinc-200 dark:border-zinc-800 flex justify-around items-start pt-3 z-50 mt-auto flex-shrink-0"
        style={{
          height: 'calc(84px + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: dark ? 'rgba(9,9,11,0.96)' : 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1 min-w-[60px] ${
                isActive ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'
              }`
            }
          >
            <Icon size={22} strokeWidth={2} />
            <span className="text-[10px] font-medium">{label}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setShowProfile(true)}
          className="flex flex-col items-center gap-1 px-3 py-1 min-w-[60px] text-zinc-400 dark:text-zinc-500"
        >
          <User size={22} strokeWidth={2} />
          <span className="text-[10px] font-medium">{t("nav.profile")}</span>
        </button>
      </nav>

      {showProfile && <ProfileSheet onClose={() => setShowProfile(false)} />}
    </>
  )
}

function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleNav = (path: string) => {
    onClose()
    navigate(path)
  }

  const handleLogout = () => {
    onClose()
    logout()
    navigate('/login')
  }

  return (
    <div className="fixed inset-0 z-[300] md:hidden" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 rounded-t-2xl overflow-hidden"
        style={{ animation: 'slideUp 0.25s ease-out', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>

        {/* User info */}
        <div className="px-6 pb-4 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center text-[16px] font-bold">
              {(user?.username || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-semibold text-zinc-900 dark:text-white">{user?.username}</p>
              <p className="text-[12px] text-zinc-500 truncate">{user?.email}</p>
            </div>
            {user?.role === 'admin' && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wide">
                <Shield size={10} /> Admin
              </span>
            )}
          </div>
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-4" />

        {/* Links */}
        <div className="py-2 px-2">
          <button
            onClick={() => handleNav('/settings')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
          >
            <Settings size={18} className="text-zinc-500" />
            <span className="text-[14px] font-medium text-zinc-900 dark:text-white">{t("nav.bottomSettings")}</span>
          </button>

          {user?.role === 'admin' && (
            <button
              onClick={() => handleNav('/admin')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 active:bg-zinc-100 dark:active:bg-zinc-800 transition-colors"
            >
              <Shield size={18} className="text-zinc-500" />
              <span className="text-[14px] font-medium text-zinc-900 dark:text-white">{t("nav.bottomAdmin")}</span>
            </button>
          )}
        </div>

        <div className="h-px bg-zinc-100 dark:bg-zinc-800 mx-4" />

        {/* Logout */}
        <div className="py-2 px-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left hover:bg-red-50 dark:hover:bg-red-900/20 active:bg-red-100 transition-colors"
          >
            <LogOut size={18} className="text-red-500" />
            <span className="text-[14px] font-medium text-red-600 dark:text-red-400">{t("nav.bottomLogout")}</span>
          </button>
        </div>

        <div className="h-4" />
      </div>
    </div>
  )
}
