import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { ThemeToggle } from '../components/ThemeToggle'

export function SignupPage() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (password.length < 8) {
      const err = 'Password must be at least 8 characters'
      setErrorMsg(err)
      toast.error(err)
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (error) {
        toast.error(error.message)
      } else {
        navigate('/onboarding')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during sign up'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg text-text flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Top Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between py-2">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary font-black text-xs shadow-sm">
            NP
          </div>
          <span className="font-extrabold text-base tracking-tight">NursingPrep</span>
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Registration Box */}
      <main className="w-full max-w-md mx-auto my-auto py-8">
        <div className="border border-border bg-surface p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
          <div className="space-y-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-accent bg-accent-light px-2.5 py-1 rounded-full">
              Student Registration
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight pt-1">
              Create Your Account
            </h1>
            <p className="text-sm text-muted leading-relaxed">
              Register now to unlock 1 complimentary full-length practice drill across any nursing curriculum course.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="fullName" className="block text-xs font-bold uppercase tracking-wider text-muted">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="w-full border border-border bg-bg/80 text-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-muted">
                Student Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full border border-border bg-bg/80 text-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-muted">
                Password (min 8 characters)
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-border bg-bg/80 text-text rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-text p-1 text-xs focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {errorMsg && (
                <p role="alert" className="text-xs text-danger font-semibold pt-1">
                  {errorMsg}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-on-primary py-3.5 text-sm font-bold rounded-xl hover:opacity-90 active:scale-[0.99] transition shadow-sm disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating Account...' : 'Register & Start Free Exam'}
            </button>
          </form>

          <div className="text-center text-sm text-muted pt-3 border-t border-border/80">
            <span>Already registered? </span>
            <Link to="/login" className="font-bold text-accent hover:underline">
              Sign In to Portal
            </Link>
          </div>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="w-full max-w-5xl mx-auto py-4 text-center text-xs text-muted">
        <span>© NursingPrep Academic CBT. Safe, verified exam simulation.</span>
      </footer>
    </div>
  )
}
