import { useEffect } from 'react'

/**
 * Keeps the screen awake while `active` is true, using the Screen Wake Lock API.
 * The browser releases the lock whenever the page is hidden, so it is re-acquired
 * when the page becomes visible again. Silently does nothing if unsupported.
 */
export default function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          lock.release().catch(() => {})
        } else {
          sentinel = lock
        }
      } catch (err) {
        // Not fatal — e.g. battery saver or permissions policy; the timer still works
        console.error('Could not keep screen awake:', err)
      }
    }

    acquire()
    document.addEventListener('visibilitychange', acquire)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      sentinel?.release().catch(() => {})
      sentinel = null
    }
  }, [active])
}
