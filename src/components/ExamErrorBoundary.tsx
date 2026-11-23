import React, { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ExamErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ExamErrorBoundary] Caught runtime error:', error, info)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg text-text flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-border bg-surface p-6 sm:p-8 rounded-3xl shadow-xl space-y-4 text-center">
            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-2xl flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">Display Interrupted</h2>
            <p className="text-xs sm:text-sm text-muted leading-relaxed">
              A temporary display error occurred. Your recorded examination answers and remaining time are preserved.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-primary text-on-primary py-3 px-4 rounded-xl font-bold text-xs hover:opacity-95 shadow-xs"
              >
                Reload & Resume
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
