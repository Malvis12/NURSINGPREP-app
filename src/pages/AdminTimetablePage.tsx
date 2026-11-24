import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

interface TimetableItem {
  id: string
  level_code: string
  course_id: string
  exam_date: string
  paper_title: string
  venue: string
  courses?: {
    id: string
    title: string
    code: string
  } | null
}

interface CourseOption {
  id: string
  title: string
  code: string
  level_code: string
}

export function AdminTimetablePage() {
  const [timetables, setTimetables] = useState<TimetableItem[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLevel, setSelectedLevel] = useState<'100' | '200' | '300' | '400'>('200')

  // Form State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formCourseId, setFormCourseId] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('09:00')
  const [formPaperTitle, setFormPaperTitle] = useState('Final CBT Examination')
  const [formVenue, setFormVenue] = useState('University CBT Center')

  // Load Data
  const loadData = async () => {
    setIsLoading(true)
    try {
      // 1. Fetch active courses
      const { data: coursesData, error: coursesErr } = await supabase
        .from('courses')
        .select('id, title, code, level_id, academic_levels(code)')
        .eq('is_active', true)
        .order('code')

      if (coursesErr) throw coursesErr

      const mappedCourses: CourseOption[] = (coursesData || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        code: c.code,
        level_code: c.academic_levels?.code || '300',
      }))
      setCourses(mappedCourses)

      // 2. Fetch scheduled timetables
      const { data: tableData, error: tableErr } = await supabase
        .from('exam_timetables')
        .select(`
          id,
          level_code,
          course_id,
          exam_date,
          paper_title,
          venue,
          courses (
            id,
            title,
            code
          )
        `)
        .order('exam_date', { ascending: true })

      if (tableErr) throw tableErr
      const mappedItems: TimetableItem[] = (tableData || []).map((row: any) => ({
        id: row.id,
        level_code: row.level_code,
        course_id: row.course_id,
        exam_date: row.exam_date,
        paper_title: row.paper_title,
        venue: row.venue,
        courses: Array.isArray(row.courses) ? row.courses[0] : row.courses,
      }))

      setTimetables(mappedItems)
    } catch (err: any) {
      console.error('[AdminTimetable] Load error:', err)
      toast.error(err.message || 'Failed to load timetable entries')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  // Filter courses for currently selected form level
  const availableCoursesForSelectedLevel = courses.filter((c) => c.level_code === selectedLevel)

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCourseId) {
      toast.error('Please select a course.')
      return
    }
    if (!formDate) {
      toast.error('Please select an exam date.')
      return
    }

    setIsSubmitting(true)
    try {
      const fullIsoDate = new Date(`${formDate}T${formTime}:00`).toISOString()

      const { data, error } = await supabase
        .from('exam_timetables')
        .insert({
          level_code: selectedLevel,
          course_id: formCourseId,
          exam_date: fullIsoDate,
          paper_title: formPaperTitle.trim() || 'Final CBT Examination',
          venue: formVenue.trim() || 'University CBT Center',
        })
        .select(`
          id,
          level_code,
          course_id,
          exam_date,
          paper_title,
          venue,
          courses (
            id,
            title,
            code
          )
        `)
        .single()

      if (error) throw error

      const insertedItem: TimetableItem = {
        id: (data as any).id,
        level_code: (data as any).level_code,
        course_id: (data as any).course_id,
        exam_date: (data as any).exam_date,
        paper_title: (data as any).paper_title,
        venue: (data as any).venue,
        courses: Array.isArray((data as any).courses) ? (data as any).courses[0] : (data as any).courses,
      }

      toast.success('Exam paper added to timetable!')
      setTimetables((prev) => [...prev, insertedItem].sort((a, b) => new Date(a.exam_date).getTime() - new Date(b.exam_date).getTime()))
      setFormCourseId('')
      setFormDate('')
    } catch (err: any) {
      toast.error(err.message || 'Failed to save timetable entry.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteEntry = async (id: string, courseCode?: string) => {
    if (!window.confirm(`Remove ${courseCode || 'this exam'} from the schedule?`)) return

    try {
      const { error } = await supabase.from('exam_timetables').delete().eq('id', id)
      if (error) throw error
      setTimetables((prev) => prev.filter((item) => item.id !== id))
      toast.success('Entry removed from timetable.')
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete entry.')
    }
  }

  const filteredTimetables = timetables.filter((t) => t.level_code === selectedLevel)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/admin" className="text-xs font-bold text-muted hover:text-accent">
              Admin
            </Link>
            <span className="text-xs text-muted">/</span>
            <span className="text-xs font-bold text-text">Exam Timetable</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Exam Timetable Scheduler</h1>
          <p className="text-xs sm:text-sm text-muted">
            Schedule upcoming examination papers. The next upcoming paper will automatically spotlight on students' dashboards.
          </p>
        </div>

        {/* Level Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border">
          {(['100', '200', '300', '400'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => setSelectedLevel(lvl)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedLevel === lvl
                  ? 'bg-primary text-on-primary shadow-xs'
                  : 'text-muted hover:text-text'
              }`}
            >
              Level {lvl}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Schedule Form */}
        <div className="border border-border bg-surface p-5 sm:p-6 rounded-2xl space-y-4 shadow-xs h-fit">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-accent">
            Schedule {selectedLevel}L Paper
          </h2>

          <form onSubmit={handleAddEntry} className="space-y-3.5">
            <div>
              <label className="text-xs font-bold text-muted block mb-1">Target Course</label>
              <select
                required
                value={formCourseId}
                onChange={(e) => setFormCourseId(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a {selectedLevel}L Course...</option>
                {availableCoursesForSelectedLevel.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
              {availableCoursesForSelectedLevel.length === 0 && (
                <p className="text-[11px] text-amber-500 mt-1">
                  No courses currently assigned to Level {selectedLevel}. You can create courses in Question Bank.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-muted block mb-1">Exam Date</label>
                <input
                  type="date"
                  required
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted block mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted block mb-1">Paper Title / Code</label>
              <input
                type="text"
                value={formPaperTitle}
                onChange={(e) => setFormPaperTitle(e.target.value)}
                placeholder="e.g. CBT Objective & Clinical Scenarios"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted block mb-1">Venue / Center</label>
              <input
                type="text"
                value={formVenue}
                onChange={(e) => setFormVenue(e.target.value)}
                placeholder="e.g. University Main CBT Center"
                className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || availableCoursesForSelectedLevel.length === 0}
              className="w-full bg-primary text-on-primary py-2.5 text-xs font-bold rounded-xl hover:opacity-95 disabled:opacity-50 transition shadow-xs"
            >
              {isSubmitting ? 'Scheduling...' : `Save to Level ${selectedLevel} Timetable`}
            </button>
          </form>
        </div>

        {/* Right: Scheduled List */}
        <div className="lg:col-span-2 border border-border bg-surface p-5 sm:p-6 rounded-2xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-text">
              Level {selectedLevel} Scheduled Exams ({filteredTimetables.length})
            </h2>
            <span className="text-[11px] text-muted">Chronological order</span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted">Loading timetable entries...</div>
          ) : filteredTimetables.length === 0 ? (
            <div className="border border-dashed border-border rounded-xl p-8 text-center space-y-2">
              <span className="text-2xl">📅</span>
              <p className="text-xs font-bold text-text">No exams scheduled for Level {selectedLevel}</p>
              <p className="text-[11px] text-muted">
                Use the form on the left to add upcoming exam dates for this cohort.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredTimetables.map((item) => {
                const dateObj = new Date(item.exam_date)
                const isPast = dateObj.getTime() < Date.now()

                return (
                  <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase text-accent">
                          {item.courses?.code || 'EXAM'}
                        </span>
                        <span className="text-xs font-bold text-text">
                          {item.courses?.title || 'Course Examination'}
                        </span>
                        {isPast ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-border text-muted">
                            Past
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            Upcoming
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                        <span>
                          📅{' '}
                          {dateObj.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span>
                          ⏰{' '}
                          {dateObj.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span>📍 {item.venue}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(item.id, item.courses?.code)}
                      className="text-xs font-bold text-rose-500 hover:text-rose-400 p-2 rounded-lg hover:bg-rose-500/10 transition"
                      title="Delete from timetable"
                    >
                      Delete
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
