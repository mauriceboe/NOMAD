import React from 'react'
import { Info, Coffee, Heart, ExternalLink } from 'lucide-react'
import { useTranslation } from '../../i18n'
import Section from './Section'

interface Props {
  appVersion: string
}

export default function AboutTab({ appVersion }: Props): React.ReactElement {
  const { t } = useTranslation()

  return (
    <Section title={t('settings.about')} icon={Info}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--bg-tertiary)', borderRadius: 99, padding: '6px 14px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>TREK</span>
          <span style={{ fontSize: 13, color: 'var(--text-faint)' }}>v{appVersion}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a
          href="https://ko-fi.com/mauriceboe"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border overflow-hidden flex items-center gap-4 px-5 py-4 transition-all"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', textDecoration: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ff5e5b'; e.currentTarget.style.boxShadow = '0 0 0 1px #ff5e5b22' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ff5e5b15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Coffee size={20} style={{ color: '#ff5e5b' }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Ko-fi</div>
            <div className="text-xs" style={{ color: 'var(--text-faint)' }}>{t('admin.github.support')}</div>
          </div>
          <ExternalLink size={14} className="ml-auto flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
        </a>
        <a
          href="https://buymeacoffee.com/mauriceboe"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border overflow-hidden flex items-center gap-4 px-5 py-4 transition-all"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', textDecoration: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ffdd00'; e.currentTarget.style.boxShadow = '0 0 0 1px #ffdd0022' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ffdd0015', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Heart size={20} style={{ color: '#ffdd00' }} />
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Buy Me a Coffee</div>
            <div className="text-xs" style={{ color: 'var(--text-faint)' }}>{t('admin.github.support')}</div>
          </div>
          <ExternalLink size={14} className="ml-auto flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
        </a>
        <a
          href="https://discord.gg/nSdKaXgN"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border overflow-hidden flex items-center gap-4 px-5 py-4 transition-all"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-primary)', textDecoration: 'none' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#5865F2'; e.currentTarget.style.boxShadow = '0 0 0 1px #5865F222' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.boxShadow = 'none' }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#5865F215', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
          </div>
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Discord</div>
            <div className="text-xs" style={{ color: 'var(--text-faint)' }}>Join the community</div>
          </div>
          <ExternalLink size={14} className="ml-auto flex-shrink-0" style={{ color: 'var(--text-faint)' }} />
        </a>
      </div>
    </Section>
  )
}
