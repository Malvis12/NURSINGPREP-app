import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, User, Clock, Eye, LogOut, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { ThemeToggle } from '../components/ThemeToggle'
import { MobileBottomNav } from '../components/MobileBottomNav'
import { supabase } from '../lib/supabase'

// ============================================================================
// TYPES & DATA STRUCTURES
// ============================================================================

export interface TopicItem {
  id: string
  name: string
  questionCount: number
  highYield?: boolean
}

export interface CourseItem {
  id: string
  code: string
  title: string
  category: string
  description: string
  levels: number[]
  totalQuestions: number
  masteryPercentage: number
  isHighYield: boolean
  icon: 'medsurg' | 'pharm' | 'foundations' | 'mch' | 'community' | 'mental'
  topics: TopicItem[]
}

export interface PracticeSessionRecord {
  id: string
  courseTitle: string
  courseId: string
  topicTitle: string
  date: string
  score: number
  total: number
  percentage: number
  mode: 'timed' | 'tutor'
  difficulty: 'all' | 'easy' | 'medium' | 'hard'
  status: 'passed' | 'review'
}

export interface PracticeSetupConfig {
  level: number
  courseId: string
  topicId: string
  mode: 'timed' | 'tutor'
  difficulty: 'all' | 'easy' | 'medium' | 'hard'
  questionCount: number
}

// ============================================================================
// CLINICAL CURRICULUM DATA
// ============================================================================

const NURSING_COURSES: CourseItem[] = [
  {
    id: 'med-surg',
    code: 'NUR 301',
    title: 'Medical-Surgical Nursing',
    category: 'Clinical Core',
    description: 'Adult pathophysiology, acute & chronic disorders, cardiovascular dysrhythmias, respiratory care, and post-op nursing.',
    levels: [300, 400],
    totalQuestions: 450,
    masteryPercentage: 76,
    isHighYield: true,
    icon: 'medsurg',
    topics: [
      { id: 'all', name: 'All Topics (Comprehensive)', questionCount: 450, highYield: true },
      { id: 'cardio', name: 'Cardiovascular & Dysrhythmias', questionCount: 95, highYield: true },
      { id: 'resp', name: 'Respiratory Disorders & ABG Analysis', questionCount: 80, highYield: true },
      { id: 'endocrine', name: 'Endocrine & Diabetes Management', questionCount: 65, highYield: true },
      { id: 'renal', name: 'Renal, Fluids & Electrolyte Balance', questionCount: 75, highYield: true },
      { id: 'periop', name: 'Perioperative Care & Surgical Asepsis', questionCount: 70 },
      { id: 'neuro', name: 'Neurological & Musculoskeletal Disorders', questionCount: 65 },
    ],
  },
  {
    id: 'pharm',
    code: 'PHA 302',
    title: 'Pharmacology & Therapeutics',
    category: 'Pharmacotherapy',
    description: 'Drug classifications, mechanism of action, dosage calculations, critical adverse reactions, and emergency pharmacology.',
    levels: [200, 300, 400],
    totalQuestions: 380,
    masteryPercentage: 68,
    isHighYield: true,
    icon: 'pharm',
    topics: [
      { id: 'all', name: 'All Topics (Comprehensive)', questionCount: 380, highYield: true },
      { id: 'dosage', name: 'Dosage Calculations & IV Flow Rates', questionCount: 85, highYield: true },
      { id: 'cardio-drugs', name: 'Cardiovascular Drugs & Antihypertensives', questionCount: 75, highYield: true },
      { id: 'antimicrobial', name: 'Antibiotics & Antiviral Therapy', questionCount: 65, highYield: true },
      { id: 'analgesics', name: 'Analgesics, Opioids & NSAIDs', questionCount: 55 },
      { id: 'endocrine-drugs', name: 'Insulin & Hypoglycemic Agents', questionCount: 50 },
      { id: 'neuro-drugs', name: 'Neuropsychiatric & Autonomic Agents', questionCount: 50 },
    ],
  },
  {
    id: 'foundations',
    code: 'NUR 201',
    title: 'Foundations of Nursing',
    category: 'Core Competency',
    description: 'Nursing process, vital signs, aseptic technique, patient safety protocols, legal-ethical guidelines, and clinical documentation.',
    levels: [200, 300],
    totalQuestions: 290,
    masteryPercentage: 88,
    isHighYield: false,
    icon: 'foundations',
    topics: [
      { id: 'all', name: 'All Topics (Comprehensive)', questionCount: 290 },
      { id: 'vitals', name: 'Vital Signs & Health Assessment', questionCount: 70, highYield: true },
      { id: 'asepsis', name: 'Infection Prevention & Sterile Field', questionCount: 60, highYield: true },
      { id: 'nursing-process', name: 'The Nursing Process & Care Plans', questionCount: 55 },
      { id: 'safety', name: 'Patient Safety & Fall Prevention', questionCount: 50 },
      { id: 'med-admin', name: 'Principles of Medication Administration', questionCount: 55, highYield: true },
    ],
  },
  {
    id: 'mch',
    code: 'NUR 305',
    title: 'Maternal & Child Health Nursing',
    category: 'Specialized Care',
    description: 'Obstetrics, antepartum risk factors, intrapartum emergencies, neonatal resuscitation (APGAR), and pediatric development.',
    levels: [300, 400],
    totalQuestions: 310,
    masteryPercentage: 64,
    isHighYield: true,
    icon: 'mch',
    topics: [
      { id: 'all', name: 'All Topics (Comprehensive)', questionCount: 310, highYield: true },
      { id: 'antepartum', name: 'Antepartum Complications & Preeclampsia', questionCount: 70, highYield: true },
      { id: 'intrapartum', name: 'Labor Stages & Fetal Monitoring', questionCount: 65, highYield: true },
      { id: 'postpartum', name: 'Postpartum Hemorrhage & Infection', questionCount: 50 },
      { id: 'neonatal', name: 'Newborn Assessment & APGAR Scoring', questionCount: 60, highYield: true },
      { id: 'pediatrics', name: 'Pediatric Growth & Immunizations', questionCount: 65 },
    ],
  },
  {
    id: 'community',
    code: 'NUR 401',
    title: 'Community & Public Health',
    category: 'Public Health',
    description: 'Epidemiological surveillance, Primary Health Care (PHC), immunization schedules, maternal-child community outreach, and sanitation.',
    levels: [300, 400],
    totalQuestions: 220,
    masteryPercentage: 81,
    isHighYield: false,
    icon: 'community',
    topics: [
      { id: 'all', name: 'All Topics (Comprehensive)', questionCount: 220 },
      { id: 'phc', name: 'Primary Health Care & Alma-Ata Principles', questionCount: 60, highYield: true },
      { id: 'epidemiology', name: 'Epidemiology & Outbreak Investigation', questionCount: 55, highYield: true },
      { id: 'vaccines', name: 'Cold Chain & Universal Immunization', questionCount: 55 },
      { id: 'environmental', name: 'Environmental Sanitation & Vector Control', questionCount: 50 },
    ],
  },
  {
    id: 'mental',
    code: 'NUR 403',
    title: 'Mental Health & Psychiatric Nursing',
    category: 'Specialized Care',
    description: 'Psychiatric disorders, therapeutic communication, crisis de-escalation, mood disorders, schizophrenia, and psychopharmacology.',
    levels: [300, 400],
    totalQuestions: 195,
    masteryPercentage: 60,
    isHighYield: false,
    icon: 'mental',
    topics: [
      { id: 'all', name: 'All Topics (Comprehensive)', questionCount: 195 },
      { id: 'therapeutic-comm', name: 'Therapeutic Communication Techniques', questionCount: 50, highYield: true },
      { id: 'mood-disorders', name: 'Depression & Bipolar Spectrum', questionCount: 50, highYield: true },
      { id: 'psychosis', name: 'Schizophrenia & Hallucinations', questionCount: 45 },
      { id: 'substance-abuse', name: 'Substance Use Disorders & Detox', questionCount: 50 },
    ],
  },
]

const STORAGE_PRO_BANNER_KEY = 'nursingprep_pro_banner_dismissed'

// ============================================================================
// ICONS (Clean, High-Contrast SVG)
// ============================================================================

function StethoscopeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 3v5a5.5 5.5 0 0 0 11 0V3" />
      <path d="M4 3h1m14 0h1" />
      <path d="M10 13.5v3.25a3.25 3.25 0 0 0 6.5 0V15" />
      <circle cx="16.5" cy="14.5" r="2.5" />
    </svg>
  )
}

function PillIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </svg>
  )
}

function HeartPulseIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l1.5-3 2 6 1.5-3h6.28" />
    </svg>
  )
}

function BabyIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 12h.01M15 12h.01" />
      <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
      <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 19 6.3Z" />
      <path d="M12 3c-1.5 0-3 .5-3 1.5 0 1.5 2 2 3 2s3-.5 3-2c0-1-1.5-1.5-3-1.5Z" />
    </svg>
  )
}

function UsersIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function BrainIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04Z" />
    </svg>
  )
}

function FireIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3Z" />
    </svg>
  )
}

function ClockIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function SparklesIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </svg>
  )
}

function TrophyIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.45 1-1 1H7v4h10v-4h-2c-.55 0-1-.45-1-1v-2.34" />
      <path d="M6 4h12a2 2 0 0 1 2 2v3a6 6 0 0 1-12 0V6a2 2 0 0 1 2-2Z" />
    </svg>
  )
}

function PlayIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

function CheckCircleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function ArrowRightIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

function SettingsSlidersIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" x2="4" y1="21" y2="14" />
      <line x1="4" x2="4" y1="10" y2="3" />
      <line x1="12" x2="12" y1="21" y2="12" />
      <line x1="12" x2="12" y1="8" y2="3" />
      <line x1="20" x2="20" y1="21" y2="16" />
      <line x1="20" x2="20" y1="12" y2="3" />
      <line x1="1" x2="7" y1="14" y2="14" />
      <line x1="9" x2="15" y1="8" y2="8" />
      <line x1="17" x2="23" y1="16" y2="16" />
    </svg>
  )
}

