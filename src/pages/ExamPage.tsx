import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export interface ExamQuestion {
  id: string
  topic: string | null
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer?: string
  explanation?: string
}

export interface ExamResultItem {
  id: string
  chosen: string | null
  correct_answer: string
  explanation: string
}

export interface ExamSubmissionResponse {
  score: number
  total: number
  results: ExamResultItem[]
  late?: boolean
  auto_submitted?: boolean
}

type ExamPhase = 'start' | 'in_progress' | 'results'

const TOTAL_TIME_SECONDS = 20 * 60 // 20 minutes
const STORAGE_ATTEMPT_ID_KEY = 'nursingprep_exam_attempt_id'
const STORAGE_ANSWERS_KEY = 'nursingprep_exam_answers'

function getStoredAttemptId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_ATTEMPT_ID_KEY)
  } catch {
    return null
  }
}

function setStoredAttemptId(attemptId: string): void {
  try {
    sessionStorage.setItem(STORAGE_ATTEMPT_ID_KEY, attemptId)
  } catch {
    // Ignore storage errors
  }
}

function getStoredAnswers(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_ANSWERS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function setStoredAnswers(answers: Record<string, string>): void {
  try {
    sessionStorage.setItem(STORAGE_ANSWERS_KEY, JSON.stringify(answers))
  } catch {
    // Ignore storage errors
  }
}

function clearStoredExam(): void {
  try {
    sessionStorage.removeItem(STORAGE_ATTEMPT_ID_KEY)
    sessionStorage.removeItem(STORAGE_ANSWERS_KEY)
  } catch {
    // Ignore storage errors
  }
}

export function ExamPage() {
  const navigate = useNavigate()
  const { refreshProfile } = useAuth()

  // Exam phase
  const [phase, setPhase] = useState<ExamPhase>('start')
  const [noQuestionsAvailable, setNoQuestionsAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(() => Boolean(getStoredAttemptId()))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  // Exam state
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME_SECONDS)
  const [resultsData, setResultsData] = useState<ExamSubmissionResponse | null>(null)

  // Mode state: 'timed' (strict exam) or 'tutor' (interactive practice)
  const [isTutorMode, setIsTutorMode] = useState<boolean>(() => {
    const searchParams = new URLSearchParams(window.location.search)
    return searchParams.get('mode') === 'tutor'
  })
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Auto-save refs
  const pendingChangesRef = useRef<Record<string, string>>({})
  const isDirtyRef = useRef(false)
  const isSavingRef = useRef(false)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Timer deadline ref and state
  const deadlineRef = useRef<number | null>(null)
  const [deadline, setDeadline] = useState<number | null>(null)
  const answersRef = useRef(answers)
  useEffect(() => {
    answersRef.current = answers
  }, [answers])

  // Guard against double submit
  const hasSubmittedRef = useRef(false)

  // Flush pending changes to server
  const flushPendingChangesRef = useRef<((targetAttemptId?: string | null) => Promise<void>) | null>(null)

  const flushPendingChanges = useCallback(async (targetAttemptId?: string | null) => {
    const effectiveAttemptId = targetAttemptId || attemptId
    if (!effectiveAttemptId) return
    if (!isDirtyRef.current || Object.keys(pendingChangesRef.current).length === 0) {
      return
    }

    if (isSavingRef.current) return
    isSavingRef.current = true

    const changesToSend = { ...pendingChangesRef.current }
    setSaveStatus('Saving...')

    try {
      const { error } = await supabase.rpc('save_answers', {
        p_attempt_id: effectiveAttemptId,
        p_changes: changesToSend,
      })

      if (error) {
        throw error
      }

      for (const [key, val] of Object.entries(changesToSend)) {
        if (pendingChangesRef.current[key] === val) {
          delete pendingChangesRef.current[key]
        }
      }

      if (Object.keys(pendingChangesRef.current).length === 0) {
        isDirtyRef.current = false
        setSaveStatus(null)
      }

      retryCountRef.current = 0
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
        retryTimerRef.current = null
      }
    } catch (err: unknown) {
      isDirtyRef.current = true
      setSaveStatus("Couldn't save, retrying")
      const msg = err instanceof Error ? err.message : 'Failed to save answers.'
      toast.error(msg)

      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current)
      }
      const currentRetry = retryCountRef.current
      retryCountRef.current = currentRetry + 1
      const delayMs = currentRetry < 3 ? (currentRetry + 1) * 1000 : 10000

      retryTimerRef.current = setTimeout(() => {
        void flushPendingChangesRef.current?.(effectiveAttemptId)
      }, delayMs)
    } finally {
      isSavingRef.current = false
    }
  }, [attemptId])

  useEffect(() => {
    flushPendingChangesRef.current = flushPendingChanges
  }, [flushPendingChanges])

  // Submit exam callback
  const submitExam = useCallback(async (currentAnswers: Record<string, string>, targetAttemptId?: string) => {
    if (hasSubmittedRef.current) return
    hasSubmittedRef.current = true
    setIsSubmitting(true)
    setShowConfirmModal(false)

    const effectiveAttemptId = targetAttemptId || attemptId

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }

    // Flush pending changes right before submit (only in timed exam mode)
    if (isDirtyRef.current && !isTutorMode) {
      await flushPendingChanges(effectiveAttemptId)
    }

    if (isTutorMode) {
      // Calculate results client-side for tutor mode
      let correctScore = 0
      const results: ExamResultItem[] = questions.map((q) => {
        const chosen = currentAnswers[q.id] || null
        const correct = (q.correct_answer || '').toUpperCase()
        if (chosen && chosen.toUpperCase() === correct) {
          correctScore++
        }
        return {
          id: q.id,
          chosen,
          correct_answer: correct,
          explanation: q.explanation || 'No rationale available for this question.',
        }
      })

      clearStoredExam()
      setResultsData({
        score: correctScore,
        total: questions.length,
        results,
      })
      setPhase('results')
      setIsSubmitting(false)
      return
    }

    try {
      const { data, error } = await supabase.rpc('submit_exam', {
        p_attempt_id: effectiveAttemptId,
        p_answers: currentAnswers,
      })

      if (error || !data) {
        toast.error(error?.message || 'Failed to submit exam. Please try again.')
        hasSubmittedRef.current = false // Allow retry on failure
        setIsSubmitting(false)
        return
      }

      clearStoredExam()
      setResultsData(data as ExamSubmissionResponse)
      setPhase('results')
      void refreshProfile()

      // Save completed attempt locally as immediate fallback for instant dashboard reflection
      try {
        const existingHistory = JSON.parse(localStorage.getItem('nursingprep_session_history_v2') || '[]')
        const calculatedPercentage = data.total > 0 ? Math.round((data.score / data.total) * 100) : 0
        const newRecord = {
          id: effectiveAttemptId || `attempt-${Date.now()}`,
          courseTitle: 'Nursing CBT Practice',
          courseId: 'general',
          topicTitle: `Practice Drill (${data.total} Qs)`,
          date: 'Just now',
          score: data.score,
          total: data.total,
          percentage: calculatedPercentage,
          mode: 'timed',
          difficulty: 'medium',
          status: calculatedPercentage >= 75 ? 'passed' : 'review',
        }
        localStorage.setItem('nursingprep_session_history_v2', JSON.stringify([newRecord, ...existingHistory.slice(0, 9)]))
      } catch {
        // Ignore localStorage error
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during submission.'
      toast.error(msg)
      hasSubmittedRef.current = false
    } finally {
      setIsSubmitting(false)
    }
  }, [attemptId, flushPendingChanges, isTutorMode, questions])

  const submitExamRef = useRef(submitExam)
  useEffect(() => {
    submitExamRef.current = submitExam
  }, [submitExam])

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [])

  // Flush on visibilitychange hidden and pagehide
  useEffect(() => {
    if (phase !== 'in_progress') return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
          debounceTimerRef.current = null
        }
        void flushPendingChanges()
      }
    }

    const handlePageHide = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
      void flushPendingChanges()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [phase, flushPendingChanges])

  // Resume unsubmitted attempt from sessionStorage on mount
  useEffect(() => {
    let isCurrent = true
    let isFinished = false
    const savedAttemptId = getStoredAttemptId()

    if (!savedAttemptId) {
      return
    }

    const fallbackToStart = (errorMsg: string) => {
      clearStoredExam()
      deadlineRef.current = null
      setDeadline(null)
      setAttemptId(null)
      setQuestions([])
      setAnswers({})
      setIsLoading(false)
      setPhase('start')
      toast.error(errorMsg)
    }

    // 10-second timeout fallback to prevent hanging
    const timeoutTimer = setTimeout(() => {
      if (!isCurrent || isFinished) return
      isFinished = true
      fallbackToStart('Resume request timed out. Please start a new attempt.')
    }, 10000)

    const resumeAttempt = async () => {
      try {
        const { data, error } = await supabase.rpc('resume_exam', { p_attempt_id: savedAttemptId })
        if (!isCurrent || isFinished) return
        isFinished = true
        clearTimeout(timeoutTimer)

        if (error || !data) {
          fallbackToStart(error?.message || 'Failed to resume exam. Please start a new attempt.')
          return
        }

        // If the attempt was already submitted or auto-submitted, show results
        if (data.status === 'submitted') {
          const { data: resData, error: resError } = await supabase.rpc('get_attempt_result', {
            p_attempt_id: savedAttemptId,
          })

          if (resError || !resData) {
            fallbackToStart(resError?.message || 'Failed to fetch exam results.')
            return
          }

          clearStoredExam()
          setResultsData(resData as ExamSubmissionResponse)
          setPhase('results')
          setIsLoading(false)
          return
        }

        const returnedQuestions: ExamQuestion[] = data.questions || []
        const secondsRemaining: number = typeof data.seconds_remaining === 'number' ? data.seconds_remaining : 0

        // Restore answers from the server on resume (sessionStorage is a cache only)
        const serverAnswers: Record<string, string> = data.answers || {}
        const cachedAnswers = getStoredAnswers()
        const restoredAnswers = { ...cachedAnswers, ...serverAnswers }
        setStoredAnswers(restoredAnswers)

        if (returnedQuestions.length === 0) {
          fallbackToStart('No questions found for this exam attempt.')
          return
        }

        const targetDeadline = Date.now() + secondsRemaining * 1000
        deadlineRef.current = targetDeadline
        setDeadline(targetDeadline)

        setAttemptId(savedAttemptId)
        setQuestions(returnedQuestions)
        setAnswers(restoredAnswers)
        setTimeLeft(secondsRemaining)
        setCurrentIndex(0)
        setPhase('in_progress')
        setIsLoading(false)

        if (secondsRemaining <= 0 && !hasSubmittedRef.current) {
          void submitExamRef.current(restoredAnswers, savedAttemptId)
        }
      } catch (err: unknown) {
        if (!isCurrent || isFinished) return
        isFinished = true
        clearTimeout(timeoutTimer)
        const msg = err instanceof Error ? err.message : 'Failed to resume exam.'
        fallbackToStart(msg)
      }
    }

    void resumeAttempt()

    return () => {
      isCurrent = false
      clearTimeout(timeoutTimer)
    }
  }, [])

  // Start exam
  const handleStartExam = async () => {
    setIsLoading(true)
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    pendingChangesRef.current = {}
    isDirtyRef.current = false
    setSaveStatus(null)
    retryCountRef.current = 0

    try {
      const searchParams = new URLSearchParams(window.location.search)
      const requestedCount = parseInt(searchParams.get('count') || '20', 10)
      const validCount = !isNaN(requestedCount) && requestedCount > 0 ? requestedCount : 20
      const tutorModeActive = searchParams.get('mode') === 'tutor'
      setIsTutorMode(tutorModeActive)

      let returnedQuestions: ExamQuestion[] = []
      let returnedAttemptId: string | null = null

      if (tutorModeActive) {
        // Tutor practice mode: fetch questions with answers & rationales
        const { data, error } = await supabase.rpc('get_practice_questions', { p_count: validCount })
        if (error || !data) {
          if (error?.message?.includes('TRIAL_EXHAUSTED')) {
            toast.error('Free trial completed. Activate Pro to unlock unlimited practice!')
            navigate('/pay')
            return
          }
          if (error?.message?.includes('NO_QUESTIONS_FOR_LEVEL')) {
            setNoQuestionsAvailable(true)
            setIsLoading(false)
            return
          }
          toast.error(error?.message || 'Failed to load practice questions. Please try again.')
          setIsLoading(false)
          return
        }
        returnedQuestions = data.questions || []
        returnedAttemptId = `tutor-${Date.now()}`
      } else {
        // Strict timed CBT mode: server withholds answers until submit
        const { data, error } = await supabase.rpc('get_exam_questions', { p_count: validCount })
        if (error || !data) {
          if (error?.message?.includes('TRIAL_EXHAUSTED')) {
            toast.error('Free trial exam completed. Activate Pro to unlock unlimited exam practice!')
            navigate('/pay')
            return
          }
          if (error?.message?.includes('NO_QUESTIONS_FOR_LEVEL')) {
            setNoQuestionsAvailable(true)
            setIsLoading(false)
            return
          }
          toast.error(error?.message || 'Failed to load exam questions. Please try again.')
          setIsLoading(false)
          return
        }
        returnedQuestions = data.questions || []
        returnedAttemptId = data.attempt_id
      }

      if (!returnedAttemptId || returnedQuestions.length === 0) {
        toast.error('No exam questions available at this time.')
        setIsLoading(false)
        return
      }

      // Calculate time: 1 minute per question (minimum 10 mins, maximum 120 mins)
      const examSeconds = Math.max(10 * 60, Math.min(120 * 60, returnedQuestions.length * 60))
      const targetDeadline = Date.now() + examSeconds * 1000
      deadlineRef.current = targetDeadline
      setDeadline(targetDeadline)

      setStoredAttemptId(returnedAttemptId)
      setStoredAnswers({})

      setAttemptId(returnedAttemptId)
      setQuestions(returnedQuestions)
      setCurrentIndex(0)
      setAnswers({})
      setTimeLeft(examSeconds)
      setElapsedSeconds(0)
      hasSubmittedRef.current = false
      setPhase('in_progress')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  // Timer countdown and auto-submit (strict mode) or elapsed stopwatch (tutor mode)
  useEffect(() => {
    if (phase !== 'in_progress') return

    if (isTutorMode) {
      // Tutor mode: relaxed count-up stopwatch
      const stopwatch = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
      return () => clearInterval(stopwatch)
    }

    if (!deadline) return

    const updateTimer = () => {
      const remainingMs = Math.max(0, deadline - Date.now())
      const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000))
      setTimeLeft(remainingSec)

      if (remainingMs <= 0 && !hasSubmittedRef.current) {
        void submitExamRef.current(answersRef.current)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        updateTimer()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [phase, deadline, isTutorMode])

  const handleSelectOption = useCallback((questionId: string, optionKey: string) => {
    setAnswers((prev) => {
      const updated = { ...prev, [questionId]: optionKey }
      setStoredAnswers(updated)
      return updated
    })

    if (!isTutorMode) {
      // Track pending changes and dirty state in strict timed exam mode
      pendingChangesRef.current[questionId] = optionKey
      isDirtyRef.current = true

      // Debounce save (1s)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        void flushPendingChangesRef.current?.()
      }, 1000)
    }
  }, [isTutorMode])

  // Keyboard navigation
  useEffect(() => {
    if (phase !== 'in_progress') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return

      const currentQ = questions[currentIndex]
      if (!currentQ) return

      if (e.key === '1' || e.key.toLowerCase() === 'a') {
        handleSelectOption(currentQ.id, 'A')
      } else if (e.key === '2' || e.key.toLowerCase() === 'b') {
        handleSelectOption(currentQ.id, 'B')
      } else if (e.key === '3' || e.key.toLowerCase() === 'c') {
        handleSelectOption(currentQ.id, 'C')
      } else if (e.key === '4' || e.key.toLowerCase() === 'd') {
        handleSelectOption(currentQ.id, 'D')
      } else if (e.key === 'ArrowRight' && currentIndex < questions.length - 1) {
        setCurrentIndex((i) => i + 1)
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex((i) => i - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [phase, currentIndex, questions, handleSelectOption])

  const formatTimer = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  const answeredCount = Object.keys(answers).length
  const currentQuestion = questions[currentIndex]

  // Reset to retake
  const handleRetake = () => {
    clearStoredExam()
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    pendingChangesRef.current = {}
    isDirtyRef.current = false
    setSaveStatus(null)
    retryCountRef.current = 0
    deadlineRef.current = null
    setDeadline(null)
    setAttemptId(null)
    setQuestions([])
    setCurrentIndex(0)
    setAnswers({})
    setTimeLeft(TOTAL_TIME_SECONDS)
    setResultsData(null)
    hasSubmittedRef.current = false
    setPhase('start')
  }

  // -------------------------------------------------------------
  // NO QUESTIONS AVAILABLE FOR LEVEL SCREEN
  // -------------------------------------------------------------
  if (noQuestionsAvailable) {
    return (
      <div className="min-h-screen bg-bg text-text flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-md border border-border bg-surface p-8 rounded-2xl space-y-6 text-center">
          <div className="space-y-2">
            <span className="text-xs uppercase font-extrabold tracking-widest text-accent">
              Examination Notice
            </span>
            <h1 className="text-2xl font-extrabold tracking-tight">
              No questions are available for your level yet
            </h1>
            <p className="text-sm text-muted">
              We are currently preparing examination materials for your academic cohort. Please check back later.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/app"
              aria-label="Back to dashboard"
              className="inline-block w-full text-center bg-primary text-on-primary py-3 text-sm font-semibold rounded-xl hover:opacity-95 motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // PHASE 1: START SCREEN
  // -------------------------------------------------------------
  if (phase === 'start') {
    const searchParams = new URLSearchParams(window.location.search)
    const urlCount = parseInt(searchParams.get('count') || '20', 10)
    const displayCount = !isNaN(urlCount) && urlCount > 0 ? urlCount : 20
    const displayCourse = searchParams.get('course') || 'Nursing Examination'
    const displayMode = searchParams.get('mode') === 'tutor' ? 'Tutor & Study Mode' : 'Timed Computer-Based Test'

    return (
      <div className="min-h-screen bg-bg text-text flex flex-col justify-center items-center p-6">
        <div className="w-full max-w-lg border border-border bg-surface p-8 rounded-2xl space-y-6">
          <div className="space-y-2">
            <span className="text-xs uppercase font-extrabold tracking-widest text-accent">
              {displayMode}
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight">
              {displayCourse}
            </h1>
            <p className="text-sm text-muted">
              Prepare yourself before beginning. Once started, your exam session will begin immediately.
            </p>
          </div>

          <div className="border border-border bg-bg p-5 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-muted">Total Questions:</span>
              <span className="font-bold text-text tabular-nums">{displayCount} questions</span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-muted">Allocated Time:</span>
              <span className="font-bold text-text tabular-nums">{displayCount} minutes</span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold">
              <span className="text-muted">Format:</span>
              <span className="font-bold text-text">Multiple Choice (A-D)</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleStartExam}
              disabled={isLoading}
              aria-label="Start exam"
              className="w-full bg-primary text-on-primary py-3.5 text-sm font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isLoading ? 'Preparing exam...' : `Start exam (${displayCount} Qs)`}
            </button>
            <button
              type="button"
              onClick={() => navigate('/app')}
              disabled={isLoading}
              aria-label="Back to dashboard"
              className="w-full border border-border hover:border-accent bg-surface text-text py-2.5 text-sm font-semibold rounded-xl motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------
  // PHASE 3: RESULTS SCREEN
  // -------------------------------------------------------------
  if (phase === 'results' && resultsData) {
    const score = resultsData.score
    const total = resultsData.total
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0
    const circumference = 2 * Math.PI * 34
    const strokeDashoffset = circumference - (percentage / 100) * circumference

    return (
      <div className="min-h-screen bg-bg text-text pb-16">
        <header className="border-b border-border bg-surface sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <span className="font-extrabold text-lg tracking-tight">Exam Results</span>
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="border border-border hover:border-accent bg-surface text-text px-3.5 py-1.5 text-sm font-semibold rounded-lg motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Dashboard
            </button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
          {/* Summary Card with Score & Ring */}
          <div className="border border-border bg-surface p-6 sm:p-8 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-xs uppercase font-extrabold tracking-widest text-accent">
                Performance Overview
              </span>
              <div className="flex items-center gap-3 justify-center sm:justify-start">
                <div className="text-4xl font-extrabold tracking-tight">
                  {score} / {total}
                </div>
                {resultsData.late && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-border text-muted">
                    Submitted after time limit
                  </span>
                )}
                {resultsData.auto_submitted && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-border text-muted">
                    Auto-submitted
                  </span>
                )}
              </div>
              <p className="text-sm text-muted">
                {percentage >= 70
                  ? 'Excellent work! You achieved passing mastery.'
                  : 'Review the questions and explanations below to strengthen your weak areas.'}
              </p>
            </div>

            {/* Score Ring */}
            <div className="relative w-24 h-24 flex items-center justify-center shrink-0" aria-label={`Score percentage: ${percentage}%`}>
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-border fill-none"
                  strokeWidth="7"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-primary fill-none transition-all duration-700 ease-out"
                  strokeWidth="7"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute font-extrabold text-base tracking-tight">{percentage}%</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRetake}
              aria-label="Retake exam"
              className="bg-primary text-on-primary px-5 py-2.5 text-sm font-semibold rounded-xl hover:opacity-95 motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Retake exam
            </button>
            <button
              type="button"
              onClick={() => navigate('/app')}
              aria-label="Back to dashboard"
              className="border border-border hover:border-accent bg-surface text-text px-5 py-2.5 text-sm font-semibold rounded-xl motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Back to dashboard
            </button>
          </div>

          {/* Detailed Question Review */}
          <div className="space-y-4 pt-4">
            <h2 className="text-xl font-bold tracking-tight">Detailed Solutions</h2>
            <div className="space-y-4">
              {resultsData.results.map((item, idx) => {
                const questionObj = questions.find((q) => q.id === item.id)
                const isCorrect = item.chosen && item.chosen.toUpperCase() === item.correct_answer.toUpperCase()

                return (
                  <div
                    key={item.id}
                    className="border border-border bg-surface p-5 sm:p-6 rounded-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">
                        Question {idx + 1}
                      </span>
                      {isCorrect ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-border bg-bg text-text">
                          <svg className="w-3.5 h-3.5 text-text" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border border-border bg-surface text-muted">
                          <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                          Incorrect
                        </span>
                      )}
                    </div>

                    <p className="font-semibold text-base sm:text-lg">
                      {questionObj ? questionObj.question_text : `Question ID: ${item.id}`}
                    </p>

                    {/* Answers block */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="p-3 rounded-xl border border-border bg-bg">
                        <span className="text-xs font-bold text-muted uppercase block mb-1">Your Choice</span>
                        <span className="font-semibold text-text">
                          {item.chosen ? `Option ${item.chosen.toUpperCase()}` : '(No answer selected)'}
                        </span>
                      </div>
                      <div className="p-3 rounded-xl border border-border bg-bg">
                        <span className="text-xs font-bold text-muted uppercase block mb-1">Correct Answer</span>
                        <span className="font-semibold text-text">
                          Option {item.correct_answer.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Explanation */}
                    {item.explanation && (
                      <div className="p-4 rounded-xl border border-border/80 bg-bg/50 space-y-1">
                        <span className="text-xs font-bold text-muted uppercase tracking-wider block">
                          Explanation
                        </span>
                        <p className="text-sm text-text leading-relaxed">
                          {item.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </div>
    )
  }

  // -------------------------------------------------------------
  // PHASE 2: IN PROGRESS (EXAM SCREEN)
  // -------------------------------------------------------------
  if (!currentQuestion) {
    return null
  }

  const options: Array<{ key: 'A' | 'B' | 'C' | 'D'; text: string }> = [
    { key: 'A', text: currentQuestion.option_a },
    { key: 'B', text: currentQuestion.option_b },
    { key: 'C', text: currentQuestion.option_c },
    { key: 'D', text: currentQuestion.option_d },
  ]

  const selectedAnswer = answers[currentQuestion.id]

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      {/* Top Header */}
      <header className="border-b border-border bg-surface sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm sm:text-base tracking-tight">
              {isTutorMode ? 'Tutor Mode Practice' : 'NursingPrep CBT'}
            </span>
            {isTutorMode && (
              <span className="text-[10px] font-black tracking-widest uppercase bg-accent/15 text-accent px-2 py-0.5 rounded-full border border-accent/20">
                Untimed Practice
              </span>
            )}
            {saveStatus && (
              <span className="text-xs text-muted font-medium ml-2" role="status" aria-live="polite">
                {saveStatus}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Timer or Stopwatch */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm font-mono font-bold ${
                isTutorMode
                  ? 'text-accent bg-accent/5 border-accent/20'
                  : timeLeft <= 60
                  ? 'text-accent border-accent animate-pulse'
                  : 'text-text bg-bg'
              }`}
              aria-label={isTutorMode ? 'Elapsed study time' : 'Time remaining'}
            >
              <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{isTutorMode ? formatTimer(elapsedSeconds) : formatTimer(timeLeft)}</span>
            </div>

            {/* Submit button in header */}
            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              disabled={isSubmitting}
              aria-label="Submit exam"
              className="bg-primary text-on-primary px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg hover:opacity-95 disabled:opacity-50 motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </header>

      {/* Main question area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-8 flex flex-col space-y-6 pb-24 sm:pb-8">
        {/* Question Counter & Topic */}
        <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-xs text-muted/60">·</span>
            <span className="text-xs text-muted font-medium">
              {answeredCount} answered
            </span>
          </div>
          {currentQuestion.topic && (
            <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-widest text-accent bg-accent/10 px-2.5 py-0.5 rounded-full">
              {currentQuestion.topic}
            </span>
          )}
        </div>

        {/* Question Text with smooth transition */}
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0.9 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1 }}
          className="space-y-6 flex-1 flex flex-col justify-between"
        >
          {/* Clinical Vignette Card */}
          <div className="border border-border bg-surface p-5 sm:p-7 rounded-2xl shadow-sm border-l-4 border-l-accent space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-accent">Clinical Case Stem</span>
            <h2 className="text-base sm:text-xl font-bold leading-relaxed text-text">
              {currentQuestion.question_text}
            </h2>
          </div>

          {/* Four Option Buttons (A-D) */}
          <div className="flex flex-col space-y-3 pt-1">
            {options.map((opt) => {
              const isSelected = selectedAnswer === opt.key
              const isTutorRevealed = isTutorMode && Boolean(selectedAnswer)
              const isCorrectAnswer = isTutorRevealed && opt.key === (currentQuestion.correct_answer || '').toUpperCase()
              const isIncorrectSelection = isTutorRevealed && isSelected && !isCorrectAnswer

              let buttonClasses = 'border-border bg-surface hover:border-border-strong active:bg-surface-elevated text-text'
              let badgeClasses = 'bg-bg text-muted border border-border'

              if (isTutorRevealed) {
                if (isCorrectAnswer) {
                  buttonClasses = 'border-emerald-500 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500'
                  badgeClasses = 'bg-emerald-500 text-white shadow-sm'
                } else if (isIncorrectSelection) {
                  buttonClasses = 'border-rose-500 bg-rose-500/10 text-rose-300 ring-1 ring-rose-500'
                  badgeClasses = 'bg-rose-500 text-white shadow-sm'
                } else {
                  buttonClasses = 'border-border/60 bg-surface/50 text-muted/60 opacity-60'
                  badgeClasses = 'bg-bg text-muted/40 border border-border/40'
                }
              } else if (isSelected) {
                buttonClasses = 'border-accent bg-accent-light shadow-sm text-text ring-1 ring-accent'
                badgeClasses = 'bg-accent text-white shadow-sm'
              }

              return (
                <motion.button
                  key={opt.key}
                  type="button"
                  whileTap={{ scale: 0.99 }}
                  onClick={() => handleSelectOption(currentQuestion.id, opt.key)}
                  aria-label={`Option ${opt.key}: ${opt.text}`}
                  className={`w-full text-left p-4 sm:p-4.5 rounded-2xl border flex items-center justify-between gap-4 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${buttonClasses}`}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 transition ${badgeClasses}`}
                    >
                      {opt.key}
                    </span>
                    <span className="text-sm sm:text-base font-medium leading-relaxed">{opt.text}</span>
                  </div>

                  {/* Indicator icon */}
                  {isTutorRevealed && isCorrectAnswer && (
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  {isTutorRevealed && isIncorrectSelection && (
                    <div className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  {!isTutorRevealed && isSelected && (
                    <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-accent" />
                    </div>
                  )}
                </motion.button>
              )
            })}
          </div>

          {/* Instant Clinical Rationale in Tutor Mode */}
          {isTutorMode && selectedAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl border border-border bg-surface space-y-3 mt-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-accent">
                    Instant Clinical Rationale
                  </span>
                </div>
                <span className="text-xs font-extrabold text-muted">
                  Correct Answer: <span className="text-emerald-400 font-mono">Option {currentQuestion.correct_answer?.toUpperCase()}</span>
                </span>
              </div>
              <p className="text-sm sm:text-base text-text/90 leading-relaxed">
                {currentQuestion.explanation || 'No rationale available for this question stem.'}
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* Question Selector Palette (Horizontal scrollable with smooth touch) */}
        <div className="pt-2 border-t border-border space-y-2">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-bold uppercase tracking-wider">Jump to Question</span>
            <span>{Math.round((answeredCount / Math.max(1, questions.length)) * 100)}% Completed</span>
          </div>

          <div
            className="flex items-center gap-1.5 overflow-x-auto py-2 px-1 scrollbar-none touch-pan-x"
            role="navigation"
            aria-label="Question selector"
          >
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex
              const isAnswered = Boolean(answers[q.id])

              let btnStyle = 'bg-surface border-border text-muted hover:border-border/80'
              if (isAnswered) {
                btnStyle = 'bg-primary text-on-primary border-primary'
              }

              if (isCurrent) {
                btnStyle += ' ring-2 ring-primary ring-offset-2 ring-offset-bg font-extrabold'
              }

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg border text-xs font-semibold shrink-0 transition flex items-center justify-center ${btnStyle}`}
                >
                  {idx + 1}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sticky Mobile & Desktop Bottom Navigation Bar */}
        <div className="fixed sm:static bottom-0 left-0 right-0 z-20 border-t border-border bg-surface/95 backdrop-blur-md sm:bg-transparent sm:border-0 p-3 sm:p-0">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              aria-label="Previous question"
              className="flex-1 sm:flex-none border border-border hover:border-accent bg-surface text-text px-5 py-2.5 text-sm font-semibold rounded-xl disabled:opacity-30 disabled:pointer-events-none transition active:scale-[0.98]"
            >
              ← Previous
            </button>

            {currentIndex === questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                disabled={isSubmitting}
                className="flex-1 sm:flex-none bg-primary text-on-primary px-6 py-2.5 text-sm font-semibold rounded-xl hover:opacity-95 transition active:scale-[0.98]"
              >
                Submit Exam ✓
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                aria-label="Next question"
                className="flex-1 sm:flex-none bg-primary text-on-primary sm:bg-surface sm:text-text sm:border sm:border-border sm:hover:border-accent px-5 py-2.5 text-sm font-semibold rounded-xl transition active:scale-[0.98]"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-sm bg-surface border border-border p-6 rounded-2xl shadow-xl space-y-5">
            <div className="space-y-1">
              <h3 id="confirm-modal-title" className="text-xl font-bold tracking-tight">
                Submit Exam?
              </h3>
              <p className="text-sm text-muted">
                You answered {answeredCount} of {questions.length}. Submit?
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                aria-label="Cancel submission"
                className="flex-1 border border-border hover:border-accent bg-surface text-text py-2.5 text-sm font-semibold rounded-xl motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => submitExam(answers)}
                disabled={isSubmitting}
                aria-label="Confirm submit"
                className="flex-1 bg-primary text-on-primary py-2.5 text-sm font-semibold rounded-xl hover:opacity-95 disabled:opacity-50 motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {isSubmitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
