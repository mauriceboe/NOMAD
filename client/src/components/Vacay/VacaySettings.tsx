import { useState, useEffect } from 'react'
import { MapPin, CalendarOff, AlertCircle, Building2, Unlink, ArrowRightLeft, Globe } from 'lucide-react'
import { useVacayStore } from '../../store/vacayStore'
import { getIntlLanguage, useTranslation } from '../../i18n'
import { useToast } from '../shared/Toast'
import CustomSelect from '../shared/CustomSelect'
import apiClient from '../../api/client'

interface VacaySettingsProps {
  onClose: () => void
}

export default function VacaySettings({ onClose }: VacaySettingsProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const { plan, updatePlan, isFused, dissolve, users } = useVacayStore()
  const [countries, setCountries] = useState([])
  const [regions, setRegions] = useState([])
  const [loadingRegions, setLoadingRegions] = useState(false)

  const { language } = useTranslation()

  // Load available countries with localized names
  useEffect(() => {
    apiClient.get('/addons/vacay/holidays/countries').then(r => {
      let displayNames
      try { displayNames = new Intl.DisplayNames([getIntlLanguage(language)], { type: 'region' }) } catch { /* */ }
      const list = r.data.map(c => ({
        value: c.countryCode,
        label: displayNames ? (displayNames.of(c.countryCode) || c.name) : c.name,
      }))
      list.sort((a, b) => a.label.localeCompare(b.label))
      setCountries(list)
    }).catch(() => {})
  }, [language])

  // When country changes, check if it has regions
  const selectedCountry = plan?.holidays_region?.split('-')[0] || ''
  const selectedRegion = plan?.holidays_region?.includes('-') ? plan.holidays_region : ''

  useEffect(() => {
    if (!selectedCountry || !plan?.holidays_enabled) { setRegions([]); return }
    setLoadingRegions(true)
    const year = new Date().getFullYear()
    apiClient.get(`/addons/vacay/holidays/${year}/${selectedCountry}`).then(r => {
      const allCounties = new Set()
      r.data.forEach(h => {
        if (h.counties) h.counties.forEach(c => allCounties.add(c))
      })
      if (allCounties.size > 0) {
        let subdivisionNames
        try { subdivisionNames = new Intl.DisplayNames([getIntlLanguage(language)], { type: 'region' }) } catch { /* */ }
        const regionList = [...allCounties].sort().map(c => {
          let label = c.split('-')[1] || c
          // Try Intl for full subdivision name (not all browsers support subdivision codes)
          // Fallback: use known mappings for DE
          if (c.startsWith('DE-')) {
            const deRegions = { BW:'Baden-Württemberg',BY:'Bayern',BE:'Berlin',BB:'Brandenburg',HB:'Bremen',HH:'Hamburg',HE:'Hessen',MV:'Mecklenburg-Vorpommern',NI:'Niedersachsen',NW:'Nordrhein-Westfalen',RP:'Rheinland-Pfalz',SL:'Saarland',SN:'Sachsen',ST:'Sachsen-Anhalt',SH:'Schleswig-Holstein',TH:'Thüringen' }
            label = deRegions[c.split('-')[1]] || label
          } else if (c.startsWith('CH-')) {
            const chRegions = { AG:'Aargau',AI:'Appenzell Innerrhoden',AR:'Appenzell Ausserrhoden',BE:'Bern',BL:'Basel-Landschaft',BS:'Basel-Stadt',FR:'Freiburg',GE:'Genf',GL:'Glarus',GR:'Graubünden',JU:'Jura',LU:'Luzern',NE:'Neuenburg',NW:'Nidwalden',OW:'Obwalden',SG:'St. Gallen',SH:'Schaffhausen',SO:'Solothurn',SZ:'Schwyz',TG:'Thurgau',TI:'Tessin',UR:'Uri',VD:'Waadt',VS:'Wallis',ZG:'Zug',ZH:'Zürich' }
            label = chRegions[c.split('-')[1]] || label
          }
          return { value: c, label }
        })
        setRegions(regionList)
      } else {
        setRegions([])
        // If no regions, just set country code as region
        if (plan.holidays_region !== selectedCountry) {
          updatePlan({ holidays_region: selectedCountry })
        }
      }
    }).catch(() => setRegions([])).finally(() => setLoadingRegions(false))
  }, [selectedCountry, plan?.holidays_enabled])

  if (!plan) return null

  const toggle = (key) => updatePlan({ [key]: !plan[key] })

  const handleCountryChange = (countryCode) => {
    updatePlan({ holidays_region: countryCode })
  }

  const handleRegionChange = (regionCode) => {
    updatePlan({ holidays_region: regionCode })
  }

  return (
    <div className="space-y-5">
      {/* Block weekends */}
      <SettingToggle
        icon={CalendarOff}
        label={t('vacay.blockWeekends')}
        hint={t('vacay.blockWeekendsHint')}
        value={plan.block_weekends}
        onChange={() => toggle('block_weekends')}
      />

      {/* Carry-over */}
      <SettingToggle
        icon={ArrowRightLeft}
        label={t('vacay.carryOver')}
        hint={t('vacay.carryOverHint')}
        value={plan.carry_over_enabled}
        onChange={() => toggle('carry_over_enabled')}
      />

      {/* Company holidays */}
      <div>
        <SettingToggle
          icon={Building2}
          label={t('vacay.companyHolidays')}
          hint={t('vacay.companyHolidaysHint')}
          value={plan.company_holidays_enabled}
          onChange={() => toggle('company_holidays_enabled')}
        />
        {plan.company_holidays_enabled && (
          <div className="ml-7 mt-2">
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md" style={{ background: 'var(--bg-secondary)' }}>
              <AlertCircle size={12} style={{ color: 'var(--text-faint)' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-faint)' }}>{t('vacay.companyHolidaysNoDeduct')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Public holidays */}
      <div>
        <SettingToggle
          icon={Globe}
          label={t('vacay.publicHolidays')}
          hint={t('vacay.publicHolidaysHint')}
          value={plan.holidays_enabled}
          onChange={() => toggle('holidays_enabled')}
        />
        {plan.holidays_enabled && (
          <div className="ml-7 mt-2 space-y-2">
            <CustomSelect
              value={selectedCountry}
              onChange={handleCountryChange}
              options={countries}
              placeholder={t('vacay.selectCountry')}
              searchable
            />
            {regions.length > 0 && (
              <CustomSelect
                value={selectedRegion}
                onChange={handleRegionChange}
                options={regions}
                placeholder={t('vacay.selectRegion')}
                searchable
              />
            )}
          </div>
        )}
      </div>

      {/* Dissolve fusion */}
      {isFused && (
        <div className="pt-4 mt-2 border-t" style={{ borderColor: 'var(--border-secondary)' }}>
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'rgba(239,68,68,0.06)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <Unlink size={16} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('vacay.dissolve')}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{t('vacay.dissolveHint')}</p>
              </div>
            </div>
            <div className="px-4 py-3 flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid rgba(239,68,68,0.1)' }}>
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md" style={{ background: 'var(--bg-secondary)' }}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: u.color || '#6366f1' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{u.username}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(239,68,68,0.1)' }}>
              <button
                onClick={async () => {
                  await dissolve()
                  toast.success(t('vacay.dissolved'))
                  onClose()
                }}
                className="w-full px-3 py-2 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                {t('vacay.dissolveAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface SettingToggleProps {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
  label: string
  hint: string
  value: boolean
  onChange: (value: boolean) => void
}

function SettingToggle({ icon: Icon, label, hint, value, onChange }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={15} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
        <div className="min-w-0">
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
          <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>{hint}</p>
        </div>
      </div>
      <button onClick={onChange}
        className="relative shrink-0 inline-flex h-6 w-11 items-center rounded-full transition-colors"
        style={{ background: value ? 'var(--text-primary)' : 'var(--border-primary)' }}>
        <span className="absolute left-1 h-4 w-4 rounded-full transition-transform duration-200"
          style={{ background: 'var(--bg-card)', transform: value ? 'translateX(20px)' : 'translateX(0)' }} />
      </button>
    </div>
  )
}
