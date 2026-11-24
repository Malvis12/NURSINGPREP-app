import { useEffect, useState } from 'react'
import { Moon, Sun, Monitor } from 'lucide-react'

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

  const renderIcon = () => {
    if (theme === 'dark') return <Moon className="w-3.5 h-3.5 text-accent" />
    if (theme === 'light') return <Sun className="w-3.5 h-3.5 text-amber-500" />
    return <Monitor className="w-3.5 h-3.5 text-muted" />
  }

  const getLabel = () => {
    if (theme === 'dark') return 'Dark'
    if (theme === 'light') return 'Light'
    return 'Auto'
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={`Theme: ${theme}. Click to switch between System, Dark, and Light.`}
      className={`h-8 inline-flex items-center gap-1.5 px-2.5 text-xs font-semibold rounded-lg border border-border bg-bg/60 hover:bg-surface hover:border-accent text-text transition-all motion-safe:active:scale-95 ${className}`}
      aria-label="Toggle theme mode"
    >
      {renderIcon()}
      <span className="hidden sm:inline">{getLabel()}</span>
    </button>
  )
}
