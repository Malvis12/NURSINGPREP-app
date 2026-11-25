import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Award, Save } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

interface LeaderboardEntry {
  rank: number
  user_id: string
  full_name: string
  university: string
  exams_count: number
  total_questions: number
  total_correct: number
  accuracy: number
  points: number
}

interface CourseOption {
  id: string
  code: string
  title: string
}

export function AdminLeaderboardPage() {
  const [selectedLevel, setSelectedLevel] = useState<'100' | '200' | '300' | '400'>('200')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [prizeText, setPrizeText] = useState('')
  const [challengeCourseId, setChallengeCourseId] = useState<string>('')
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [filterByChallengeCourse, setFilterByChallengeCourse] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingPrize, setIsSavingPrize] = useState(false)

  useEffect(() => {
    supabase
      .from('courses')
      .select('id, code, title')
      .eq('is_active', true)
      .order('code')
      .then(({ data }) => {
        if (data) setCourses(data)
      })
  }, [])

  const loadLeaderboard = async (lvl: string, courseId?: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_level_leaderboard', {
        p_level_code: lvl,
        ...(courseId ? { p_course_id: courseId } : {}),
      })
      if (error) throw error
      if (data) {
        setEntries(data.entries || [])
        setPrizeText(data.prize_text || '')
        setChallengeCourseId(data.challenge_course_id || '')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load leaderboard')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadLeaderboard(selectedLevel, filterByChallengeCourse && challengeCourseId ? challengeCourseId : undefined)
  }, [selectedLevel, filterByChallengeCourse])

  const handleSavePrize = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingPrize(true)
    try {
      const { error } = await supabase.rpc('admin_update_leaderboard_prize', {
        p_prize_text: prizeText,
        p_challenge_course_id: challengeCourseId || null,
      })
      if (error) throw error
      toast.success('Leaderboard prize & challenge course updated!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update prize')
    } finally {
      setIsSavingPrize(false)
    }
  }

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
            <span className="text-xs font-bold text-text">Leaderboard</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-accent" />
            <span>Cohort Leaderboards</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Monitor top performers per level (Timed CBT only) and configure the end-of-exams prize.
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

      {/* Prize & Challenge Course Configuration Card */}
      <form onSubmit={handleSavePrize} className="border border-border bg-surface p-5 rounded-2xl space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-accent">
            <Award className="w-4 h-4" />
            <span>Course Challenge &amp; Prize Announcement</span>
          </div>
          {challengeCourseId && (
            <button
              type="button"
              onClick={() => setFilterByChallengeCourse((prev) => !prev)}
              className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                filterByChallengeCourse
                  ? 'bg-accent text-on-accent border-accent'
                  : 'bg-bg text-muted border-border hover:text-text'
              }`}
            >
              {filterByChallengeCourse ? 'Showing Challenge Course Only' : 'Filter by Challenge Course'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            aria-label="Challenge Course"
            value={challengeCourseId}
            onChange={(e) => setChallengeCourseId(e.target.value)}
            className="bg-bg border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Courses (Overall Level)</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={prizeText}
            onChange={(e) => setPrizeText(e.target.value)}
            placeholder="e.g. Top student in NSC 405 wins ₦20,000!"
            className="bg-bg border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={isSavingPrize}
            className="bg-primary text-on-primary px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl hover:opacity-95 disabled:opacity-50 transition inline-flex items-center justify-center gap-2 shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>{isSavingPrize ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>

      {/* Standings Table */}
      <div className="border border-border bg-surface rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-10 text-center text-xs text-muted">Loading Level {selectedLevel} standings...</div>
        ) : entries.length === 0 ? (
          <div className="p-10 text-center text-xs text-muted">
            No Timed CBT exam submissions recorded for Level {selectedLevel} yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg/50 text-[11px] font-bold text-muted uppercase tracking-wider">
                  <th className="py-3.5 px-4 sm:px-6 w-16">Rank</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4 text-center">Exams</th>
                  <th className="py-3.5 px-4 text-center">Questions</th>
                  <th className="py-3.5 px-4 text-center">Accuracy</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {entries.map((entry) => (
                  <tr key={entry.user_id} className="hover:bg-bg/40 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-black text-text tabular-nums">#{entry.rank}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-text">{entry.full_name}</div>
                      <div className="text-[11px] text-muted">{entry.university}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs font-semibold text-muted tabular-nums">
                      {entry.exams_count}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs font-bold text-text tabular-nums">
                      {entry.total_questions}
                    </td>
                    <td className="py-3.5 px-4 text-center text-xs font-bold text-muted tabular-nums">
                      {entry.accuracy}%
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-right font-black text-accent tabular-nums">
                      {entry.points.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
