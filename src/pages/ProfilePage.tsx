import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ThemeToggle } from '../components/ThemeToggle'

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, level, isActive, isAdmin, submittedAttemptsCount, refreshProfile, signOut } = useAuth()

  const [fullName, setFullName] = useState('')
  const [university, setUniversity] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<number>(level || 300)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load existing profile attributes
  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      if (!user?.id) return
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, university, level')
          .eq('id', user.id)
          .maybeSingle()

        if (error) throw error
        if (mounted && data) {
          setFullName(data.full_name || '')
          setUniversity(data.university || '')
          setSelectedLevel(data.level || level || 300)
        }
      } catch (err: any) {
        console.error('Failed to load profile details:', err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    void loadProfile()

    return () => {
      mounted = false
    }
  }, [user?.id, level])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return

    if (!fullName.trim()) {
      toast.error('Please enter your full name.')
      return
    }

    setIsSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          university: university.trim() || null,
          level: selectedLevel,
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      toast.success('Profile and cohort level updated successfully!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/20 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md pt-safe">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/app')}>
            <img src="/logo.jpg" alt="Logo" className="w-8 h-8 rounded-lg object-cover border border-border shadow-xs" />
            <div>
              <span className="font-extrabold text-base tracking-tight block">NursingPrep</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted block -mt-0.5">
                Student Profile
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              to="/app"
              className="border border-border hover:border-accent bg-surface text-text px-3.5 py-1.5 text-xs sm:text-sm font-bold rounded-xl transition"
            >
              Dashboard
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-bold text-rose-500 hover:text-rose-400 px-2 py-1.5 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8 pb-24 sm:pb-12">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Account &amp; Cohort Settings</h1>
          <p className="text-xs sm:text-sm text-muted">
            Manage your personal nursing student profile and switch your active curriculum level.
          </p>
        </div>

        {/* Membership Status Card */}
        <div className="border border-border bg-surface p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-extrabold tracking-wider text-muted">
                Membership Status
              </span>
              {isActive ? (
                <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Pro Active (Unlimited Access)
                </span>
              ) : (
                <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Free Trial {submittedAttemptsCount > 0 ? '(Used)' : '(Available)'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted">
              {isActive
                ? 'Full access to all 200L, 300L, and 400L CBT examinations, rationales, and flashcard decks.'
                : '1 complimentary CBT drill. Upgrade to Pro for unlimited mocks and rationales across all levels.'}
            </p>
          </div>

          {!isActive && (
            <button
              type="button"
              onClick={() => navigate('/pay')}
              className="bg-primary text-on-primary px-4 py-2 text-xs sm:text-sm font-bold rounded-xl hover:opacity-95 shrink-0 shadow-xs transition"
            >
              Upgrade to Pro (₦1,050)
            </button>
          )}
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSaveProfile} className="border border-border bg-surface p-6 sm:p-8 rounded-2xl space-y-6 shadow-xs">
          <div className="border-b border-border pb-4">
            <h2 className="text-lg font-bold tracking-tight">Student Information</h2>
            <p className="text-xs text-muted">Update your identity and academic level for customized course drills.</p>
          </div>

          <div className="space-y-4">
            {/* Email (Read only) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-muted block">
                Email Address (Account Identifier)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full bg-bg/50 border border-border/80 rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-muted cursor-not-allowed"
              />
              <span className="text-[11px] text-muted">Email is linked to your authentication login.</span>
            </div>

            {/* Full Name */}
            <div className="space-y-1.5">
              <label htmlFor="full-name" className="text-xs font-bold uppercase tracking-wider text-muted block">
                Full Name
              </label>
              <input
                id="full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Nurse Jane Doe"
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            {/* University / Nursing School */}
            <div className="space-y-1.5">
              <label htmlFor="university" className="text-xs font-bold uppercase tracking-wider text-muted block">
                Institution / School of Nursing
              </label>
              <input
                id="university"
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="e.g. University of Lagos / LUTH"
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-xs sm:text-sm font-semibold text-text focus:outline-none focus:ring-2 focus:ring-primary transition"
              />
            </div>

            {/* Academic Cohort Level Switcher */}
            <div className="space-y-2 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted block">
                Academic Cohort Level (Curriculum Filter)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { lvl: 100, name: 'Level 100', desc: 'Pre-Clinical & General Studies' },
                  { lvl: 200, name: 'Level 200', desc: 'Foundations & Anatomy' },
                  { lvl: 300, name: 'Level 300', desc: 'Med-Surg & Pharmacology' },
                  { lvl: 400, name: 'Level 400', desc: 'Maternal Health & Community' },
                ].map((item) => (
                  <button
                    key={item.lvl}
                    type="button"
                    onClick={() => setSelectedLevel(item.lvl)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      selectedLevel === item.lvl
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-border bg-bg hover:border-accent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-sm text-text">{item.name}</span>
                      {selectedLevel === item.lvl && (
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className="text-xs text-muted block">{item.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted pt-1">
                Changing your level immediately adapts your dashboard courses and exam questions to this cohort.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
            {isAdmin && (
              <Link
                to="/admin"
                className="text-xs font-bold text-accent hover:underline flex items-center gap-1"
              >
                <span>🛡️ Admin Studio</span>
              </Link>
            )}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={() => navigate('/app')}
                className="border border-border hover:border-accent bg-bg text-text px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || isLoading}
                className="bg-primary text-on-primary px-6 py-2.5 text-xs sm:text-sm font-extrabold rounded-xl hover:opacity-95 shadow-xs transition disabled:opacity-50"
              >
                {isSaving ? 'Saving Changes...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </form>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav aria-label="Mobile Navigation" className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border px-3 py-2">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link
            to="/app"
            className="flex flex-col items-center gap-1 text-[11px] font-bold text-text hover:text-accent"
          >
            <span className="text-base">🏠</span>
            <span>Dashboard</span>
          </Link>
          <Link
            to="/app/flashcards"
            className="flex flex-col items-center gap-1 text-[11px] font-bold text-text hover:text-accent"
          >
            <span className="text-base">🗂️</span>
            <span>Flashcards</span>
          </Link>
          <Link
            to="/app/profile"
            className="flex flex-col items-center gap-1 text-[11px] font-bold text-accent"
          >
            <span className="text-base">👤</span>
            <span>Profile</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
