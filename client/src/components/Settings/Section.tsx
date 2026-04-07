import React, { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Info } from 'lucide-react'

interface SectionProps {
  title: string
  icon: LucideIcon
  children: React.ReactNode
  tooltip?: string
}

export default function Section({ title, icon: Icon, children, tooltip }: SectionProps): React.ReactElement {
  const [showTooltip, setShowTooltip] = useState(false)
  
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', marginBottom: 24 }}>
      <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-secondary)' }}>
        <Icon className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
        <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        {/* Spacer to push tooltip to the end if needed */}
        <div style={{ flex: 1 }} />
        {tooltip && (
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <span
              style={{
                visibility: showTooltip ? 'visible' : 'hidden',
                opacity: showTooltip ? 1 : 0,
                width: 'max-content',
                background: 'rgba(40,40,40,0.95)',
                color: '#fff',
                textAlign: 'left',
                borderRadius: 6,
                padding: '7px 12px',
                position: 'absolute',
                zIndex: 10,
                right: '110%',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 13,
                pointerEvents: showTooltip ? 'auto' : 'none',
                transition: 'opacity 0.15s',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                marginRight: 8,
              }}
              className="info-tooltip-message"
            >
              {tooltip}
            </span>
            <Info
              className="w-5 h-5"
              style={{ color: 'var(--text-secondary)', verticalAlign: 'middle', cursor: 'pointer' }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              tabIndex={0}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
            />
          </span>
        )}
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </div>
  )
}
