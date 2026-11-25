import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

export function useVersionCheck() {
  const initialVersionRef = useRef<string | null>(null)
  const isReloadingRef = useRef(false)

  useEffect(() => {
    // Skip in local dev server
    if (import.meta.env.DEV) return

    const checkVersion = async () => {
      if (isReloadingRef.current) return
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const latestVersion = data?.version
        if (!latestVersion) return

        if (!initialVersionRef.current) {
          initialVersionRef.current = latestVersion
          return
        }

        if (initialVersionRef.current !== latestVersion) {
          isReloadingRef.current = true
          toast.info('New app update available. Refreshing...')
          setTimeout(() => {
            window.location.reload()
          }, 1200)
        }
      } catch {
        // Ignore network errors during background version check
      }
    }

    void checkVersion()
    const interval = setInterval(checkVersion, 60_000)
    window.addEventListener('focus', checkVersion)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', checkVersion)
    }
  }, [])
}
