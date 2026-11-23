import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useFocusTrap } from '../hooks/useFocusTrap'

export interface StudentDetailData {
  id: string
  name: string | null
  email: string | null
  university: string | null
  level: number | null
  is_active: boolean
  paid_date: string | null
  joined_date: string | null
  stats: {
    attempts_submitted: number
    questions_answered: number
    accuracy_percent: number
  } | null
  recent_attempts: Array<{
    id: string
    score: number
    total: number
    percent: number
    submitted_at: string
  }> | null
}

interface StudentDetailDrawerProps {
  studentId: string | null
  isOpen: boolean
  onClose: () => void
  triggerElement?: HTMLElement | null
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
  } catch {
    return '—'
  }
}

function formatPaidDate(iso: string | null | undefined): string {
  if (!iso) return 'No payment on record'
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return 'No payment on record'
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
  } catch {
    return 'No payment on record'
  }
}

export function StudentDetailDrawer({
  studentId,
  isOpen,
  onClose,
  triggerElement,
}: StudentDetailDrawerProps) {
  const [data, setData] = useState<StudentDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetchKey, setFetchKey] = useState(0)
  const [actionLoading, setActionLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const [sessionAudit, setSessionAudit] = useState<{
    is_locked: boolean
    locked_at: string | null
    live_sessions_count: number
    recent_events: Array<{ event: string; created_at: string }>
  } | null>(null)

  const headingRef = useRef<HTMLHeadingElement>(null)

  // Use focus trap hook to manage Tab wrapping, Escape closing, inert background, and focus return
  const drawerRef = useFocusTrap<HTMLDivElement>({
    active: isOpen,
    onClose,
    triggerElement,
    initialFocusRef: headingRef,
  })

  // Asynchronously fetch student detail without synchronous setState before await
  useEffect(() => {
    if (!isOpen || !studentId) {
      return
    }

    let active = true

    const loadDetail = async () => {
      try {
        const { data: resData, error: rpcError } = await supabase.rpc('admin_student_detail', {
          p_user_id: studentId,
        })
        if (!active) return
        if (rpcError) {
          throw new Error(rpcError.message || 'Failed to load student details')
        }
        setData(resData as StudentDetailData)

        // Load session security audit
        const { data: auditData } = await supabase.rpc('admin_student_session_audit', {
          p_user_id: studentId,
        })
        if (active && auditData) {
          setSessionAudit(auditData)
        }
      } catch (err: unknown) {
        if (!active) return
        setError(err instanceof Error ? err.message : 'Failed to load student details')
      }
    }

    void loadDetail()

    return () => {
      active = false
    }
  }, [isOpen, studentId, fetchKey])

  const loading = isOpen && Boolean(studentId) && (!data || data.id !== studentId) && !error
  const questionsCount = data?.stats?.questions_answered ?? 0
  const accuracyText = questionsCount > 0 ? `${data?.stats?.accuracy_percent ?? 0}%` : '—'

  const handleRetry = () => {
    setError(null)
    setFetchKey((k) => k + 1)
  }

  const handleTogglePro = async () => {
    if (!data) return
    setActionLoading(true)
    const newStatus = !data.is_active
    try {
      const { error: rpcErr } = await supabase.rpc('admin_toggle_student_status', {
        p_user_id: data.id,
        p_is_active: newStatus,
      })

      if (rpcErr) {
        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ is_active: newStatus })
          .eq('id', data.id)

        if (updateErr) throw updateErr
      }

      setData((prev) => (prev ? { ...prev, is_active: newStatus } : null))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update student access')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResetAttempts = async () => {
    if (!data) return
    const confirmReset = window.confirm(
      `Are you sure you want to reset all exam and practice attempts for ${data.name || data.email}? This cannot be undone.`
    )
    if (!confirmReset) return

    setActionLoading(true)
    try {
      const { error: rpcErr } = await supabase.rpc('admin_reset_student_attempts', {
        p_user_id: data.id,
      })

      if (rpcErr) {
        // Direct delete fallback
        await supabase.from('exam_attempts').delete().eq('user_id', data.id)
      }

      setData((prev) =>
        prev
          ? {
              ...prev,
              stats: { attempts_submitted: 0, questions_answered: 0, accuracy_percent: 0 },
              recent_attempts: [],
            }
          : null
      )
      setResetSuccess(true)
      setTimeout(() => setResetSuccess(false), 4000)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to reset attempts')
    } finally {
      setActionLoading(false)
    }
  }

  const handleUnlockStudent = async () => {
    if (!data) return
    const confirmUnlock = window.confirm(
      `Unlock account for ${data.name || data.email}? This will restore access and reset the device switch counter.`
    )
    if (!confirmUnlock) return

    setActionLoading(true)
    try {
      const { error: rpcErr } = await supabase.rpc('admin_unlock_student', {
        p_user_id: data.id,
      })
      if (rpcErr) throw rpcErr

      setSessionAudit((prev) =>
        prev
          ? {
              ...prev,
              is_locked: false,
              locked_at: null,
              recent_events: [{ event: 'unlock', created_at: new Date().toISOString() }, ...prev.recent_events],
            }
          : null
      )
      alert('Account unlocked successfully.')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to unlock student account')
    } finally {
      setActionLoading(false)
    }
  }

  // Render modal drawer directly into document.body portal so siblings can be marked inert
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <motion.div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-drawer-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="relative w-full max-w-md bg-surface border-l border-border h-full shadow-2xl flex flex-col z-10 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between shrink-0">
              <h2
                id="student-drawer-title"
                ref={headingRef}
                tabIndex={-1}
                className="text-lg font-extrabold tracking-tight focus-visible:outline-none"
              >
                {data?.name || 'Student Profile'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details drawer"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-border/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Loading State */}
              {loading && (
                <div className="space-y-4 animate-pulse">
                  <div className="h-4 w-1/3 bg-border/60 rounded" />
                  <div className="space-y-2">
                    <div className="h-8 w-full bg-border/40 rounded" />
                    <div className="h-8 w-full bg-border/40 rounded" />
                    <div className="h-8 w-full bg-border/40 rounded" />
                  </div>
                  <div className="h-24 w-full bg-border/30 rounded-xl" />
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div
                  role="alert"
                  className="border border-danger/30 bg-danger/10 text-text p-6 rounded-2xl space-y-3"
                >
                  <p className="text-xs uppercase font-extrabold tracking-widest text-danger">
                    Failed to Load Details
                  </p>
                  <p className="text-sm text-muted">{error}</p>
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="border border-border bg-surface hover:border-accent text-text px-3.5 py-1.5 text-xs font-semibold rounded-lg motion-safe:transition-transform motion-safe:active:scale-[0.98]"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Content */}
              {data && !loading && (
                <div className="space-y-6 text-sm">
                  {/* Section 1: Student Information */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase font-extrabold tracking-wider text-muted">
                        Student Information
                      </h3>
                      <button
                        type="button"
                        onClick={handleTogglePro}
                        disabled={actionLoading}
                        className={`text-xs font-bold px-3 py-1 rounded-xl border transition-all ${
                          data.is_active
                            ? 'border-border bg-surface text-muted hover:border-red-500/50 hover:text-red-400'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black shadow-xs'
                        } disabled:opacity-50`}
                      >
                        {actionLoading
                          ? 'Updating...'
                          : data.is_active
                          ? 'Deactivate Access'
                          : '⚡ Activate Pro Access'}
                      </button>
                    </div>

                    {/* Session Security Lockout Alert */}
                    {sessionAudit?.is_locked && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                        <div className="text-xs space-y-0.5">
                          <span className="font-extrabold text-amber-500 block">
                            🔒 Account Locked (Session Violations)
                          </span>
                          <span className="text-[11px] text-muted block">
                            Triggered {formatDate(sessionAudit.locked_at)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleUnlockStudent}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-amber-500 text-black font-bold text-xs rounded-lg hover:opacity-90 disabled:opacity-50 shrink-0"
                        >
                          Unlock Account
                        </button>
                      </div>
                    )}
                    <div className="border border-border rounded-xl divide-y divide-border bg-surface/50">
                      <div className="px-4 py-2.5 flex justify-between gap-4">
                        <span className="text-muted text-xs font-medium">Full Name</span>
                        <span className="font-semibold text-text text-right">{data.name || '—'}</span>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between gap-4">
                        <span className="text-muted text-xs font-medium">Email</span>
                        <span className="text-text text-right truncate max-w-[220px]" title={data.email || ''}>
                          {data.email || '—'}
                        </span>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between gap-4">
                        <span className="text-muted text-xs font-medium">University</span>
                        <span className="text-text text-right">{data.university || '—'}</span>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between gap-4">
                        <span className="text-muted text-xs font-medium">Academic Level</span>
                        <span className="text-text text-right">
                          {data.level ? `${data.level} Level` : '—'}
                        </span>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between items-center gap-4">
                        <span className="text-muted text-xs font-medium">Status</span>
                        {data.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            Pending Payment
                          </span>
                        )}
                      </div>
                      <div className="px-4 py-2.5 flex justify-between gap-4">
                        <span className="text-muted text-xs font-medium">Payment Verified</span>
                        <span className="text-text text-right font-medium">
                          {formatPaidDate(data.paid_date)}
                        </span>
                      </div>
                      <div className="px-4 py-2.5 flex justify-between gap-4">
                        <span className="text-muted text-xs font-medium">Joined Date</span>
                        <span className="text-text text-right">{formatDate(data.joined_date)}</span>
                      </div>
                    </div>
                  </section>

                  {/* Section 2: Study Progress Stats */}
                  <section className="space-y-3">
                    <h3 className="text-xs uppercase font-extrabold tracking-wider text-muted">
                      Study Progress
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="border border-border rounded-xl p-3 text-center bg-surface/50">
                        <span className="text-xl font-extrabold tracking-tight block text-text">
                          {data.stats?.attempts_submitted ?? 0}
                        </span>
                        <span className="text-[11px] text-muted font-medium uppercase tracking-wider">
                          Sessions
                        </span>
                      </div>
                      <div className="border border-border rounded-xl p-3 text-center bg-surface/50">
                        <span className="text-xl font-extrabold tracking-tight block text-text">
                          {questionsCount}
                        </span>
                        <span className="text-[11px] text-muted font-medium uppercase tracking-wider">
                          Questions
                        </span>
                      </div>
                      <div className="border border-border rounded-xl p-3 text-center bg-surface/50">
                        <span className="text-xl font-extrabold tracking-tight block text-text">
                          {accuracyText}
                        </span>
                        <span className="text-[11px] text-muted font-medium uppercase tracking-wider">
                          Accuracy
                        </span>
                      </div>
                    </div>
                  </section>

                  {/* Section 3: Recent Sessions (up to 10) */}
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs uppercase font-extrabold tracking-wider text-muted">
                        Recent Sessions
                      </h3>
                      {data.stats && data.stats.attempts_submitted > 0 && (
                        <button
                          type="button"
                          onClick={handleResetAttempts}
                          disabled={actionLoading}
                          className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 underline disabled:opacity-50"
                        >
                          Reset Exam Attempts
                        </button>
                      )}
                    </div>
                    {resetSuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                        ✓ All test attempts and responses have been reset.
                      </div>
                    )}
                    {data.recent_attempts && data.recent_attempts.length > 0 ? (
                      <div className="border border-border rounded-xl divide-y divide-border bg-surface/50">
                        {data.recent_attempts.map((attempt) => (
                          <div
                            key={attempt.id}
                            className="px-4 py-2.5 flex items-center justify-between text-xs"
                          >
                            <span className="font-semibold text-text">
                              {attempt.score}/{attempt.total} ({attempt.percent}%)
                            </span>
                            <span className="text-muted">{formatDate(attempt.submitted_at)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted italic p-3 border border-border/50 rounded-xl bg-surface/30">
                        No completed exam or practice sessions recorded yet.
                      </p>
                    )}
                  </section>

                  {/* Section 4: Device Session Security Audit */}
                  {sessionAudit && (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs uppercase font-extrabold tracking-wider text-muted">
                          Session Security (Max 2 Allowed)
                        </h3>
                        <span className="text-[11px] font-bold text-muted">
                          {sessionAudit.live_sessions_count} Live Now
                        </span>
                      </div>
                      {sessionAudit.recent_events && sessionAudit.recent_events.length > 0 ? (
                        <div className="border border-border rounded-xl divide-y divide-border bg-surface/50 max-h-44 overflow-y-auto">
                          {sessionAudit.recent_events.map((evt, i) => (
                            <div key={i} className="px-4 py-2 flex items-center justify-between text-xs">
                              <span className="font-semibold text-text capitalize">
                                {evt.event === 'switch'
                                  ? '⚠️ Device Switch'
                                  : evt.event === 'lock'
                                  ? '🔒 Account Locked'
                                  : evt.event === 'unlock'
                                  ? '🔓 Admin Unlocked'
                                  : evt.event}
                              </span>
                              <span className="text-muted text-[11px]">{formatDate(evt.created_at)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted italic p-3 border border-border/50 rounded-xl bg-surface/30">
                          No session switches recorded.
                        </p>
                      )}
                    </section>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
