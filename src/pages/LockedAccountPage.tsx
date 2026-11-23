import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface EligibilityResult {
  eligible: boolean
  reason?: string
  fee_ngn?: number
  cap?: number
  remaining_unlocks?: number
  has_pending?: boolean
}

export function LockedAccountPage() {
  const { user, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [eligibility, setEligibility] = useState<EligibilityResult | null>(null)
  const [isPaying, setIsPaying] = useState(false)
  const [isCheckingReturn, setIsCheckingReturn] = useState(false)

  // 1. Check if returning from a Paystack unlock payment
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (!ref) return

    setIsCheckingReturn(true)
    let attempts = 0
    const interval = setInterval(async () => {
      attempts++
      await refreshProfile()
      const { data: prof } = await supabase
        .from('profiles')
        .select('is_locked')
        .eq('id', user?.id)
        .single()

      if (prof && !prof.is_locked) {
        clearInterval(interval)
        toast.success('Account successfully unlocked! Welcome back.')
        navigate('/app', { replace: true })
      } else if (attempts >= 10) {
        clearInterval(interval)
        setIsCheckingReturn(false)
        toast.info('Payment received. Your account will unlock once confirmed.')
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [searchParams, user?.id, navigate, refreshProfile])

  // 2. Check unlock eligibility
  useEffect(() => {
    async function check() {
      try {
        const { data, error } = await supabase.rpc('check_unlock_eligibility')
        if (error) {
          console.warn('Failed to check unlock eligibility:', error.message)
          return
        }
        setEligibility(data as EligibilityResult)
      } catch (err) {
        console.warn('Error checking unlock eligibility:', err)
      }
    }
    if (user?.id) {
      void check()
    }
  }, [user?.id])

  // 3. Initiate Paid Unlock
  const handlePayUnlock = async () => {
    setIsPaying(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session.session?.access_token

      if (!token) {
        toast.error('Session expired. Please log in again.')
        return
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/unlock-initialize`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      const json = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || 'Failed to initiate unlock payment')
      }

      if (json.authorization_url) {
        window.location.href = json.authorization_url
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment initiation failed. Contact support.')
      setIsPaying(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md border border-border bg-surface rounded-3xl p-8 sm:p-10 shadow-2xl text-center space-y-6"
      >
        {/* Security Lock Icon */}
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-500 mx-auto flex items-center justify-center text-3xl font-extrabold shadow-inner">
          🔒
        </div>

        <div className="space-y-2">
          <span className="text-[11px] uppercase font-black tracking-widest text-amber-500">
            Account Protection Protocol
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Account Access Suspended
          </h1>
          <p className="text-xs sm:text-sm text-muted leading-relaxed">
            Our automated security system detected multiple simultaneous sessions switching across different devices/browsers for account:
          </p>
          <div className="p-2.5 rounded-xl bg-bg border border-border text-xs font-mono font-semibold text-text truncate">
            {user?.email || 'Student Account'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-muted text-left space-y-1.5 leading-relaxed">
          <p className="font-bold text-text">Why did this happen?</p>
          <p>
            NursingPrep accounts allow up to 2 concurrent active sessions. Repeated device switching triggers a security lock to protect examination integrity.
          </p>
        </div>

        {/* Paid Self-Unlock Section */}
        {isCheckingReturn ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold space-y-1">
            <p className="animate-pulse">Verifying unlock transaction...</p>
            <p className="text-[11px] text-muted">You will be redirected automatically once confirmed.</p>
          </div>
        ) : eligibility?.eligible ? (
          <div className="space-y-3 p-4 rounded-2xl bg-surface border border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-text">Self-Service Unlock Fee:</span>
              <span className="text-sm font-black text-emerald-400">
                ₦{eligibility.fee_ngn || 500}
              </span>
            </div>
            <p className="text-[11px] text-muted text-left">
              Instantly unlocks your account and resets the device switch counter ({eligibility.remaining_unlocks} of {eligibility.cap} paid unlocks remaining this month).
            </p>
            <button
              type="button"
              onClick={handlePayUnlock}
              disabled={isPaying}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs shadow-xs transition-colors disabled:opacity-50"
            >
              {isPaying ? 'Redirecting to Paystack...' : `⚡ Pay ₦${eligibility.fee_ngn || 500} to Unlock Now`}
            </button>
          </div>
        ) : eligibility?.reason === 'cap_exceeded' ? (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 text-left">
            <span className="font-bold block">Monthly Paid Unlock Cap Reached</span>
            You have used all {eligibility.cap || 2} self-service unlocks for this 30-day period. Please contact an administrator below.
          </div>
        ) : null}

        {/* Fallback Contact Admin & Sign Out */}
        <div className="space-y-2 pt-1">
          <a
            href="https://wa.me/2340000000000?text=Hello%20NursingPrep%20Admin,%20my%20account%20has%20been%20locked%20due%20to%20session%20limits."
            target="_blank"
            rel="noopener noreferrer"
            className="w-full block py-2.5 px-4 rounded-xl border border-border bg-surface hover:border-accent text-text font-bold text-xs transition-colors"
          >
            Contact Admin for Free Manual Unlock ↗
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2 px-4 text-muted hover:text-text font-semibold text-xs transition-colors"
          >
            Sign Out
          </button>
        </div>
      </motion.div>
    </div>
  )
}
