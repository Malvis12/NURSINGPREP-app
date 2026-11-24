import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Home, Zap, Trophy, User } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

export function MobileBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isActive, canTakeExam } = useAuth()

  const isHome = location.pathname === '/app'
  const isLeaderboard = location.pathname === '/app/leaderboard'
  const isProfile = location.pathname === '/app/profile'

  const handleQuickCBT = () => {
    if (!canTakeExam) {
      toast.error('Free trial exam completed. Activate Pro to unlock unlimited exam practice!')
      navigate('/pay')
      return
    }
    const count = isActive ? 20 : 25
    navigate(`/app/exam?count=${count}&mode=timed`)
  }

  return (
    <nav
      aria-label="Mobile Navigation"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border px-2 py-2 pb-safe"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        <Link
          to="/app"
          className={`flex flex-col items-center gap-1 text-[11px] px-3 py-1 transition-colors ${
            isHome ? 'font-bold text-accent' : 'font-semibold text-muted hover:text-text'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Home</span>
        </Link>

        <button
          type="button"
          onClick={handleQuickCBT}
          className="flex flex-col items-center gap-1 text-[11px] font-semibold text-muted hover:text-text px-3 py-1 transition-colors"
        >
          <Zap className="w-4 h-4" />
          <span>Quick CBT</span>
        </button>

        <Link
          to="/app/leaderboard"
          className={`flex flex-col items-center gap-1 text-[11px] px-3 py-1 transition-colors ${
            isLeaderboard ? 'font-bold text-accent' : 'font-semibold text-muted hover:text-text'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Ranks</span>
        </Link>

        <Link
          to="/app/profile"
          className={`flex flex-col items-center gap-1 text-[11px] px-3 py-1 transition-colors ${
            isProfile ? 'font-bold text-accent' : 'font-semibold text-muted hover:text-text'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Profile</span>
        </Link>
      </div>
    </nav>
  )
}
