import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import QRCode from 'react-qr-code'
import { X, Copy, Check } from 'lucide-react'

interface QRDisplayModalProps {
  title: string
  value: string
  onClose: () => void
}

export function QRDisplayModal({ title, value, onClose }: QRDisplayModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  // Prevent background scrolling
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 24,
        maxWidth: 360, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            borderRadius: 8, color: 'var(--text-faint)', display: 'flex'
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ background: 'white', padding: 16, borderRadius: 12 }}>
          <QRCode
            value={value}
            size={256}
            style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
            viewBox={`0 0 256 256`}
          />
        </div>

        <button onClick={handleCopy} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-primary)',
          background: 'var(--bg-secondary)', color: 'var(--text-primary)',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
          width: '100%', justifyContent: 'center', transition: 'all 0.2s'
        }}>
          {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
          {copied ? 'Copied to clipboard' : 'Copy raw data'}
        </button>

      </div>
    </div>,
    document.body
  )
}
