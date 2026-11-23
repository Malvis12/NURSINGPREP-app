import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

/**
 * useSessionGuard
 * - Enforces max 2 active browser sessions per student.
 * - Handles 'register_session' on auth mount.
 * - Sends 'heartbeat_session' every 60 seconds and on tab visibility.
 * - Never disrupts students during an active exam.
 * - Redirects to /locked or signs out with notice upon eviction.
 */
export function useSessionGuard() {
  const { user, signOut, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const intervalRef = useRef<number | null>(null)
  const isRegisteredRef = useRef(false)

  // 1. Initial Register Session
  useEffect(() => {
    if (!user || isAdmin) return

    let isMounted = true

    async function register() {
      try {
        const { data: status, error } = await supabase.rpc('register_session')
        if (error) {
          console.warn('[SessionGuard] Registration RPC failed (fail-open):', error.message)
          return
        }

        if (!isMounted) return

        if (status === 'locked') {
          navigate('/locked', { replace: true })
        }
      } catch (err) {
        console.warn('[SessionGuard] Network exception during register_session (fail-open):', err)
      }
    }

    if (!isRegisteredRef.current) {
      isRegisteredRef.current = true
      void register()
    }

    return () => {
      isMounted = false
    }
  }, [user, isAdmin, navigate])

  // 2. Heartbeat every 60 seconds and on tab visibility
  useEffect(() => {
    if (!user || isAdmin) return

    const sendHeartbeat = async () => {
      // Don't process if already on locked page
      if (location.pathname === '/locked') return

      try {
        const { data: status, error } = await supabase.rpc('heartbeat_session')
        if (error) {
          // Fail-open rule: never sign out a user on network or RPC errors
          return
        }

        if (status === 'locked') {
          navigate('/locked', { replace: true })
        } else if (status === 'revoked') {
          // Only evict if not currently in an active exam page
          if (!location.pathname.includes('/exam')) {
            toast.error('Session ended: Your account was signed into on another device.', {
              duration: 6000,
            })
            await signOut()
            navigate('/login')
          }
        }
      } catch (err) {
        // Fail-open: network glitch does not evict user
        console.warn('[SessionGuard] Heartbeat failed (fail-open):', err)
      }
    }

    // Set 60-second periodic heartbeat
    intervalRef.current = window.setInterval(sendHeartbeat, 60000)

    // Visibility change handler (tab focused)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, isAdmin, location.pathname, navigate, signOut])
}
