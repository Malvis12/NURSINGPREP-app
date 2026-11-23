import { useNavigate } from 'react-router-dom'
import { ThemeToggle } from '../components/ThemeToggle'

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-on-primary font-black text-sm shadow-sm">
              NP
            </div>
            <span className="font-extrabold text-lg tracking-tight">NursingPrep</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="border border-border hover:border-accent bg-surface text-text px-3.5 py-1.5 text-sm font-semibold rounded-lg transition hover:bg-surface-elevated"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="bg-primary text-on-primary hover:opacity-90 px-3.5 py-1.5 text-sm font-semibold rounded-lg transition"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-24">
        {/* Hero */}
        <section className="text-center max-w-3xl mx-auto space-y-6 pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-surface text-xs font-bold text-accent">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Designed for 200L, 300L & 400L Nursing Cohorts
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.15]">
            Master your clinical exams with confidence.
          </h1>
          <p className="text-lg text-muted leading-relaxed max-w-2xl mx-auto">
            High-yield clinical scenarios, active recall flashcards, and realistic timed CBT simulations designed specifically for university nursing students and licensure preparation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto bg-primary text-on-primary px-8 py-3.5 text-base font-bold rounded-xl shadow-md hover:opacity-90 transition active:scale-[0.98]"
            >
              Start Practicing Free
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto border border-border bg-surface text-text px-8 py-3.5 text-base font-bold rounded-xl hover:border-accent hover:bg-surface-elevated transition active:scale-[0.98]"
            >
              Log In to Portal
            </button>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section aria-label="Core Capabilities" className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Built for Clinical Excellence</h2>
            <p className="text-sm text-muted">A dedicated workspace engineered for active learning and retention.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="border border-border bg-surface p-7 rounded-2xl space-y-4 hover:border-accent/40 transition">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary text-xl font-bold">
                ⏱️
              </div>
              <h3 className="text-lg font-bold">Realistic CBT Simulation</h3>
              <p className="text-sm text-muted leading-relaxed">
                Experience actual exam conditions with countdown timers, question jumping, flag-for-review, and auto-submit safety safeguards.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="border border-border bg-surface p-7 rounded-2xl space-y-4 hover:border-accent/40 transition">
              <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-xl font-bold">
                🃏
              </div>
              <h3 className="text-lg font-bold">Clinical Active Recall Flashcards</h3>
              <p className="text-sm text-muted leading-relaxed">
                Flip 3D digital cards with key medical terms, pharmacological mechanisms, and nursing diagnoses to cement long-term retention.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="border border-border bg-surface p-7 rounded-2xl space-y-4 hover:border-accent/40 transition">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 text-xl font-bold">
                🛡️
              </div>
              <h3 className="text-lg font-bold">Protected Session Guard</h3>
              <p className="text-sm text-muted leading-relaxed">
                Secure multi-device sessions with anti-sharing integrity and immediate self-service ₦500 unlock verification.
              </p>
            </div>
          </div>
        </section>

        {/* Study Cycle Process */}
        <section aria-label="Study cycle" className="border border-border bg-surface p-8 sm:p-12 rounded-3xl">
          <div className="max-w-2xl mx-auto text-center space-y-3 mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">The 3-Step Mastery Cycle</h2>
            <p className="text-sm text-muted">A structured system to turn exam anxiety into confident competence.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-border/70 bg-bg p-6 rounded-2xl space-y-2">
              <p className="font-black text-xs text-accent uppercase tracking-widest">Step 01</p>
              <h4 className="font-bold text-base">Practice & Diagnostics</h4>
              <p className="text-xs text-muted leading-relaxed">Filter questions by course, academic level, and high-yield topics to identify knowledge gaps.</p>
            </div>
            <div className="border border-border/70 bg-bg p-6 rounded-2xl space-y-2">
              <p className="font-black text-xs text-accent uppercase tracking-widest">Step 02</p>
              <h4 className="font-bold text-base">Detailed Rationales</h4>
              <p className="text-xs text-muted leading-relaxed">Understand the clinical "why" behind every option with comprehensive physiological rationales.</p>
            </div>
            <div className="border border-border/70 bg-bg p-6 rounded-2xl space-y-2">
              <p className="font-black text-xs text-accent uppercase tracking-widest">Step 03</p>
              <h4 className="font-bold text-base">Cohort Mastery</h4>
              <p className="text-xs text-muted leading-relaxed">Track score trajectories, study streaks, and topic-level mastery percentages on your dashboard.</p>
            </div>
          </div>
        </section>

        {/* Call to action */}
        <section className="border border-primary/20 bg-surface p-8 sm:p-14 rounded-3xl text-center max-w-3xl mx-auto space-y-6 shadow-sm">
          <div className="text-xs uppercase font-extrabold tracking-widest text-accent">
            Start Your Preparation
          </div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Ready to pass your upcoming exams?
          </h2>
          <p className="text-base text-muted max-w-xl mx-auto leading-relaxed">
            Join fellow nursing students preparing with validated questions, instant explanations, and structured curriculum courses.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="bg-primary text-on-primary px-8 py-3.5 text-base font-bold rounded-xl hover:opacity-90 shadow-md transition active:scale-[0.98]"
            >
              Create Free Account Now
            </button>
          </div>
        </section>
      </main>

      {/* Footer & Compliance Disclaimers */}
      <footer className="border-t border-border mt-20 py-10 bg-surface">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center text-on-primary font-bold text-xs">
                NP
              </div>
              <p className="font-bold text-text">NursingPrep CBT Platform</p>
            </div>
            <p className="text-xs">Practice with purpose · Progress with confidence</p>
          </div>

          <div className="border-t border-border/60 pt-6 space-y-3 text-[11px] text-muted leading-relaxed">
            <p>
              <strong className="text-text">Examination Non-Affiliation Notice:</strong> NursingPrep is an independent educational preparatory platform designed for clinical revision and examination simulation. It is not affiliated with, sponsored by, or officially endorsed by the Nursing and Midwifery Council of Nigeria (NMCN), the National Council of State Boards of Nursing (NCSBN / NCLEX), or any university governing council. All trademarks are the property of their respective owners.
            </p>
            <p>
              <strong className="text-text">Medical Disclaimer:</strong> Content, question stems, and rationales provided on this platform are for academic study and licensure practice only. They do not constitute formal medical advice, clinical nursing protocols, or diagnostic prescriptions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

