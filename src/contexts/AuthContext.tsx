import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface AuthContextType {
  user: User | null
  loading: boolean
  level: number | null
  isActive: boolean
  isAdmin: boolean
  submittedAttemptsCount: number
  canTakeExam: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  level: null,
  isActive: false,
  isAdmin: false,
  submittedAttemptsCount: 0,
  canTakeExam: false,
  refreshProfile: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [level, setLevel] = useState<number | null>(null)
  const [isActive, setIsActive] = useState<boolean>(false)
  const [isAdmin, setIsAdmin] = useState<boolean>(false)
  const [submittedAttemptsCount, setSubmittedAttemptsCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string) => {
    try {
      const [{ data: profileData }, { count: attemptsCount }] = await Promise.all([
        supabase
          .from('profiles')
          .select('level, is_active')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('exam_attempts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .not('submitted_at', 'is', null),
      ])

      if (profileData) {
        setLevel(profileData.level ?? null)
        setIsActive(Boolean(profileData.is_active))
      } else {
        setLevel(null)
        setIsActive(false)
      }

      setSubmittedAttemptsCount(attemptsCount ?? 0)
    } catch {
      setLevel(null)
      setIsActive(false)
      setSubmittedAttemptsCount(0)
    }
  }

  const fetchAdminStatus = async () => {
    try {
      if (typeof supabase.rpc === 'function') {
        const { data, error } = await supabase.rpc('is_admin')
        if (!error && typeof data === 'boolean') {
          setIsAdmin(data)
          return
        }
      }
      setIsAdmin(false)
    } catch {
      setIsAdmin(false)
    }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        await Promise.all([fetchProfile(currentUser.id), fetchAdminStatus()])
      } else {
        setLevel(null)
        setIsActive(false)
        setIsAdmin(false)
      }
      if (mounted) setLoading(false)
    }).catch(() => {
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        // Do NOT set loading to true on token refresh or refocus
        await Promise.all([fetchProfile(currentUser.id), fetchAdminStatus()])
      } else {
        setLevel(null)
        setIsActive(false)
        setIsAdmin(false)
      }
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    if (user) {
      await Promise.all([fetchProfile(user.id), fetchAdminStatus()])
    }
  }

  const signOut = async () => {
    try {
      await supabase.rpc('end_session')
    } catch {
      // Best-effort cleanup
    }
    await supabase.auth.signOut()
    setUser(null)
    setLevel(null)
    setIsActive(false)
    setIsAdmin(false)
    setSubmittedAttemptsCount(0)
  }

  const canTakeExam = isActive || submittedAttemptsCount === 0

  return (
    <AuthContext.Provider value={{ user, loading, level, isActive, isAdmin, submittedAttemptsCount, canTakeExam, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
