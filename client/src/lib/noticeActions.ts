/**
 * Global registry for notice CTA actions.
 *
 * Components that own a UI action register a handler when they mount and
 * unregister it when they unmount. The NoticesModal fires the action by ID.
 * If no handler is registered (the owning page isn't mounted), the modal
 * falls back to navigating to `cta_url`.
 *
 * Adding a new action:
 *   1. Call registerNoticeAction('my-action', () => { ... }) in a useEffect
 *   2. Return () => unregisterNoticeAction('my-action') as the cleanup
 *   3. Seed a notice with cta_action = 'my-action' (and cta_url as fallback)
 */

const registry = new Map<string, () => void>()

export function registerNoticeAction(id: string, fn: () => void): void {
  registry.set(id, fn)
}

export function unregisterNoticeAction(id: string): void {
  registry.delete(id)
}

/** Returns true if a handler was found and fired, false otherwise. */
export function fireNoticeAction(id: string): boolean {
  const fn = registry.get(id)
  if (fn) {
    fn()
    return true
  }
  return false
}
