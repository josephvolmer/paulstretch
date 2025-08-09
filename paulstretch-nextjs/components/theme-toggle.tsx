'use client'

import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Only render after hydration to avoid server/client mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleThemeChange = () => {
    if (theme === 'light') {
      setTheme('dark')
    } else if (theme === 'dark') {
      setTheme('system')
    } else {
      setTheme('light')
    }
  }

  const getIcon = () => {
    if (!mounted) {
      // Return a placeholder during SSR to match initial render
      return <Monitor className="h-4 w-4" />
    }
    
    if (theme === 'light') {
      return <Sun className="h-4 w-4" />
    }
    if (theme === 'dark') {
      return <Moon className="h-4 w-4" />
    }
    return <Monitor className="h-4 w-4" />
  }

  return (
    <button
      onClick={handleThemeChange}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full",
        "bg-muted/50 hover:bg-muted/70 transition-all duration-200",
        "border border-border/50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
      aria-label="Toggle theme"
    >
      {getIcon()}
    </button>
  )
}