import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface StepConfig {
  id: number
  title: string
  subtitle: string
}

const VERIFICATION_STEPS: StepConfig[] = [
  {
    id: 1,
    title: 'Verifying transaction with payment gateway...',
    subtitle: 'Connecting securely to payment processor',
  },
  {
    id: 2,
    title: 'Activating your NursingPrep Pro account...',
    subtitle: 'Provisioning full access to all questions & modules',
  },
  {
    id: 3,
    title: 'Preparing your personalized dashboard...',
    subtitle: 'Setting up your practice environment',
  },
]

const CELEBRATION_DURATION_MS =
  import.meta.env.MODE === 'test' ? 0 : 1500

export function PayReturnPage() {
  const navigate = useNavigate()
  const { user, isActive, refreshProfile } = useAuth()
  const [isTimedOut, setIsTimedOut] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [currentStep, setCurrentStep] = useState<number>(1)
  const [pollCount, setPollCount] = useState<number>(0)
  const hasNavigatedRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (isActive && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true
      setCurrentStep(3)
      setIsSuccess(true)
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          navigate('/app', { replace: true, state: { paymentCelebration: true } })
        }
      }, CELEBRATION_DURATION_MS)
      return () => clearTimeout(timer)
    }

    if (hasNavigatedRef.current) return

    // Animate progression of step 1 to step 2 while verification is underway
    const stepTimer = setTimeout(() => {
      if (isMountedRef.current && !hasNavigatedRef.current) {
        setCurrentStep((prev) => (prev < 2 ? 2 : prev))
      }
    }, 2500)

    // Real-time verification fallback: ask edge function to verify reference directly with Paystack
    const triggerDirectVerify = async () => {
      const searchParams = new URLSearchParams(window.location.search)
      const ref = searchParams.get('reference') || searchParams.get('trxref')
      if (!ref) return

      try {
        await supabase.functions.invoke('payment-verify', {
          body: { reference: ref },
        })
      } catch {
        // Fallback silently to polling
      }
    }

    void triggerDirectVerify()

    const checkStatus = async () => {
      if (hasNavigatedRef.current || !isMountedRef.current) return

      try {
        const query = user?.id
          ? supabase.from('profiles').select('is_active').eq('id', user.id)
          : supabase.from('profiles').select('is_active')
        const { data, error } = await query.maybeSingle()

        if (!error && data?.is_active) {
          hasNavigatedRef.current = true
          if (isMountedRef.current) {
            setCurrentStep(3)
            setIsSuccess(true)
          }

          try {
            await refreshProfile()
          } catch {
            // Ignore transient refresh error to prevent blocking navigation
          }

          setTimeout(() => {
            if (isMountedRef.current) {
              navigate('/app', { replace: true, state: { paymentCelebration: true } })
            }
          }, CELEBRATION_DURATION_MS)
        }
      } catch {
        // Continue polling on transient errors
      }
    }

    void checkStatus()

    const intervalId = setInterval(() => {
      void checkStatus()
    }, 3000)

    const timeoutId = setTimeout(() => {
      if (isMountedRef.current && !hasNavigatedRef.current) {
        setIsTimedOut(true)
        clearInterval(intervalId)
      }
    }, 60000)

    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
      clearTimeout(stepTimer)
    }
  }, [user, isActive, refreshProfile, navigate, pollCount])

  const handleRetry = () => {
    hasNavigatedRef.current = false
    setIsTimedOut(false)
    setIsSuccess(false)
    setCurrentStep(1)
    setPollCount((prev) => prev + 1)
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative ambient background accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 rounded-full bg-accent/5 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-primary/5 blur-3xl"
      />

      {/* Brand Header */}
      <div className="mb-6 flex items-center gap-2">
        <span className="font-extrabold text-xl tracking-tight text-text">
          Nursing<strong className="text-accent font-extrabold">Prep</strong>
        </span>
        <span className="text-[10px] uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
          Pro Access
        </span>
      </div>

      {/* Main Verification Card */}
      <div className="w-full max-w-md border border-border bg-surface p-6 sm:p-8 rounded-2xl shadow-xl shadow-primary/5 relative backdrop-blur-sm">
        {isSuccess ? (
          /* Celebratory Success State */
          <div className="space-y-6 text-center py-2 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-300">
            {/* Animated Celebration Seal */}
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-success/20 animate-ping opacity-75"
              />
              <div
                aria-hidden="true"
                className="absolute -inset-1 rounded-full bg-success/15 blur-sm"
              />
              <div className="relative w-20 h-20 rounded-full bg-success/15 border-2 border-success flex items-center justify-center text-success shadow-lg shadow-success/10">
                <svg
                  className="w-10 h-10 text-success"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-widest bg-success/15 text-success border border-success/30">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Pro Activated
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-text">
                Payment Successful!
              </h1>
              <p className="text-base font-bold text-accent">
                Welcome to Pro!
              </p>
              <p className="text-sm text-muted max-w-sm mx-auto">
                Your account is now fully unlocked with unlimited practice modules, timed CBT simulations, and analytics.
              </p>
            </div>

            {/* Seamless Redirect Progress */}
            <div className="space-y-2 pt-2">
              <div className="w-full bg-border/60 rounded-full h-1.5 overflow-hidden">
                <div className="bg-primary h-1.5 rounded-full w-full animate-pulse" />
              </div>
              <p className="text-xs text-muted flex items-center justify-center gap-2">
                <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Preparing your personalized dashboard...
              </p>
            </div>
          </div>
        ) : !isTimedOut ? (
          /* Verification In-Progress State */
          <div className="space-y-6">
            {/* Top Emblem / Spinner */}
            <div className="text-center space-y-3">
              <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-2xl bg-primary/10 blur-md animate-pulse"
                />
                <div
                  aria-hidden="true"
                  className="absolute -inset-1 rounded-2xl border-2 border-primary/20 border-t-primary animate-spin"
                  style={{ animationDuration: '2.5s' }}
                />
                <div className="relative w-14 h-14 rounded-xl bg-surface border border-border flex items-center justify-center text-primary shadow-inner">
                  <svg
                    className="w-7 h-7 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.75}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                    />
                  </svg>
                </div>
              </div>

              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-text">
                  Confirming your payment...
                </h1>
                <p className="text-sm text-muted">
                  Please hold on while we securely verify your subscription.
                </p>
              </div>
            </div>

            {/* Stepper Checklist */}
            <div className="border border-border bg-bg/50 rounded-xl p-4 sm:p-5 space-y-4">
              {VERIFICATION_STEPS.map((step, idx) => {
                const isStepCompleted = currentStep > step.id
                const isStepActive = currentStep === step.id

                return (
                  <div key={step.id} className="relative">
                    {/* Connecting line between steps */}
                    {idx < VERIFICATION_STEPS.length - 1 && (
                      <div
                        aria-hidden="true"
                        className={`absolute left-3.5 top-8 w-0.5 h-6 -ml-px transition-colors duration-300 ${
                          isStepCompleted ? 'bg-success/50' : 'bg-border'
                        }`}
                      />
                    )}

                    <div className="flex items-start gap-3 relative">
                      {/* Step Status Icon */}
                      <div className="shrink-0 pt-0.5">
                        {isStepCompleted ? (
                          <div className="w-7 h-7 rounded-full bg-success/15 border border-success/40 flex items-center justify-center text-success transition-transform duration-300 scale-100">
                            <svg
                              className="w-4 h-4 text-success"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2.5}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 12.75l6 6 9-13.5"
                              />
                            </svg>
                          </div>
                        ) : isStepActive ? (
                          <div className="w-7 h-7 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full border border-border bg-surface flex items-center justify-center text-xs font-semibold text-muted">
                            {step.id}
                          </div>
                        )}
                      </div>

                      {/* Step Details */}
                      <div className="space-y-0.5 text-left">
                        <p
                          className={`text-sm font-semibold transition-colors duration-200 ${
                            isStepCompleted
                              ? 'text-text'
                              : isStepActive
                              ? 'text-text'
                              : 'text-muted'
                          }`}
                        >
                          {step.title}
                        </p>
                        <p className="text-xs text-muted">
                          {isStepActive
                            ? 'Processing...'
                            : isStepCompleted
                            ? 'Completed'
                            : step.subtitle}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Security Guarantee */}
            <div className="pt-2 border-t border-border flex items-center justify-center gap-2 text-xs text-muted">
              <svg
                className="w-3.5 h-3.5 text-accent shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
              <span>256-bit SSL encrypted • Instant verification</span>
            </div>
          </div>
        ) : (
          /* Timed Out Fallback State */
          <div className="space-y-6 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 duration-200">
            {/* Warning / Pending Icon */}
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-warning/15 border border-warning/30 flex items-center justify-center text-warning shadow-sm">
                <svg
                  className="w-8 h-8 text-warning"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-warning/15 text-warning border border-warning/30">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                Verification Pending
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-text">
                Payment status
              </h1>
              <p className="text-sm text-muted max-w-sm mx-auto">
                Payment received but not confirmed yet. Refresh in a minute or contact support.
              </p>
            </div>

            {/* Helpful Guidance Card */}
            <div className="border border-border bg-bg/50 p-4 rounded-xl text-left space-y-2 text-xs text-muted">
              <div className="font-bold text-text flex items-center gap-1.5">
                <svg
                  className="w-4 h-4 text-primary shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                  />
                </svg>
                Important reassurance
              </div>
              <ul className="space-y-1 pl-5 list-disc">
                <li>Your payment is secure and your account will not be charged twice.</li>
                <li>Access will activate automatically as soon as the bank settles.</li>
                <li>Click <strong>Check Again</strong> below to re-verify right now.</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleRetry}
                className="w-full bg-primary text-on-primary py-3 px-4 text-sm font-semibold rounded-xl hover:opacity-95 motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary flex items-center justify-center gap-2 shadow-sm"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                Check Again
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2">
                <a
                  href={`mailto:support@nursingprep.com?subject=Payment%20Verification%20Assistance%20-${encodeURIComponent(
                    user?.email || user?.id || 'Student'
                  )}&body=Hello%20NursingPrep%20Support,%0A%0AMy%20payment%20verification%20is%20pending.%0AUser%20Email:%20${encodeURIComponent(
                    user?.email || 'N/A'
                  )}%0AUser%20ID:%20${encodeURIComponent(
                    user?.id || 'N/A'
                  )}%0A%0APlease%20assist%20in%20verifying%20my%20account.`}
                  className="w-full border border-border hover:border-accent bg-surface hover:bg-bg text-text py-2.5 px-4 text-sm font-semibold rounded-xl text-center motion-safe:transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4 text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                    />
                  </svg>
                  Contact Support
                </a>

                <button
                  type="button"
                  onClick={() => navigate('/pay')}
                  className="w-full border border-border hover:border-accent bg-surface hover:bg-bg text-muted hover:text-text py-2.5 px-4 text-sm font-semibold rounded-xl text-center motion-safe:transition-colors"
                >
                  Back to /pay
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
