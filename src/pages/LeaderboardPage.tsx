import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, ArrowLeft, Award, Clock, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'
import { MobileBottomNav } from '../components/MobileBottomNav'

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
  is_me?: boolean
}

interface LeaderboardResponse {
  level_code: string
  prize_text: string
  challenge_course_id?: string | null
  challenge_course_code?: string | null
  challenge_course_title?: string | null
  entries: LeaderboardEntry[]
  my_rank: LeaderboardEntry | null
}

export function LeaderboardPage() {
  const { level: authLevel } = useAuth()
  const [data, setData] = useState<LeaderboardResponse | null>(null)
  const [viewMode, setViewMode] = useState<'overall' | 'challenge'>('challenge')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function fetchLeaderboard() {
      setIsLoading(true)
      try {
        // First fetch without course filter to learn if a challenge_course_id is active
        const { data: baseRes, error: baseErr } = await supabase.rpc('get_level_leaderboard')
        if (!baseErr && baseRes && active) {
          const typedBase = baseRes as LeaderboardResponse
          if (viewMode === 'challenge' && typedBase.challenge_course_id) {
            const { data: challengeRes, error: chalErr } = await supabase.rpc('get_level_leaderboard', {
              p_course_id: typedBase.challenge_course_id,
            })
            if (!chalErr && challengeRes && active) {
              setData(challengeRes as LeaderboardResponse)
              return
            }
          }
          setData(typedBase)
        }
      } catch (err) {
        console.warn('[Leaderboard] Fetch error:', err)
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void fetchLeaderboard()
    return () => {
      active = false
    }
  }, [authLevel, viewMode])

  const levelLabel = data?.level_code || authLevel || 300
  const entries = data?.entries || []
  const myRank = data?.my_rank || null

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col">
      {/* Top Header */}
      <header className="border-b border-border bg-surface/95 backdrop-blur-md sticky top-0 z-30 pt-safe">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-muted hover:text-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-bg border border-border text-accent">
              Level {levelLabel}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6 pb-24">
        {/* Title */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-accent">
            <Trophy className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">Cohort Standings</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Level {levelLabel} Leaderboard
          </h1>
          <p className="text-xs sm:text-sm text-muted">
            Rankings are calculated strictly from submitted Timed CBT exams.
          </p>
        </div>

        {/* Subtle Prize Banner + Course Challenge Toggle */}
        <div className="border border-accent/25 bg-accent/5 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
              <Award className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-accent block">
                {data?.challenge_course_code
                  ? `${data.challenge_course_code} Course Challenge Prize`
                  : 'End-of-Exams Prize'}
              </span>
              <p className="text-xs sm:text-sm font-semibold text-text">
                {data?.prize_text || 'Top-ranked student at the end of exams wins a special prize.'}
              </p>
            </div>
          </div>

          {data?.challenge_course_id && (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-border shrink-0 self-start sm:self-center">
              <button
                type="button"
                onClick={() => setViewMode('challenge')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'challenge'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                {data.challenge_course_code} Challenge
              </button>
              <button
                type="button"
                onClick={() => setViewMode('overall')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  viewMode === 'overall'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
              >
                Overall
              </button>
            </div>
          )}
        </div>

        {/* Standings Table */}
        <div className="border border-border bg-surface rounded-2xl overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-muted">Loading Level {levelLabel} standings...</p>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Clock className="w-8 h-8 text-muted mx-auto" />
              <p className="text-sm font-bold text-text">No Timed CBT submissions yet</p>
              <p className="text-xs text-muted max-w-sm mx-auto">
                Complete a Timed CBT exam on your dashboard to claim the #1 spot for Level {levelLabel}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-bg/50 text-[11px] font-bold text-muted uppercase tracking-wider">
                    <th scope="col" className="py-3.5 px-3 sm:px-6 w-14">Rank</th>
                    <th scope="col" className="py-3.5 px-3 sm:px-4">Student</th>
                    <th scope="col" className="hidden sm:table-cell py-3.5 px-4 text-center">Questions</th>
                    <th scope="col" className="hidden sm:table-cell py-3.5 px-4 text-center">Accuracy</th>
                    <th scope="col" className="py-3.5 px-3 sm:px-6 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {entries.map((entry) => {
                    const isTopThree = entry.rank <= 3
                    const rankBadgeClass =
                      entry.rank === 1
                        ? 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                        : entry.rank === 2
                        ? 'bg-slate-400/15 text-slate-400 border-slate-400/30'
                        : entry.rank === 3
                        ? 'bg-orange-500/15 text-orange-500 border-orange-500/30'
                        : 'bg-bg text-muted border-border'

                    return (
                      <tr
                        key={entry.user_id}
                        className={entry.is_me ? 'bg-primary/5 font-semibold' : 'hover:bg-bg/40 transition-colors'}
                      >
                        <td className="py-3.5 px-3 sm:px-6">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border text-xs font-black tabular-nums ${rankBadgeClass}`}
                          >
                            {entry.rank}
                          </span>
                        </td>
                        <td className="py-3.5 px-3 sm:px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-text text-sm">{entry.full_name}</span>
                            {entry.is_me && (
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/25">
                                You
                              </span>
                            )}
                            {isTopThree && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                            )}
                          </div>
                          <span className="text-[11px] text-muted block">
                            {entry.exams_count} timed exams
                            <span className="sm:hidden"> • {entry.total_questions} Qs • {entry.accuracy}%</span>
                          </span>
                        </td>
                        <td className="hidden sm:table-cell py-3.5 px-4 text-center text-xs font-bold text-text tabular-nums">
                          {entry.total_questions}
                        </td>
                        <td className="hidden sm:table-cell py-3.5 px-4 text-center text-xs font-bold text-muted tabular-nums">
                          {entry.accuracy}%
                        </td>
                        <td className="py-3.5 px-3 sm:px-6 text-right font-black text-accent tabular-nums">
                          {entry.points.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pinned "Your Rank" bar if outside Top 25 */}
        {myRank && myRank.rank > 25 && (
          <div className="border border-primary/30 bg-primary/10 p-4 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-primary text-on-primary text-xs font-black tabular-nums">
                #{myRank.rank}
              </span>
              <div>
                <p className="text-sm font-bold text-text">Your Current Standing</p>
                <p className="text-xs text-muted">
                  {myRank.total_questions} questions • {myRank.accuracy}% accuracy
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-black text-primary tabular-nums">
                {myRank.points.toLocaleString()} pts
              </span>
            </div>
          </div>
        )}
      </main>

      <MobileBottomNav />
    </div>
  )
}
