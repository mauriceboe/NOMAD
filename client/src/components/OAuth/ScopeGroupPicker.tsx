import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { getScopesByGroup } from '../../api/oauthScopes'

interface Props {
  selected: string[]
  onChange: (scopes: string[]) => void
}

const scopesByGroup = getScopesByGroup()

export default function ScopeGroupPicker({ selected, onChange }: Props): React.ReactElement {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const allScopeKeys = Object.values(scopesByGroup).flat().map(s => s.scope)
  const allSelected  = allScopeKeys.every(s => selected.includes(s))

  return (
    <div className="space-y-1">
      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={() => onChange(allSelected ? [] : allScopeKeys)}
          className="text-xs px-2 py-0.5 rounded border transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
          style={{ borderColor: 'var(--border-primary)', color: 'var(--text-secondary)' }}>
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>
      <div className="space-y-1 max-h-96 overflow-y-auto pr-1">
        {Object.entries(scopesByGroup).map(([group, groupScopes]) => {
          const groupScopeKeys   = groupScopes.map(s => s.scope)
          const allGroupSelected = groupScopeKeys.every(s => selected.includes(s))
          const someGroupSelected = groupScopeKeys.some(s => selected.includes(s))
          return (
            <div key={group} className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center gap-1 px-3 py-2" style={{ background: 'var(--bg-secondary)' }}>
                <button
                  type="button"
                  onClick={() => setOpen(prev => ({ ...prev, [group]: !prev[group] }))}
                  className="flex items-center gap-1 flex-1 text-xs font-semibold hover:opacity-70 transition-opacity text-left"
                  style={{ color: 'var(--text-secondary)' }}>
                  {open[group]
                    ? <ChevronDown className="w-3 h-3 flex-shrink-0" />
                    : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                  {group}
                  {someGroupSelected && (
                    <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--text-tertiary)' }}>
                      ({groupScopeKeys.filter(s => selected.includes(s)).length}/{groupScopeKeys.length})
                    </span>
                  )}
                </button>
                <input
                  type="checkbox"
                  checked={allGroupSelected}
                  ref={el => { if (el) el.indeterminate = someGroupSelected && !allGroupSelected }}
                  onChange={e => onChange(
                    e.target.checked
                      ? [...new Set([...selected, ...groupScopeKeys])]
                      : selected.filter(s => !groupScopeKeys.includes(s))
                  )}
                  className="rounded"
                  title={allGroupSelected ? `Deselect all ${group}` : `Select all ${group}`}
                />
              </div>
              {open[group] && (
                <div className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                  {groupScopes.map(({ scope, label, description }) => (
                    <label
                      key={scope}
                      className="flex items-start gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <input
                        type="checkbox"
                        checked={selected.includes(scope)}
                        onChange={e => onChange(
                          e.target.checked
                            ? [...selected, scope]
                            : selected.filter(s => s !== scope)
                        )}
                        className="mt-0.5 rounded flex-shrink-0"
                      />
                      <div>
                        <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
