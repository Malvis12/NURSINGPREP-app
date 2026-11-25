import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminRoute } from './components/AdminRoute'
import { useSessionGuard } from './hooks/useSessionGuard'
import { useVersionCheck } from './hooks/useVersionCheck'
import { ExamErrorBoundary } from './components/ExamErrorBoundary'

// Lazy-loaded student routes
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })))
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('./pages/SignupPage').then((m) => ({ default: m.SignupPage })))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage').then((m) => ({ default: m.OnboardingPage })))
const PayPage = lazy(() => import('./pages/PayPage').then((m) => ({ default: m.PayPage })))
const PayReturnPage = lazy(() => import('./pages/PayReturnPage').then((m) => ({ default: m.PayReturnPage })))
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ExamPage = lazy(() => import('./pages/ExamPage').then((m) => ({ default: m.ExamPage })))
const FlashcardsPage = lazy(() => import('./pages/FlashcardsPage').then((m) => ({ default: m.FlashcardsPage })))
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((m) => ({ default: m.LeaderboardPage })))
const LockedAccountPage = lazy(() => import('./pages/LockedAccountPage').then((m) => ({ default: m.LockedAccountPage })))

// Lazy-loaded admin routes
const AdminLayout = lazy(() => import('./components/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminOverviewPage = lazy(() => import('./pages/AdminOverviewPage').then((m) => ({ default: m.AdminOverviewPage })))
const AdminStudentsPage = lazy(() => import('./pages/AdminStudentsPage').then((m) => ({ default: m.AdminStudentsPage })))
const AdminQuestionsPage = lazy(() => import('./pages/AdminQuestionsPage').then((m) => ({ default: m.AdminQuestionsPage })))
const AdminPaymentsPage = lazy(() => import('./pages/AdminPaymentsPage').then((m) => ({ default: m.AdminPaymentsPage })))
const AdminTimetablePage = lazy(() => import('./pages/AdminTimetablePage').then((m) => ({ default: m.AdminTimetablePage })))
const AdminLeaderboardPage = lazy(() => import('./pages/AdminLeaderboardPage').then((m) => ({ default: m.AdminLeaderboardPage })))

function RouteLoading() {
  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function SessionGuardWrapper({ children }: { children: React.ReactNode }) {
  useSessionGuard()
  useVersionCheck()
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SessionGuardWrapper>
          <Toaster richColors theme="system" />
          <ExamErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/locked" element={<LockedAccountPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route
                  path="/onboarding"
                  element={
                    <ProtectedRoute blockIfOnboarded>
                      <OnboardingPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pay"
                  element={
                    <ProtectedRoute requireLevel blockIfActive>
                      <PayPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/pay/return"
                  element={
                    <ProtectedRoute requireLevel>
                      <PayReturnPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app"
                  element={
                    <ProtectedRoute requireLevel>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/exam"
                  element={
                    <ProtectedRoute requireLevel requireActive allowTrialExam>
                      <ExamPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/flashcards"
                  element={
                    <ProtectedRoute requireLevel requireActive>
                      <FlashcardsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/profile"
                  element={
                    <ProtectedRoute requireLevel>
                      <ProfilePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/app/leaderboard"
                  element={
                    <ProtectedRoute requireLevel>
                      <LeaderboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <AdminRoute>
                      <AdminLayout />
                    </AdminRoute>
                  }
                >
                  <Route index element={<AdminOverviewPage />} />
                  <Route path="overview" element={<Navigate to="/admin" replace />} />
                  <Route path="students" element={<AdminStudentsPage />} />
                  <Route path="questions" element={<AdminQuestionsPage />} />
                  <Route path="timetable" element={<AdminTimetablePage />} />
                  <Route path="leaderboard" element={<AdminLeaderboardPage />} />
                  <Route path="payments" element={<AdminPaymentsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </ExamErrorBoundary>
        </SessionGuardWrapper>
      </AuthProvider>
    </BrowserRouter>
  )
}
