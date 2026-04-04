import { useCallback, useEffect, useMemo, useState } from 'react'
import { useVacayStore } from '../../store/vacayStore'
import { useTranslation } from '../../i18n'
import { isWeekend } from './holidays'
import VacayMonthCard from './VacayMonthCard'
import { Building2, MousePointer2 } from 'lucide-react'
import type { VacayCompanyHoliday, VacayEntry } from '../../types'

export default function VacayCalendar() {
  const { t } = useTranslation()
  const { selectedYear, selectedUserId, entries, companyHolidays, toggleEntry, toggleCompanyHoliday, plan, users, holidays } = useVacayStore()
  const [companyMode, setCompanyMode] = useState(false)

  const companyHolidayMap = useMemo(() => {
    const map: Record<string, VacayCompanyHoliday[]> = {}
    companyHolidays.forEach((holiday) => {
      if (!map[holiday.date]) map[holiday.date] = []
      map[holiday.date].push(holiday)
    })
    return map
  }, [companyHolidays])

  const selectedUserCompanyHolidaySet = useMemo(() => {
    const set = new Set<string>()
    if (!selectedUserId) return set
    companyHolidays.forEach((holiday) => {
      if (holiday.user_id === selectedUserId) set.add(holiday.date)
    })
    return set
  }, [companyHolidays, selectedUserId])

  const entryMap = useMemo(() => {
    const map: Record<string, VacayEntry[]> = {}
    entries.forEach((entry) => {
      if (!map[entry.date]) map[entry.date] = []
      map[entry.date].push(entry)
    })
    return map
  }, [entries])

  const blockWeekends = plan?.block_weekends !== false
  const weekendDays: number[] = plan?.weekend_days ? String(plan.weekend_days).split(',').map(Number) : [0, 6]
  const companyHolidaysEnabled = plan?.company_holidays_enabled !== false

  const handleCellClick = useCallback(async (dateStr: string) => {
    if (companyMode) {
      if (!companyHolidaysEnabled || !selectedUserId) return
      await toggleCompanyHoliday(dateStr, selectedUserId)
      return
    }
    if (holidays[dateStr]) return
    if (blockWeekends && isWeekend(dateStr, weekendDays)) return
    if (companyHolidaysEnabled && selectedUserCompanyHolidaySet.has(dateStr)) return
    await toggleEntry(dateStr, selectedUserId || undefined)
  }, [companyMode, toggleEntry, toggleCompanyHoliday, holidays, blockWeekends, weekendDays, companyHolidaysEnabled, selectedUserCompanyHolidaySet, selectedUserId])

  const selectedUser = users.find((user) => user.id === selectedUserId)

  useEffect(() => {
    if (!selectedUserId && companyMode) setCompanyMode(false)
  }, [selectedUserId, companyMode])

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 12 }, (_, i) => (
          <VacayMonthCard
            key={i}
            year={selectedYear}
            month={i}
            holidays={holidays}
            companyHolidayMap={companyHolidayMap}
            blockedCompanyHolidaySet={selectedUserCompanyHolidaySet}
            companyHolidaysEnabled={companyHolidaysEnabled}
            entryMap={entryMap}
            onCellClick={handleCellClick}
            companyMode={companyMode}
            blockWeekends={blockWeekends}
            weekendDays={weekendDays}
          />
        ))}
      </div>

      <div className="sticky bottom-3 sm:bottom-4 mt-3 sm:mt-4 flex items-center justify-center z-30 px-2">
        <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
          <button
            onClick={() => setCompanyMode(false)}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all"
            style={{
              background: !companyMode ? 'var(--text-primary)' : 'transparent',
              color: !companyMode ? 'var(--bg-card)' : 'var(--text-muted)',
              border: companyMode ? '1px solid var(--border-primary)' : '1px solid transparent',
            }}>
            <MousePointer2 size={13} />
            {selectedUser && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedUser.color }} />}
            {selectedUser ? selectedUser.username : t('vacay.modeVacation')}
          </button>
          {companyHolidaysEnabled && (
            <button
              onClick={() => { if (selectedUserId) setCompanyMode(true) }}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium transition-all"
              style={{
                background: companyMode ? '#d97706' : 'transparent',
                color: companyMode ? '#fff' : 'var(--text-muted)',
                border: !companyMode ? '1px solid var(--border-primary)' : '1px solid transparent',
                opacity: selectedUserId ? 1 : 0.5,
                cursor: selectedUserId ? 'pointer' : 'not-allowed',
              }}>
              <Building2 size={13} />
              {t('vacay.modeCompany')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
