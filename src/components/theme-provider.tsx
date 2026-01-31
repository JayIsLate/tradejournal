'use client'

import * as React from 'react'
import { db } from '@/lib/db'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>('dark')
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    // Load saved theme, default to dark
    db.getSetting('theme').then((savedTheme) => {
      if (savedTheme && ['dark', 'light', 'system'].includes(savedTheme)) {
        setThemeState(savedTheme as Theme)
      } else {
        // Set dark as default if no saved preference
        setThemeState('dark')
      }
    })
  }, [])

  React.useEffect(() => {
    if (!mounted) return

    const root = window.document.documentElement
    root.classList.remove('light', 'dark')

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      root.classList.add(systemTheme)
    } else {
      root.classList.add(theme)
    }
  }, [theme, mounted])

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    db.setSetting('theme', newTheme)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