function renderCourseIcon(type: string, className = 'w-5 h-5') {
  switch (type) {
    case 'pharm':
      return <PillIcon className={className} />
    case 'mch':
      return <BabyIcon className={className} />
    case 'community':
      return <UsersIcon className={className} />
    case 'mental':
      return <BrainIcon className={className} />
    case 'foundations':
      return <HeartPulseIcon className={className} />
    case 'medsurg':
    default:
      return <StethoscopeIcon className={className} />
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, level: authLevel, isActive, isAdmin, canTakeExam, submittedAttemptsCount, signOut } = useAuth()

  // 1. Level determination: default to user's auth level (100, 200, 300, 400) or fallback to 300
  const studentLevel = useMemo(() => {
    return authLevel && [100, 200, 300, 400].includes(authLevel) ? authLevel : 300
  }, [authLevel])

  // 2. Celebratory Pro Banner state: checks query param (?payment_success=true or ?unlocked=true) or state
  const [showProCelebration, setShowProCelebration] = useState(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search)
      const hasPaymentParam =
        searchParams.get('payment_success') === 'true' ||
        searchParams.get('unlocked') === 'true' ||
        searchParams.get('payment') === 'success'

      const hasStatePayment = Boolean(
        (location.state as { paymentSuccess?: boolean; unlocked?: boolean } | null)?.paymentSuccess
      )

      const isDismissed = sessionStorage.getItem(STORAGE_PRO_BANNER_KEY) === 'true'

      return (hasPaymentParam || hasStatePayment || (isActive && !isDismissed && false)) && !isDismissed
    } catch {
      return false
    }
  })

  // Dismiss celebratory banner
  const handleDismissCelebration = () => {
    setShowProCelebration(false)
    try {
      sessionStorage.setItem(STORAGE_PRO_BANNER_KEY, 'true')
      // Clean query params from URL without reloading
      const url = new URL(window.location.href)
      url.searchParams.delete('payment_success')
      url.searchParams.delete('unlocked')
      url.searchParams.delete('payment')
      window.history.replaceState({}, '', url.pathname)
    } catch {
      // Ignore
    }
  }

  // 3. Filter state for course catalog: default strictly to 'my_level'
  const [courseFilter, setCourseFilter] = useState<'my_level' | 'all' | 'high_yield'>('my_level')

  // Live database courses & question counts
  const [liveDbCourses, setLiveDbCourses] = useState<CourseItem[]>([])

  useEffect(() => {
    let active = true

    async function fetchLiveCourses() {
      try {
        // 1. Try high-performance security-definer RPC that aggregates real approved counts
        const { data: rpcCatalog, error: rpcErr } = await supabase.rpc('get_curriculum_catalog')

        if (!rpcErr && Array.isArray(rpcCatalog) && rpcCatalog.length > 0 && active) {
          const dynamicCourses: CourseItem[] = rpcCatalog.map((c: any) => {
            const levelNum = Number(c.level_code || 300)
            const topicItems: TopicItem[] = [
              { id: 'all', name: 'All Topics (Comprehensive)', questionCount: Number(c.total_questions) || 0 },
              ...(Array.isArray(c.topics)
                ? c.topics.map((t: any, i: number) => ({
                    id: `topic-${i}`,
                    name: t.name || 'General Topic',
                    questionCount: Number(t.count) || 0,
                  }))
                : []),
            ]

            return {
              id: c.id,
              code: c.code,
              title: c.title,
              category: 'Core Competency',
              description: c.description || 'Clinical assessment, diagnoses, and licensure preparation.',
              levels: [levelNum],
              totalQuestions: Number(c.total_questions) || 0,
              masteryPercentage: 0,
              isHighYield: Number(c.total_questions) > 30,
              icon: 'medsurg',
              topics: topicItems,
            }
          })

          setLiveDbCourses(dynamicCourses)
          return
        }

        // 2. Fallback direct table query if RPC is not yet executed in Supabase SQL editor
        const { data: coursesData, error: coursesErr } = await supabase
          .from('courses')
          .select('id, title, code, description, level_id, is_active, academic_levels(code)')
          .eq('is_active', true)
          .order('code')

        if (coursesErr) {
          console.warn('[Dashboard] Could not fetch live courses, keeping curriculum catalog:', coursesErr.message)
          return
        }

        if (coursesData && active) {
          // Fetch question counts per course
          const { data: qCounts } = await supabase
            .from('questions')
            .select('course_id, topic')
            .eq('status', 'approved')

          const countMap: Record<string, { count: number; topics: Set<string> }> = {}
          if (qCounts) {
            qCounts.forEach((q) => {
              if (!countMap[q.course_id]) {
                countMap[q.course_id] = { count: 0, topics: new Set() }
              }
              countMap[q.course_id].count++
              if (q.topic) countMap[q.course_id].topics.add(q.topic)
            })
          }

          const dynamicCourses: CourseItem[] = coursesData.map((c: any) => {
            const levelNum = Number(c.academic_levels?.code || 300)
            const stats = countMap[c.id] || { count: 0, topics: new Set<string>() }
            const topicList: TopicItem[] = [
              { id: 'all', name: 'All Topics (Comprehensive)', questionCount: stats.count },
              ...Array.from(stats.topics).map((tName, i) => ({
                id: `topic-${i}`,
                name: tName,
                questionCount: Math.round(stats.count / Math.max(1, stats.topics.size)),
              })),
            ]

            return {
              id: c.id,
              code: c.code,
              title: c.title,
              category: 'Core Competency',
              description: c.description || 'Clinical assessment, diagnoses, and licensure preparation.',
              levels: [levelNum],
              totalQuestions: stats.count,
              masteryPercentage: 0,
              isHighYield: stats.count > 30,
              icon: 'medsurg',
              topics: topicList,
            }
          })

          // Only replace if database returned active courses
          if (dynamicCourses.length > 0) {
            setLiveDbCourses(dynamicCourses)
          }
        }
      } catch (err) {
        console.warn('[Dashboard] Live courses fetch error:', err)
      }
    }

    void fetchLiveCourses()

    return () => {
      active = false
    }
  }, [])

  // Active courses list: live database courses if available, otherwise NURSING_COURSES
  const activeCourseList = useMemo(() => {
    return liveDbCourses.length > 0 ? liveDbCourses : NURSING_COURSES
  }, [liveDbCourses])

  // 4. Practice Setup Modal / Drawer State
  const [isSetupOpen, setIsSetupOpen] = useState(false)
  const [isCourseLocked, setIsCourseLocked] = useState(false)

  // 4b. Upcoming Timetable Spotlight (Fetched strictly for studentLevel)
  const [upcomingExams, setUpcomingExams] = useState<Array<{
    id: string
    course_id: string
    course_code: string
    course_title: string
    level_code: string
    exam_date: string
    paper_title: string
    venue: string
  }>>([])

  useEffect(() => {
    let active = true
    async function fetchUpcoming() {
      try {
        const { data, error } = await supabase.rpc('get_student_upcoming_exams')
        if (!error && Array.isArray(data) && active) {
          setUpcomingExams(data)
        }
      } catch (err) {
        console.warn('[Dashboard] Could not fetch upcoming timetable:', err)
      }
    }
    void fetchUpcoming()
    return () => {
      active = false
    }
  }, [studentLevel])

  const nextUpcomingExam = upcomingExams[0] || null

  // 4c. Review Session Drawer / Modal State
  const [selectedSessionForReview, setSelectedSessionForReview] = useState<PracticeSessionRecord | null>(null)
  const [sessionReviewLoading, setSessionReviewLoading] = useState(false)
  const [sessionReviewQuestions, setSessionReviewQuestions] = useState<any[]>([])

  const handleOpenSessionReview = async (sess: PracticeSessionRecord) => {
    setSelectedSessionForReview(sess)
    // Check if sess.id is a real database attempt UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sess.id)
    if (!isUuid) {
      setSessionReviewQuestions([])
      return
    }

    setSessionReviewLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_attempt_result', {
        p_attempt_id: sess.id,
      })
      if (!error && data && Array.isArray(data.results)) {
        setSessionReviewQuestions(data.results)
      } else {
        setSessionReviewQuestions([])
      }
    } catch (err) {
      console.warn('[Dashboard] Error fetching session details:', err)
      setSessionReviewQuestions([])
    } finally {
      setSessionReviewLoading(false)
    }
  }

  // Available courses strictly for student's registered level
  const availableLevelCourses = useMemo(() => {
    return activeCourseList.filter((c) => c.levels.includes(studentLevel))
  }, [activeCourseList, studentLevel])

  const [setupConfig, setSetupConfig] = useState<PracticeSetupConfig>({
    level: studentLevel,
    courseId: 'med-surg',
    topicId: 'all',
    mode: 'timed',
    difficulty: 'all',
    questionCount: 20,
  })

  // 5. Historical Sessions & Live Database Exam Attempts
  // Always initialize empty or load strictly from user-scoped key so a previous user's session history never leaks!
  const [sessions, setSessions] = useState<PracticeSessionRecord[]>(() => {
    try {
      if (user?.id) {
        const saved = localStorage.getItem(`nursingprep_session_history_${user.id}`)
        if (saved) {
          const parsed = JSON.parse(saved)
          if (Array.isArray(parsed)) return parsed
        }
      }
    } catch {
      // Ignore
    }
    return []
  })

  // Whenever the authenticated user changes, reset or reload user-scoped session history
  useEffect(() => {
    if (!user?.id) {
      setSessions([])
      return
    }
    try {
      const saved = localStorage.getItem(`nursingprep_session_history_${user.id}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) {
          setSessions(parsed)
          return
        }
      }
    } catch {
      // Ignore
    }
    setSessions([])
  }, [user?.id])

  // Live real database stats state
  const [dbStats, setDbStats] = useState<{
    completedAttempts: number
    totalQuestionsPracticed: number
    overallAccuracy: number
    studyStreak: number
    readinessScore: number
    courseMastery: Record<string, { totalPracticed: number; correctCount: number; percentage: number }>
    isLoading: boolean
  }>({
    completedAttempts: 0,
    totalQuestionsPracticed: 0,
    overallAccuracy: 0,
    studyStreak: 0,
    readinessScore: 0,
    courseMastery: {},
    isLoading: true,
  })

  // Fetch real exam stats: first try the optimized RPC, fallback to direct query
  useEffect(() => {
    let isMounted = true

    async function loadRealExamStats() {
      if (!user?.id) {
        if (isMounted) setDbStats((prev) => ({ ...prev, isLoading: false }))
        return
      }

      try {
        console.log('[Dashboard] Fetching exam stats for user:', user.id)

        // 1. Try our high-performance RPC function
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_student_dashboard_stats')

        if (rpcError) {
          console.warn('[Dashboard] RPC get_student_dashboard_stats notice:', rpcError.message)
        }

        if (!rpcError && rpcData && isMounted) {
          const stats = rpcData as {
            attempts_count: number
            total_questions: number
            overall_accuracy: number
            streak_days: number
            readiness_score: number
            recent_sessions: Array<{
              id: string
              score: number
              total: number
              percentage: number
              created_at: string
              submitted_at: string
            }>
          }

          console.log('[Dashboard] Received RPC stats:', stats)

          // Calculate per-course mastery from completed attempts or local sessions
          const masteryMap: Record<string, { totalPracticed: number; correctCount: number; percentage: number }> = {}

          // Use recent sessions (which have courseId & scores)
          const allSessionsList = Array.isArray(stats.recent_sessions) && stats.recent_sessions.length > 0
            ? sessions
            : sessions

          allSessionsList.forEach((sess) => {
            if (sess.courseId && sess.total > 0) {
              if (!masteryMap[sess.courseId]) {
                masteryMap[sess.courseId] = { totalPracticed: 0, correctCount: 0, percentage: 0 }
              }
              masteryMap[sess.courseId].totalPracticed += sess.total
              masteryMap[sess.courseId].correctCount += sess.score
              masteryMap[sess.courseId].percentage = Math.round(
                (masteryMap[sess.courseId].correctCount / masteryMap[sess.courseId].totalPracticed) * 100
              )
            }
          })

          setDbStats({
            completedAttempts: Number(stats.attempts_count) || 0,
            totalQuestionsPracticed: Number(stats.total_questions) || 0,
            overallAccuracy: Math.round(Number(stats.overall_accuracy) || 0),
            studyStreak: Number(stats.streak_days) || 0,
            readinessScore: Number(stats.readiness_score) || 0,
            courseMastery: masteryMap,
            isLoading: false,
          })

          // Update recent sessions if DB returned them
          if (Array.isArray(stats.recent_sessions) && stats.recent_sessions.length > 0) {
            const mappedSessions: PracticeSessionRecord[] = stats.recent_sessions.map((item, idx) => ({
              id: item.id || `db-sess-${idx}`,
              courseTitle: 'Nursing CBT Practice',
              courseId: 'general',
              topicTitle: `Session #${Number(stats.attempts_count) - idx}`,
              date: item.submitted_at
                ? new Date(item.submitted_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recent',
              score: item.score || 0,
              total: item.total || 0,
              percentage: item.percentage || 0,
              mode: 'timed',
              difficulty: 'all',
              status: (item.percentage || 0) >= 70 ? 'passed' : 'review',
            }))
            setSessions(mappedSessions)
          }
          return
        }

        // 2. Fallback to direct table query
        console.log('[Dashboard] Executing direct exam_attempts query for user:', user.id)
        const { data, error } = await supabase
          .from('exam_attempts')
          .select('id, score, total, created_at, submitted_at')
          .eq('user_id', user.id)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false })

        if (error) {
          console.error('[Dashboard] Error querying exam_attempts directly:', error)
          throw error
        }

        console.log('[Dashboard] Direct query attempts returned:', data)

        if (isMounted && data) {
          const count = data.length
          const totalQuestions = data.reduce((acc, row) => acc + (row.total || 0), 0)
          const totalScore = data.reduce((acc, row) => acc + (row.score || 0), 0)
          const accuracy = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0

          const uniqueDates = Array.from(
            new Set(
              data
                .map((row) => (row.submitted_at ? new Date(row.submitted_at).toISOString().split('T')[0] : ''))
                .filter(Boolean)
            )
          )

          let streak = 0
          if (uniqueDates.length > 0) {
            const todayStr = new Date().toISOString().split('T')[0]
            const yesterdayDate = new Date()
            yesterdayDate.setDate(yesterdayDate.getDate() - 1)
            const yesterdayStr = yesterdayDate.toISOString().split('T')[0]

            if (uniqueDates.includes(todayStr) || uniqueDates.includes(yesterdayStr)) {
              streak = 1
              let checkDate = uniqueDates.includes(todayStr) ? new Date() : yesterdayDate
              for (let i = 1; i < uniqueDates.length; i++) {
                checkDate.setDate(checkDate.getDate() - 1)
                const expectedStr = checkDate.toISOString().split('T')[0]
                if (uniqueDates.includes(expectedStr)) {
                  streak++
                } else {
                  break
                }
              }
            }
          }

          const volumeMilestone = Math.min(100, Math.round((totalQuestions / 150) * 100))
          const readiness = totalQuestions > 0
            ? Math.round(accuracy * 0.7 + volumeMilestone * 0.3)
            : 0

          const mappedDirect: PracticeSessionRecord[] = data.slice(0, 5).map((row, idx) => ({
            id: row.id,
            courseTitle: 'Nursing CBT Practice',
            courseId: 'general',
            topicTitle: `Session #${count - idx}`,
            date: row.submitted_at
              ? new Date(row.submitted_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Recent',
            score: row.score || 0,
            total: row.total || 0,
            percentage: row.total ? Math.round(((row.score || 0) / row.total) * 100) : 0,
            mode: 'timed',
            difficulty: 'all',
            status: ((row.score || 0) / (row.total || 1)) >= 0.7 ? 'passed' : 'review',
          }))
          setSessions(mappedDirect)

          // Calculate mastery for direct query fallback
          const directMastery: Record<string, { totalPracticed: number; correctCount: number; percentage: number }> = {}
          const sourceSessions = sessions.length > 0 ? sessions : mappedDirect
          sourceSessions.forEach((sess) => {
            if (sess.courseId && sess.total > 0) {
              if (!directMastery[sess.courseId]) {
                directMastery[sess.courseId] = { totalPracticed: 0, correctCount: 0, percentage: 0 }
              }
              directMastery[sess.courseId].totalPracticed += sess.total
              directMastery[sess.courseId].correctCount += sess.score
              directMastery[sess.courseId].percentage = Math.round(
                (directMastery[sess.courseId].correctCount / directMastery[sess.courseId].totalPracticed) * 100
              )
            }
          })

          setDbStats({
            completedAttempts: count,
            totalQuestionsPracticed: totalQuestions,
            overallAccuracy: accuracy,
            studyStreak: streak,
            readinessScore: readiness,
            courseMastery: directMastery,
            isLoading: false,
          })
        }
      } catch (err) {
        console.error('[Dashboard] Critical error in loadRealExamStats:', err)
        if (isMounted) setDbStats((prev) => ({ ...prev, isLoading: false }))
      }
    }

    void loadRealExamStats()

    // Also reload stats whenever page gains focus (e.g. returning from exam)
    const handleFocus = () => {
      void loadRealExamStats()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      isMounted = false
      window.removeEventListener('focus', handleFocus)
    }
  }, [user?.id])

  // Synchronize config level if auth level changes
  useEffect(() => {
    setSetupConfig((prev) => ({
      ...prev,
      level: studentLevel,
    }))
  }, [studentLevel])

  // Save session list to user-scoped localStorage whenever changed
  useEffect(() => {
    if (!user?.id) return
    try {
      localStorage.setItem(`nursingprep_session_history_${user.id}`, JSON.stringify(sessions))
    } catch {
      // Ignore storage errors
    }
  }, [sessions, user?.id])

  // Sign out handler
  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  // Open Practice Setup modal directly configured for target course or generic practice
  const handleOpenSetup = (courseId?: string) => {
    // If courseId provided (from "Practice Course" button on card), lock that course
    // If no courseId (from top "Configure Practice" button), allow course selection among student's level courses
    const targetCourse = courseId
      ? activeCourseList.find((c) => c.id === courseId) || availableLevelCourses[0]
      : activeCourseList.find((c) => c.id === setupConfig.courseId) || availableLevelCourses[0]

    if (targetCourse) {
      setSetupConfig((prev) => ({
        ...prev,
        level: studentLevel,
        courseId: targetCourse.id,
        topicId: 'all',
      }))
    }
    setIsCourseLocked(Boolean(courseId))
    setIsSetupOpen(true)
  }

  // Launch session directly or from setup
  const handleStartSession = (customOverride?: Partial<PracticeSetupConfig>) => {
    if (!canTakeExam) {
      toast.error('Free trial exam completed. Activate Pro to unlock unlimited exam practice!')
      navigate('/pay')
      return
    }

    const finalConfig = { ...setupConfig, ...(customOverride || {}) }
    const selectedCourse = activeCourseList.find((c) => c.id === finalConfig.courseId) || activeCourseList[0] || NURSING_COURSES[0]
    const selectedTopic =
      selectedCourse.topics?.find((t) => t.id === finalConfig.topicId)?.name || 'All Topics'

    // Note: Do NOT add fake/unsubmitted sessions to recent history here!
    // History is strictly populated when an exam is actually completed & submitted.
    setIsSetupOpen(false)
    toast.success(`Starting ${finalConfig.questionCount}-question ${finalConfig.mode === 'timed' ? 'timed CBT exam' : 'tutor practice'}!`)

    // Navigate to exam with both state and query params
    navigate(`/app/exam?course=${encodeURIComponent(selectedCourse.title)}&courseId=${encodeURIComponent(selectedCourse.id)}&count=${finalConfig.questionCount}&mode=${finalConfig.mode}`, {
      state: {
        course: selectedCourse.title,
        courseId: selectedCourse.id,
        topic: selectedTopic,
        count: finalConfig.questionCount,
        mode: finalConfig.mode,
        difficulty: finalConfig.difficulty,
        level: finalConfig.level,
      },
    })
  }

  // Quick launch default standard CBT exam or targeted next-exam free trial
  const handleQuickStandardExam = () => {
    // If not active (free trial), target the next upcoming exam on their timetable if scheduled!
    let targetCourse = availableLevelCourses[0] || activeCourseList[0]

    if (!isActive && nextUpcomingExam) {
      const timetableCourse = activeCourseList.find(
        (c) => c.id === nextUpcomingExam.course_id || c.code === nextUpcomingExam.course_code
      )
      if (timetableCourse) {
        targetCourse = timetableCourse
      }
    }

    handleStartSession({
      courseId: targetCourse?.id || 'med-surg',
      topicId: 'all',
      mode: 'timed',
      questionCount: isActive ? 20 : 25,
    })
  }

  // Retake a specific past session
  const handleRetakeSession = (sess: PracticeSessionRecord) => {
    handleStartSession({
      courseId: sess.courseId,
      mode: sess.mode,
      difficulty: sess.difficulty,
      questionCount: sess.total,
    })
  }

  // Selected course object inside setup drawer
  const currentSetupCourse = useMemo(() => {
    return activeCourseList.find((c) => c.id === setupConfig.courseId) || activeCourseList[0] || NURSING_COURSES[0]
  }, [activeCourseList, setupConfig.courseId])

  // Filtered courses based on tab - strictly prioritizes student's level, pinning next upcoming exam if present
  const filteredCourses = useMemo(() => {
    let baseList: CourseItem[] = []
    if (courseFilter === 'high_yield') {
      baseList = activeCourseList.filter((c) => c.levels.includes(studentLevel) && c.isHighYield)
    } else if (courseFilter === 'all') {
      baseList = activeCourseList
    } else {
      // Default & primary view: strictly show courses for the student's level
      baseList = activeCourseList.filter((c) => c.levels.includes(studentLevel))
    }

    // If an upcoming exam is scheduled on timetable, pin it subtly to the top (#1 spot)
    if (nextUpcomingExam && courseFilter === 'my_level') {
      const idx = baseList.findIndex((c) => c.id === nextUpcomingExam.course_id || c.code === nextUpcomingExam.course_code)
      if (idx > 0) {
        const pinned = baseList[idx]
        const remaining = baseList.filter((_, i) => i !== idx)
        return [pinned, ...remaining]
      }
    }

    return baseList
  }, [activeCourseList, courseFilter, studentLevel, nextUpcomingExam])

  // Stats calculation
  const totalAnswered = useMemo(() => {
    return sessions.reduce((acc, s) => acc + (s.total || 0), 0)
  }, [sessions])

  const averageAccuracy = useMemo(() => {
    const scored = sessions.filter((s) => s.percentage > 0)
    if (scored.length === 0) return 0
    const totalPct = scored.reduce((acc, s) => acc + s.percentage, 0)
    return Math.round(totalPct / scored.length)
  }, [sessions])

  // Focus trap for Practice Setup Modal
  const modalHeadingRef = useRef<HTMLHeadingElement>(null)
  const setupModalRef = useFocusTrap<HTMLDivElement>({
    active: isSetupOpen,
    onClose: () => setIsSetupOpen(false),
    initialFocusRef: modalHeadingRef,
  })

  // Display student name
  const studentGreeting = useMemo(() => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name as string
    }
    if (user?.email) {
      const emailPrefix = user.email.split('@')[0]
      return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1)
    }
    return 'Student Nurse'
  }, [user])

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/20">
      {/* ==================================================================== */}
      {/* TOP CLINICAL HEADER BAR */}
      {/* ==================================================================== */}
      <header className="border-b border-border bg-surface/95 backdrop-blur-md sticky top-0 z-30 pt-safe">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link to="/app" className="flex items-center gap-2.5 group">
              <img
                src="/logo.jpg"
                alt="NursingPrep Logo"
                className="w-9 h-9 rounded-xl object-cover border border-border shadow-xs motion-safe:transition-transform group-hover:scale-105"
              />
              <div className="flex flex-col">
                <span className="font-extrabold text-base tracking-tight leading-none">
                  Nursing<strong className="text-accent font-extrabold">Prep</strong>
                </span>
                <span className="text-[10px] text-muted font-bold tracking-wider uppercase mt-0.5">
                  Level {studentLevel}
                </span>
              </div>
            </Link>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Pro Status Pill - only shown when user actually has an active subscription */}
            {isActive && (
              <div
                className="h-8 inline-flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-bold border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                title="Your full clinical membership is active"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">Pro</span>
              </div>
            )}

            {/* Admin link if user is admin */}
            {isAdmin && (
              <Link
                to="/admin"
                className="h-8 text-xs font-bold text-accent hover:bg-accent/10 hidden md:inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-accent/20 bg-accent/5 transition-colors"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </Link>
            )}

            {/* Light/Dark Mode Switcher */}
            <ThemeToggle />

            {/* Leaderboard Link */}
            <Link
              to="/app/leaderboard"
              aria-label="Cohort Leaderboard"
              className="h-8 border border-border hover:border-accent bg-bg/60 hover:bg-surface text-text px-2.5 text-xs font-semibold rounded-lg motion-safe:transition-all motion-safe:active:scale-[0.98] inline-flex items-center gap-1.5"
            >
              <Trophy className="w-3.5 h-3.5 text-accent" />
              <span className="hidden sm:inline">Leaderboard</span>
            </Link>

            {/* Compact Profile Link */}
            <Link
              to="/app/profile"
              aria-label="Profile and Settings"
              className="h-8 border border-border hover:border-accent bg-bg/60 hover:bg-surface text-text px-2.5 text-xs font-semibold rounded-lg motion-safe:transition-all motion-safe:active:scale-[0.98] inline-flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-muted" />
              <span className="hidden sm:inline">Profile</span>
            </Link>

            {/* Compact Sign Out Button */}
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="h-8 border border-border hover:border-rose-500/40 hover:text-rose-500 bg-bg/60 hover:bg-surface text-muted px-2.5 text-xs font-semibold rounded-lg motion-safe:transition-all motion-safe:active:scale-[0.98] inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* FREE TRIAL / PRO STATUS BANNER */}
      {/* ==================================================================== */}
      {!isActive && (
        <div className="border-b border-border bg-accent/10 text-text">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xl">🎁</span>
              <div>
                <p className="text-xs sm:text-sm font-bold">
                  {submittedAttemptsCount === 0
                    ? 'Free Trial Active: You have 1 full practice exam drill available across any course.'
                    : 'Free Trial Completed: Activate Pro membership to unlock unlimited exams & rationales.'}
                </p>
                <p className="text-[11px] text-muted">
                  {submittedAttemptsCount === 0
                    ? 'Configure your questions and test the timed CBT platform before activating Pro.'
                    : 'Get unlimited access to all 200L–400L clinical modules and active recall flashcards.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => (submittedAttemptsCount === 0 ? handleOpenSetup() : navigate('/pay'))}
              className="bg-primary text-on-primary text-xs font-bold px-3.5 py-1.5 rounded-lg hover:opacity-90 shrink-0 self-end sm:self-center transition"
            >
              {submittedAttemptsCount === 0 ? 'Start Free Trial Exam' : 'Activate Pro (₦1,050)'}
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CELEBRATORY PRO ACCESS UNLOCKED BANNER */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {showProCelebration && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-border bg-emerald-500/15 text-text overflow-hidden"
          >
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <SparklesIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold tracking-tight flex items-center gap-2">
                    <span>🎉 Pro Access Unlocked!</span>
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                      Full Access
                    </span>
                  </h2>
                  <p className="text-xs sm:text-sm text-muted">
                    Welcome to the full Clinical Command Center. All Level 200, 300, and 400 modules, timed CBT simulations, and verified rationales are ready.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    handleDismissCelebration()
                    handleOpenSetup()
                  }}
                  className="bg-primary text-on-primary text-xs font-bold px-3.5 py-1.5 rounded-lg hover:opacity-90 motion-safe:transition-transform motion-safe:active:scale-95"
                >
                  Start Practicing
                </button>
                <button
                  type="button"
                  onClick={handleDismissCelebration}
                  aria-label="Dismiss announcement"
                  className="text-xs font-semibold px-2 py-1.5 rounded-lg border border-border bg-surface/60 hover:bg-surface text-muted hover:text-text"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* MAIN DASHBOARD CONTENT */}
      {/* ==================================================================== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ------------------------------------------------------------------ */}
        {/* HERO COMMAND CENTER BANNER */}
        {/* ------------------------------------------------------------------ */}
        <section className="border border-border bg-surface p-6 sm:p-8 rounded-3xl relative overflow-hidden shadow-xs">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] uppercase font-black tracking-widest text-accent">
                  Command Center
                </span>
                <span className="text-muted text-xs">•</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md bg-bg border border-border">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                  Level {studentLevel} Curriculum
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
                Welcome back, {studentGreeting}
              </h1>
              <p className="text-sm sm:text-base text-muted leading-relaxed">
                Step into today's clinical drill. Sharpen your clinical reasoning with timed CBT exam blocks or targeted high-yield course practice.
              </p>

              {/* Minimal Next Exam Spotlight Pill (Only shown if an upcoming exam exists) */}
              {nextUpcomingExam && (
                <div className="pt-2">
                  <div className="inline-flex flex-wrap items-center gap-2 p-2 px-3 rounded-xl bg-accent/10 border border-accent/20 text-xs">
                    <span className="font-black text-accent uppercase tracking-wider text-[10px] inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>Next Exam:</span>
                    </span>
                    <strong className="text-text font-bold">
                      {nextUpcomingExam.course_code}
                    </strong>
                    <span className="text-muted">•</span>
                    <span className="text-muted">
                      {new Date(nextUpcomingExam.exam_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })} at {new Date(nextUpcomingExam.exam_date).toLocaleTimeString(undefined, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenSetup(nextUpcomingExam.course_id)}
                      className="ml-auto text-[11px] font-bold text-accent hover:underline inline-flex items-center gap-0.5"
                    >
                      <span>Drill Course</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleQuickStandardExam}
                className="inline-flex items-center justify-center gap-2 bg-primary text-on-primary px-6 py-3 text-sm font-bold rounded-xl hover:opacity-95 shadow-xs motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <PlayIcon className="w-4 h-4" />
                <span>
                  {!isActive && nextUpcomingExam
                    ? `Start Free Trial: ${nextUpcomingExam.course_code} (25 Qs)`
                    : !isActive
                    ? 'Start Free Trial Exam (25 Qs)'
                    : 'Start Practice Exam (20 Qs)'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenSetup()}
                className="inline-flex items-center justify-center gap-2 border border-border hover:border-accent bg-bg text-text px-4 py-3 text-sm font-bold rounded-xl motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <SettingsSlidersIcon className="w-4 h-4 text-accent" />
                <span>Custom Drill</span>
              </button>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* STATS & STUDY STREAK OVERVIEW (DYNAMIC WITH REAL DB DATA FALLBACK) */}
        {/* ------------------------------------------------------------------ */}
        <section aria-label="Student Performance Stats" className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Study Streak */}
          <div className="border border-border bg-surface p-4 sm:p-5 rounded-2xl flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Study Streak</span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <FireIcon className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums">
                {dbStats.completedAttempts > 0
                  ? `${dbStats.studyStreak} ${dbStats.studyStreak === 1 ? 'Day' : 'Days'}`
                  : sessions.length > 0
                  ? '1 Day'
                  : '0 Days'}
              </div>
              <p className="text-xs text-muted mt-0.5">
                {dbStats.studyStreak > 0 || sessions.length > 0
                  ? 'Consecutive daily study'
                  : 'Study today to start streak'}
              </p>
            </div>
          </div>

          {/* Card 2: Completed Sessions */}
          <div className="border border-border bg-surface p-4 sm:p-5 rounded-2xl flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Sessions</span>
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                <ClockIcon className="w-4 h-4 text-sky-600" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums">
                {dbStats.completedAttempts > 0 ? dbStats.completedAttempts : sessions.length}
              </div>
              <p className="text-xs text-muted mt-0.5">Completed CBT runs</p>
            </div>
          </div>

          {/* Card 3: Overall Accuracy */}
          <div className="border border-border bg-surface p-4 sm:p-5 rounded-2xl flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Accuracy</span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <TrophyIcon className="w-4 h-4" />
              </div>
            </div>
            <div>
              {dbStats.completedAttempts > 0 || sessions.length > 0 ? (
                <>
                  <div className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${
                    (dbStats.completedAttempts > 0 ? dbStats.overallAccuracy : averageAccuracy) >= 75
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}>
                    {dbStats.completedAttempts > 0 ? dbStats.overallAccuracy : averageAccuracy}%
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {(dbStats.completedAttempts > 0 ? dbStats.overallAccuracy : averageAccuracy) >= 75
                      ? 'High pass probability'
                      : 'Target pass mark: 75%'}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-2xl sm:text-3xl font-black tracking-tight text-muted tabular-nums">
                    --
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Take first exam to establish score
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Card 4: Total Questions Answered */}
          <div className="border border-border bg-surface p-4 sm:p-5 rounded-2xl flex flex-col justify-between space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Questions</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <CheckCircleIcon className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums">
                {dbStats.completedAttempts > 0 ? dbStats.totalQuestionsPracticed : totalAnswered}
              </div>
              <p className="text-xs text-muted mt-0.5">Total curriculum questions answered</p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* COURSE CARDS GRID */}
        {/* ------------------------------------------------------------------ */}
        <section aria-labelledby="courses-heading" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 id="courses-heading" className="text-xl sm:text-2xl font-black tracking-tight">
                Curriculum Courses
              </h2>
              <p className="text-xs sm:text-sm text-muted">
                Select any clinical domain to practice focused topics or take a timed course exam.
              </p>
            </div>

            {/* Filter Pills with Horizontal Swipe on Mobile */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface border border-border overflow-x-auto max-w-full scrollbar-none touch-pan-x shrink-0">
              <button
                type="button"
                onClick={() => setCourseFilter('my_level')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                  courseFilter === 'my_level'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                Level {studentLevel} Courses ({activeCourseList.filter((c) => c.levels.includes(studentLevel)).length})
              </button>
              <button
                type="button"
                onClick={() => setCourseFilter('high_yield')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                  courseFilter === 'high_yield'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                High Yield 🔥
              </button>
              <button
                type="button"
                onClick={() => setCourseFilter('all')}
                className={`px-3.5 py-2 text-xs font-bold rounded-xl whitespace-nowrap transition-all ${
                  courseFilter === 'all'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                All Levels ({activeCourseList.length})
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredCourses.map((course) => {
              const isRecommendedForLevel = course.levels.includes(studentLevel)

              return (
                <div
                  key={course.id}
                  className="border border-border bg-surface rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5 hover:border-accent/40 motion-safe:transition-all group shadow-xs"
                >
                  <div className="space-y-4">
                    {/* Course Header Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-bg border border-border text-primary flex items-center justify-center shrink-0 group-hover:scale-105 motion-safe:transition-transform">
                          {renderCourseIcon(course.icon)}
                        </div>
                        <div>
                          <span className="text-xs font-black tracking-wider uppercase text-accent block">
                            {course.code}
                          </span>
                          <span className="text-[11px] text-muted font-medium">
                            {course.category}
                          </span>
                        </div>
                      </div>

                      {/* Level Badges */}
                      <div className="flex items-center gap-1">
                        {nextUpcomingExam && (nextUpcomingExam.course_id === course.id || nextUpcomingExam.course_code === course.code) && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-accent text-on-accent animate-pulse">
                            Next Paper
                          </span>
                        )}
                        {course.isHighYield && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                            High Yield
                          </span>
                        )}
                        {isRecommendedForLevel && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                            Level {studentLevel}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div className="space-y-1.5">
                      <h3 className="font-extrabold text-base sm:text-lg tracking-tight group-hover:text-accent motion-safe:transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted leading-relaxed line-clamp-2">
                        {course.description}
                      </p>
                    </div>

                    {/* Question & Topic Metrics */}
                    {(() => {
                      const dynamicMastery = dbStats.courseMastery[course.id]
                      const masteryPct = dynamicMastery && dynamicMastery.totalPracticed > 0
                        ? dynamicMastery.percentage
                        : 0

                      return (
                        <>
                          <div className="flex items-center justify-between text-xs font-semibold py-2 px-3 rounded-xl bg-bg border border-border/80">
                            <span className="text-muted">
                              <strong className="text-text font-bold">{course.topics.length - 1}</strong> Topics
                            </span>
                            <span className="text-border">•</span>
                            <span className="text-muted">
                              <strong className="text-text font-bold">{course.totalQuestions}</strong> Questions
                            </span>
                            <span className="text-border">•</span>
                            <span className={`font-bold tabular-nums ${
                              masteryPct >= 75
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : masteryPct > 0
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-muted'
                            }`}>
                              {masteryPct > 0 ? `${masteryPct}% Mastered` : 'Not Started'}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1">
                            <div className="w-full h-1.5 rounded-full bg-bg overflow-hidden">
                              <div
                                className={`h-full rounded-full motion-safe:transition-all duration-500 ${
                                  masteryPct >= 75
                                    ? 'bg-emerald-500'
                                    : masteryPct > 0
                                    ? 'bg-amber-500'
                                    : 'bg-border'
                                }`}
                                style={{ width: `${Math.max(masteryPct > 0 ? masteryPct : 0, 0)}%` }}
                              />
                            </div>
                          </div>
                        </>
                      )
                    })()}
                  </div>

                  {/* Action */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenSetup(course.id)}
                      className="w-full bg-primary text-on-primary py-2.5 px-3 text-xs sm:text-sm font-bold rounded-xl hover:opacity-95 shadow-xs motion-safe:transition-transform motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary inline-flex items-center justify-center gap-1.5"
                    >
                      <span>Practice Course</span>
                      <ArrowRightIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* RECENT SESSIONS HISTORY */}
        {/* ------------------------------------------------------------------ */}
        <section aria-labelledby="history-heading" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 id="history-heading" className="text-xl sm:text-2xl font-black tracking-tight">
                Recent Practice Sessions
              </h2>
              <p className="text-xs sm:text-sm text-muted">
                Review past performance, study rationales, or retake exam blocks.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenSetup()}
              className="text-xs sm:text-sm font-bold text-accent hover:underline inline-flex items-center gap-1"
            >
              <span>New Session</span>
              <ArrowRightIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block border border-border bg-surface rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg/50 text-xs font-bold text-muted uppercase tracking-wider">
                  <th scope="col" className="py-3.5 px-4 sm:px-6">Course & Topic</th>
                  <th scope="col" className="py-3.5 px-4">Date</th>
                  <th scope="col" className="py-3.5 px-4">Mode</th>
                  <th scope="col" className="py-3.5 px-4 text-center">Score</th>
                  <th scope="col" className="py-3.5 px-4 text-center">Accuracy</th>
                  <th scope="col" className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((sess) => {
                  const isPassing = sess.percentage >= 70

                  return (
                    <tr
                      key={sess.id}
                      onClick={() => handleOpenSessionReview(sess)}
                      className="hover:bg-bg/60 cursor-pointer motion-safe:transition-colors group"
                      title="Click to view detailed score breakdown and solution review"
                    >
                      <td className="py-4 px-4 sm:px-6">
                        <div className="font-bold text-text group-hover:text-accent transition-colors flex items-center gap-1.5">
                          <span>{sess.courseTitle}</span>
                          <span className="text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            <span>Review</span>
                          </span>
                        </div>
                        <div className="text-xs text-muted">{sess.topicTitle}</div>
                      </td>
                      <td className="py-4 px-4 text-xs text-muted whitespace-nowrap">
                        {sess.date}
                      </td>
                      <td className="py-4 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          sess.mode === 'timed'
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'bg-accent/10 text-accent border border-accent/20'
                        }`}>
                          {sess.mode === 'timed' ? '⏱️ Timed CBT' : '💡 Tutor Mode'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-text">
                        {sess.score} / {sess.total}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-extrabold ${
                          isPassing
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-accent/15 text-accent border border-accent/30'
                        }`}>
                          {sess.percentage}%
                        </span>
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => handleRetakeSession(sess)}
                          aria-label={`Retake ${sess.courseTitle}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-accent border border-border hover:border-accent bg-bg px-3 py-1.5 rounded-lg motion-safe:transition-all"
                        >
                          <PlayIcon className="w-3 h-3" />
                          <span>Retake</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (< sm breakpoint) */}
          <div className="sm:hidden space-y-3 pb-20">
            {sessions.map((sess) => {
              const isPassing = sess.percentage >= 70

              return (
                <div
                  key={sess.id}
                  onClick={() => handleOpenSessionReview(sess)}
                  className="border border-border bg-surface p-4 rounded-xl space-y-3 shadow-xs hover:border-accent/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-text flex items-center gap-1.5">
                        <span>{sess.courseTitle}</span>
                        <span className="text-[10px] text-accent">👁️</span>
                      </h3>
                      <p className="text-xs text-muted">{sess.topicTitle}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                      isPassing
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-accent/15 text-accent border border-accent/30'
                    }`}>
                      {sess.percentage}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-border/80">
                    <span>{sess.date}</span>
                    <span className="font-semibold">{sess.mode === 'timed' ? '⏱️ Timed CBT' : '💡 Tutor'}</span>
                    <span className="font-bold text-text">{sess.score}/{sess.total} Qs</span>
                  </div>

                  <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleOpenSessionReview(sess)}
                      className="flex-1 py-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 text-xs font-bold rounded-lg text-center motion-safe:transition-colors"
                    >
                      View Review
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRetakeSession(sess)}
                      className="flex-1 py-2 bg-bg border border-border hover:border-accent text-xs font-bold rounded-lg text-center motion-safe:transition-colors"
                    >
                      Retake
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* DASHBOARD FOOTER (REQUEST COURSES & SUPPORT) */}
        {/* ------------------------------------------------------------------ */}
        <footer className="border-t border-border pt-8 pb-24 sm:pb-12 text-sm text-muted">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src="/logo.jpg" alt="Logo" className="w-5 h-5 rounded-md object-cover" />
              <span className="font-bold text-xs uppercase tracking-wider text-text">NursingPrep Curriculum</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-medium">
              <a
                href="mailto:codemaverick20@gmail.com?subject=Request%20More%20Courses"
                className="hover:text-accent transition flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface"
              >
                <span>📚 Request More Courses</span>
              </a>
              <a
                href="mailto:codemaverick20@gmail.com?subject=Need%20Support"
                className="hover:text-accent transition flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface"
              >
                <span>💬 Need Support</span>
              </a>
            </div>
          </div>
        </footer>
      </main>

      {/* ==================================================================== */}
      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {/* ==================================================================== */}
      <MobileBottomNav />

      {/* ==================================================================== */}
      {/* PRACTICE SETUP MODAL / DRAWER */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isSetupOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSetupOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />

            {/* Modal Dialog Container */}
            <motion.div
              ref={setupModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="practice-setup-title"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-xl bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
                <div className="space-y-1">
                  <span className="text-[11px] uppercase font-black tracking-widest text-accent">
                    Session Configuration
                  </span>
                  <h2 id="practice-setup-title" ref={modalHeadingRef} className="text-2xl font-extrabold tracking-tight">
                    Practice Setup
                  </h2>
                  <p className="text-xs sm:text-sm text-muted">
                    Tailor your examination level, course topic, test mode, and question volume.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSetupOpen(false)}
                  aria-label="Close practice setup"
                  className="p-2 rounded-xl border border-border hover:border-accent bg-bg text-text motion-safe:transition-all"
                >
                  ✕
                </button>
              </div>

              {/* Form Controls */}
              <div className="space-y-5">
                {/* 1. Course Selection (Only if clicking top "Configure Practice", otherwise locked to selected course) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="course-select" className="text-xs font-bold uppercase tracking-wider text-muted block">
                      Course Selection
                    </label>
                    <span className="text-[11px] font-bold text-accent">
                      Level {studentLevel}
                    </span>
                  </div>

                  {isCourseLocked ? (
                    <div className="p-3.5 rounded-xl border border-border bg-bg/60 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-surface border border-border text-primary flex items-center justify-center font-bold text-xs">
                          {currentSetupCourse.code.split(' ')[0]}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-text">
                            {currentSetupCourse.code} — {currentSetupCourse.title}
                          </div>
                          <div className="text-xs text-muted">
                            {currentSetupCourse.topics.length - 1} topics available
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                        Selected
                      </span>
                    </div>
                  ) : (
                    <select
                      id="course-select"
                      value={setupConfig.courseId}
                      onChange={(e) => {
                        setSetupConfig((prev) => ({
                          ...prev,
                          courseId: e.target.value,
                          topicId: 'all',
                        }))
                      }}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary motion-safe:transition-all"
                    >
                      {availableLevelCourses.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.code} — {course.title} ({course.totalQuestions} Questions)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 2. Topic Selector */}
                <div className="space-y-2">
                  <label htmlFor="topic-select" className="text-xs font-bold uppercase tracking-wider text-muted block">
                    Focus Topic
                  </label>
                  <select
                    id="topic-select"
                    value={setupConfig.topicId}
                    onChange={(e) => setSetupConfig((prev) => ({ ...prev, topicId: e.target.value }))}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary motion-safe:transition-all"
                  >
                    {currentSetupCourse.topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.questionCount} Qs) {t.highYield ? '🔥' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Mode Selector */}
                <div className="space-y-2">
                  <label htmlFor="mode-options" className="text-xs font-bold uppercase tracking-wider text-muted block">
                    Practice Mode
                  </label>
                  <div id="mode-options" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSetupConfig((prev) => ({ ...prev, mode: 'timed' }))}
                      className={`p-3.5 rounded-xl border text-left flex items-start gap-3 motion-safe:transition-all ${
                        setupConfig.mode === 'timed'
                          ? 'border-primary bg-primary/10 shadow-xs'
                          : 'border-border bg-bg hover:border-accent'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${setupConfig.mode === 'timed' ? 'bg-primary text-on-primary' : 'bg-surface text-muted'}`}>
                        <ClockIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-text">Timed CBT Exam</div>
                        <div className="text-xs text-muted leading-tight mt-0.5">
                          Simulates exam countdown with score report at end.
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSetupConfig((prev) => ({ ...prev, mode: 'tutor' }))}
                      className={`p-3.5 rounded-xl border text-left flex items-start gap-3 motion-safe:transition-all ${
                        setupConfig.mode === 'tutor'
                          ? 'border-primary bg-primary/10 shadow-xs'
                          : 'border-border bg-bg hover:border-accent'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${setupConfig.mode === 'tutor' ? 'bg-primary text-on-primary' : 'bg-surface text-muted'}`}>
                        <SparklesIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-text">Practice & Tutor</div>
                        <div className="text-xs text-muted leading-tight mt-0.5">
                          Untimed with instant rationales after each selection.
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 4. Question Count & Difficulty */}
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label htmlFor="count-selector" className="text-xs font-bold uppercase tracking-wider text-muted block">
                        Question Volume
                      </label>
                      <span className="text-[11px] text-muted">
                        Full licensure CBT exam is 100 Qs
                      </span>
                    </div>
                    <div id="count-selector" className="grid grid-cols-4 gap-2">
                      {[10, 20, 50, 100].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setSetupConfig((prev) => ({ ...prev, questionCount: cnt }))}
                          className={`py-3 px-2 rounded-xl border text-xs sm:text-sm font-black motion-safe:transition-all flex flex-col items-center justify-center gap-0.5 ${
                            setupConfig.questionCount === cnt
                              ? 'bg-primary text-on-primary border-primary shadow-xs'
                              : 'bg-bg border-border text-muted hover:text-text hover:border-accent'
                          }`}
                        >
                          <span>{cnt} Qs</span>
                          <span className="text-[10px] font-normal opacity-75">
                            {cnt === 10 ? 'Drill' : cnt === 20 ? 'Standard' : cnt === 50 ? 'Half Mock' : 'Full Mock'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <label htmlFor="diff-select" className="text-xs font-bold uppercase tracking-wider text-muted block">
                      Difficulty Level
                    </label>
                    <select
                      id="diff-select"
                      value={setupConfig.difficulty}
                      onChange={(e) =>
                        setSetupConfig((prev) => ({
                          ...prev,
                          difficulty: e.target.value as PracticeSetupConfig['difficulty'],
                        }))
                      }
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="all">All Difficulties (Balanced)</option>
                      <option value="easy">Easy (Foundational Recall)</option>
                      <option value="medium">Medium (Clinical Application)</option>
                      <option value="hard">Hard (Licensure Scenario)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleStartSession()}
                  className="w-full sm:flex-1 bg-primary text-on-primary py-3.5 px-6 text-sm font-extrabold rounded-xl hover:opacity-95 shadow-md motion-safe:transition-transform motion-safe:active:scale-[0.98] inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span>Start Practice Session ({setupConfig.questionCount} Questions)</span>
                  <ArrowRightIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsSetupOpen(false)}
                  className="w-full sm:w-auto border border-border hover:border-accent bg-bg text-text py-3.5 px-5 text-sm font-bold rounded-xl motion-safe:transition-all"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* 6. PAST PRACTICE SESSION REVIEW MODAL */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {selectedSessionForReview && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl max-h-[85vh] bg-surface border border-border rounded-3xl p-6 sm:p-8 flex flex-col space-y-6 shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {selectedSessionForReview.mode === 'timed' ? '⏱️ Timed CBT Exam' : '💡 Tutor Practice'}
                    </span>
                    <span className="text-xs text-muted">
                      {selectedSessionForReview.date}
                    </span>
                  </div>
                  <h2 id="review-modal-title" className="text-xl sm:text-2xl font-black tracking-tight text-text">
                    {selectedSessionForReview.courseTitle}
                  </h2>
                  <p className="text-xs text-muted">
                    {selectedSessionForReview.topicTitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSessionForReview(null)}
                  className="p-2 rounded-xl border border-border hover:border-accent bg-bg text-muted hover:text-text transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Score Analytics Card */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-bg border border-border/80 text-center">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Score</span>
                  <div className="text-xl sm:text-2xl font-black text-text">
                    {selectedSessionForReview.score} / {selectedSessionForReview.total}
                  </div>
                  <span className="text-[10px] text-muted">Questions</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Accuracy</span>
                  <div className={`text-xl sm:text-2xl font-black ${
                    selectedSessionForReview.percentage >= 70 ? 'text-emerald-500' : 'text-amber-500'
                  }`}>
                    {selectedSessionForReview.percentage}%
                  </div>
                  <span className="text-[10px] text-muted">
                    {selectedSessionForReview.percentage >= 70 ? 'Passing Grade' : 'Needs Review'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">Status</span>
                  <div className="text-sm sm:text-base font-extrabold text-accent pt-1">
                    {selectedSessionForReview.percentage >= 70 ? 'Mastered 🎯' : 'Keep Drilling ⚡'}
                  </div>
                  <span className="text-[10px] text-muted">Benchmarked</span>
                </div>
              </div>

              {/* Scrollable Questions & Rationales Review */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {sessionReviewLoading ? (
                  <div className="py-12 text-center space-y-2">
                    <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-muted">Loading question rationales & solutions...</p>
                  </div>
                ) : sessionReviewQuestions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-muted px-1">
                      <span>Questions & Detailed Solutions ({sessionReviewQuestions.length})</span>
                      <span className="text-[11px] text-accent">Review mistakes & correct choices</span>
                    </div>

                    {sessionReviewQuestions.map((q, idx) => {
                      const isCorrect = q.chosen && q.chosen.toUpperCase() === (q.correct_answer || '').toUpperCase()

                      return (
                        <div key={q.id || idx} className="border border-border bg-surface p-4 sm:p-5 rounded-2xl space-y-3 shadow-2xs">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs font-black text-muted">
                              #{idx + 1}
                            </span>
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                              isCorrect
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                            }`}>
                              {isCorrect ? 'Correct ✓' : 'Incorrect ✗'}
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-text leading-snug">
                            {q.question_text}
                          </p>

                          {/* Options Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                            {[
                              { key: 'A', text: q.option_a },
                              { key: 'B', text: q.option_b },
                              { key: 'C', text: q.option_c },
                              { key: 'D', text: q.option_d },
                            ].filter((o) => Boolean(o.text)).map((opt) => {
                              const isStudentPick = q.chosen?.toUpperCase() === opt.key
                              const isRightAnswer = q.correct_answer?.toUpperCase() === opt.key

                              let style = 'border-border bg-bg/50 text-muted'
                              if (isRightAnswer) {
                                style = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold'
                              } else if (isStudentPick && !isRightAnswer) {
                                style = 'border-rose-500/40 bg-rose-500/10 text-rose-400 font-bold'
                              }

                              return (
                                <div key={opt.key} className={`p-2.5 rounded-xl border flex items-start gap-2 ${style}`}>
                                  <span className="font-black shrink-0">{opt.key}.</span>
                                  <span className="flex-1 leading-snug">{opt.text}</span>
                                  {isStudentPick && (
                                    <span className="text-[10px] uppercase font-bold shrink-0">
                                      (Your Pick)
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* Explanation Rationale */}
                          {q.explanation && (
                            <div className="p-3 rounded-xl bg-accent/5 border border-accent/15 text-xs space-y-1">
                              <span className="font-black text-accent uppercase tracking-wider text-[10px] block">
                                Clinical Rationale:
                              </span>
                              <p className="text-muted leading-relaxed">
                                {q.explanation}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="border border-dashed border-border rounded-2xl p-8 text-center space-y-2">
                    <span className="text-2xl">📝</span>
                    <p className="text-sm font-bold text-text">Session summary recorded</p>
                    <p className="text-xs text-muted max-w-sm mx-auto">
                      Detailed question-by-question rationales are available for full CBT mock exams submitted to the server.
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSessionForReview(null)
                    handleRetakeSession(selectedSessionForReview)
                  }}
                  className="bg-primary text-on-primary px-4 py-2 text-xs sm:text-sm font-bold rounded-xl hover:opacity-95 transition flex items-center gap-1.5"
                >
                  <PlayIcon className="w-3.5 h-3.5" />
                  <span>Retake This Session</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSessionForReview(null)}
                  className="border border-border hover:border-accent bg-bg text-text px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}