import { useEffect, useState } from 'react'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    return (localStorage.getItem('nursingprep_theme') as 'system' | 'light' | 'dark') || 'system'
  })

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
      localStorage.setItem('nursingprep_theme', 'dark')
    } else if (theme === 'light') {
      root.classList.add('light')
      root.classList.remove('dark')
      localStorage.setItem('nursingprep_theme', 'light')
    } else {
      root.classList.remove('dark')
      root.classList.remove('light')
      localStorage.removeItem('nursingprep_theme')
    }
  }, [theme])

  const toggleTheme = () => {
    if (theme === 'system') setTheme('dark')
    else if (theme === 'dark') setTheme('light')
    else setTheme('system')
  }

  const getLabel = () => {
    if (theme === 'dark') return '🌙 Dark'
    if (theme === 'light') return '☀️ Light'
    return '💻 Auto'
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Theme: ${theme}. Click to switch between System, Dark, and Light.`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border border-border bg-surface hover:border-accent text-text transition-all motion-safe:active:scale-95 ${className}`}
      aria-label="Toggle theme mode"
    >
      <span>{getLabel()}</span>
    </button>
  )
}
