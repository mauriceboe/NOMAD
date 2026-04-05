import { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { X, QrCode } from 'lucide-react'

interface QRScannerModalProps {
  title: string
  onScan: (decodedText: string) => void
  onClose: () => void
}

export function QRScannerModal({ title, onScan, onClose }: QRScannerModalProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Prevent background scrolling
    document.body.style.overflow = 'hidden'

    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    )

    scannerRef.current.render(
      (decodedText) => {
        // Success callback
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error)
        }
        onScan(decodedText)
      },
      (errorMessage) => {
        // Error callback (ignoring continuous scan errors as they are frequent)
        // Only log significant ones if needed
      }
    )

    return () => {
      document.body.style.overflow = ''
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error)
      }
    }
  }, [onScan])

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 24,
        maxWidth: 400, width: '100%', boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20
      }} onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <QrCode size={18} style={{ color: 'var(--text-primary)' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            borderRadius: 8, color: 'var(--text-faint)', display: 'flex'
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ width: '100%', minHeight: 300, background: 'black', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
          <div id="qr-reader" style={{ width: '100%' }}></div>
        </div>
        
        {error && (
          <div style={{ fontSize: 13, color: 'var(--text-error)', textAlign: 'center' }}>
            {error}
          </div>
        )}

      </div>
    </div>,
    document.body
  )
}
