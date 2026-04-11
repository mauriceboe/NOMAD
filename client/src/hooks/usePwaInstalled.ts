import { useState, useEffect } from 'react'

function detectStandalone(): boolean {
  // iOS Safari sets navigator.standalone
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true
  // All other browsers: check CSS display-mode media query
  return window.matchMedia('(display-mode: standalone)').matches
}

/**
 * Returns true when the app is running as an installed PWA (standalone mode).
 * Works on Chrome, Edge, Firefox, and iOS Safari.
 */
export function usePwaInstalled(): boolean {
  const [isInstalled, setIsInstalled] = useState(detectStandalone)

  useEffect(() => {
    const mq = window.matchMedia('(display-mode: standalone)')
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return isInstalled
}
