import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { ThemeToggle } from '../components/ThemeToggle'

export function LandingPage() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg text-text selection:bg-accent/20">
      {/* Header with iOS Safe Area support */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur-md pt-safe">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
            <img
              src="/logo.jpg"
              alt="NursingPrep Logo"
              className="w-8 h-8 rounded-lg object-cover border border-border shadow-xs"
            />
            <span className="font-extrabold text-lg tracking-tight">NursingPrep</span>
          </div>

          {/* Desktop Right Nav (sm and above) */}
          <div className="hidden sm:flex items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="border border-border hover:border-accent bg-surface text-text px-3.5 py-1.5 text-sm font-semibold rounded-lg transition"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="bg-primary text-on-primary hover:opacity-90 px-3.5 py-1.5 text-sm font-semibold rounded-lg transition"
            >
              Create account
            </button>
          </div>

          {/* Mobile Right Controls: Theme Toggle + Hamburger Toggle */}
          <div className="flex sm:hidden items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              className="p-2 rounded-lg border border-border bg-surface text-text hover:border-accent transition flex items-center justify-center"
            >
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-border bg-surface/98 px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                navigate('/signup')
              }}
              className="w-full bg-primary text-on-primary py-2.5 text-sm font-bold rounded-xl transition text-center shadow-xs"
            >
              Create Account (1 Free Drill)
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false)
                navigate('/login')
              }}
              className="w-full border border-border bg-bg text-text py-2.5 text-sm font-semibold rounded-xl transition text-center hover:border-accent"
            >
              Sign in to Portal
            </button>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-14 space-y-20">
        {/* Academic Hero */}
        <section className="text-center max-w-3xl mx-auto space-y-6 pt-4">
          <div className="text-xs uppercase font-extrabold tracking-widest text-accent">
            Academic Assessment &amp; Clinical CBT Simulation
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Structured exam preparation for nursing students.
          </h1>
          <p className="text-base sm:text-lg text-muted leading-relaxed max-w-2xl mx-auto">
            A curriculum-aligned practice platform featuring timed CBT sessions, exam timetable spotlights, and verified rationales mapped to 100L, 200L, 300L, and 400L course specifications.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="w-full sm:w-auto bg-primary text-on-primary px-7 py-3 text-sm font-semibold rounded-xl transition hover:opacity-95 active:scale-[0.98]"
            >
              Start 25-Question Free Trial
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto border border-border bg-surface text-text px-7 py-3 text-sm font-semibold rounded-xl hover:border-accent transition active:scale-[0.98]"
            >
              Sign in to portal
            </button>
          </div>
          <p className="text-xs text-muted max-w-md mx-auto">
            Includes 1 complimentary 25-question CBT simulation drill targeted to your next upcoming exam upon registration.
          </p>
        </section>

        {/* Curriculum & Structure Overview */}
        <section aria-label="Curriculum Overview">
          <div className="border border-border bg-surface p-8 rounded-2xl space-y-6">
            <div className="max-w-xl space-y-1">
              <h2 className="text-xl font-bold tracking-tight">Curriculum Specifications</h2>
              <p className="text-xs text-muted">
                Courses are organized by academic level and clinical specialty according to nursing curriculum guidelines.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="border border-border/80 bg-bg p-5 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-accent uppercase tracking-wider">Level 100 Foundational</span>
                <p className="text-sm font-bold">Pre-Clinical &amp; General Studies</p>
                <p className="text-xs text-muted leading-relaxed">
                  Introductory sciences, entrepreneurial studies, and foundational academic coursework.
                </p>
              </div>

              <div className="border border-border/80 bg-bg p-5 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-accent uppercase tracking-wider">Level 200 Core</span>
                <p className="text-sm font-bold">Foundations &amp; Anatomy</p>
                <p className="text-xs text-muted leading-relaxed">
                  Asepsis, nursing process, fundamental vital signs assessment, and core physiologic principles.
                </p>
              </div>

              <div className="border border-border/80 bg-bg p-5 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-accent uppercase tracking-wider">Level 300 Clinical</span>
                <p className="text-sm font-bold">Medical-Surgical &amp; Pharmacology</p>
                <p className="text-xs text-muted leading-relaxed">
                  Adult pathophysiology, acute care, drug mechanisms, dosage calculations, and IV flow rates.
                </p>
              </div>

              <div className="border border-border/80 bg-bg p-5 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-accent uppercase tracking-wider">Level 400 Specialty</span>
                <p className="text-sm font-bold">Maternal Health &amp; Community Care</p>
                <p className="text-xs text-muted leading-relaxed">
                  Obstetric complications, neonatal resuscitation (APGAR), primary healthcare, and epidemiology.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Study Cycle & Capabilities */}
        <section aria-label="Platform capabilities" className="space-y-6">
          <div className="text-center space-y-1 max-w-md mx-auto">
            <h2 className="text-2xl font-bold tracking-tight">Platform Modules</h2>
            <p className="text-xs text-muted">Engineered for systematic revision and objective self-assessment.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-border bg-surface p-6 rounded-2xl space-y-2.5">
              <span className="text-xs font-bold text-accent">01. Computer-Based Testing</span>
              <h3 className="text-base font-bold">Timed Examination Runs</h3>
              <p className="text-xs text-muted leading-relaxed">
                Standardized mock examinations with timed countdowns, question navigation palettes, and server-validated auto-submission.
              </p>
            </div>

            <div className="border border-border bg-surface p-6 rounded-2xl space-y-2.5">
              <span className="text-xs font-bold text-accent">02. Timetable &amp; Tutor Mode</span>
              <h3 className="text-base font-bold">Next-Paper Spotlight</h3>
              <p className="text-xs text-muted leading-relaxed">
                Automatic exam timetable tracking highlights your next upcoming paper and lets you drill with instant rationales in Tutor Mode.
              </p>
            </div>

            <div className="border border-border bg-surface p-6 rounded-2xl space-y-2.5">
              <span className="text-xs font-bold text-accent">03. Performance Review</span>
              <h3 className="text-base font-bold">Session History &amp; Rationales</h3>
              <p className="text-xs text-muted leading-relaxed">
                Click any completed session to inspect question-by-question answers, clinical rationales, and retake drills.
              </p>
            </div>
          </div>
        </section>

        {/* Academic Integrity & Account Security + Pronounced WhatsApp Support */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-border bg-surface p-8 rounded-2xl flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <h3 className="text-base font-bold">Academic Session &amp; Integrity Controls</h3>
              <p className="text-xs text-muted leading-relaxed">
                Student accounts are protected by multi-device concurrency controls and active session verification to maintain examination integrity and prevent unauthorized credential sharing.
              </p>
            </div>
          </div>

          <div className="border border-emerald-500/30 bg-emerald-500/10 p-8 rounded-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-1.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-500">
                24/7 Student Helpdesk
              </span>
              <h3 className="text-lg font-extrabold text-text">Need help with your account or payment?</h3>
              <p className="text-xs text-muted leading-relaxed">
                Chat directly with our support team on WhatsApp for fast assistance with registration, level switching, or payment confirmation.
              </p>
            </div>
            <div>
              <a
                href="https://wa.me/2348103128721?text=Hello%20NursingPrep%20Support%2C%20I%20need%20assistance%20with%20my%20account."
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 text-sm font-bold rounded-xl shadow-sm transition active:scale-[0.98]"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Contact Support on WhatsApp</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Footer & Compliance Disclaimers */}
      <footer className="border-t border-border mt-20 py-10 bg-surface">
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.jpg"
                alt="NursingPrep Logo"
                className="w-6 h-6 rounded-md object-cover border border-border"
              />
              <span className="font-semibold text-text">NursingPrep Academic Platform</span>
            </div>
            <p>Curriculum-aligned clinical preparation</p>
          </div>

          <div className="border-t border-border/60 pt-6 space-y-3 text-[11px] text-muted leading-relaxed">
            <p>
              <strong className="text-text">Non-Affiliation Notice:</strong> NursingPrep is an independent educational study and revision platform. It is not affiliated with, sponsored by, or officially endorsed by the Nursing and Midwifery Council of Nigeria (NMCN), the National Council of State Boards of Nursing (NCSBN / NCLEX), or any university governing council.
            </p>
            <p>
              <strong className="text-text">Medical Disclaimer:</strong> Practice questions, clinical vignettes, and study rationales are intended strictly for academic preparation and exam practice. They do not constitute formal medical advice, diagnostic prescriptions, or hospital clinical protocols.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}


