import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  requireLevel?: boolean
  requireActive?: boolean
  allowTrialExam?: boolean
  blockIfOnboarded?: boolean
  blockIfActive?: boolean
}

export function ProtectedRoute({
  children,
  requireLevel = false,
  requireActive = false,
  allowTrialExam = false,
  blockIfOnboarded = false,
  blockIfActive = false,
}: ProtectedRouteProps) {
  const { user, loading, level, isActive, canTakeExam } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (requireLevel && level === null) {
    return <Navigate to="/onboarding" replace />
  }

  // If trial is allowed, let the user in if active OR if they have not used their free trial yet
  if (requireActive) {
    if (allowTrialExam ? !canTakeExam : !isActive) {
      return <Navigate to="/pay" replace />
    }
  }

  if (blockIfOnboarded && level !== null) {
    return <Navigate to="/app" replace />
  }

  if (blockIfActive && isActive) {
    return <Navigate to="/app" replace />
  }

  return <>{children}</>
}
