import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark'
// Keep in sync with the inline script in index.html (applies the theme before first paint).
export const THEME_KEY = 'zamin.theme'
const THEME_COLOR: Record<Theme, string> = { light: '#0B4DB5', dark: '#0b1220' }

function readTheme(): Theme {
  try { return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light' } catch { return 'light' }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void } | null>(null)

/** Light by default; the choice is saved in localStorage and applied app-wide via the `.dark` class. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setState] = useState<Theme>(() => {
    const t = readTheme()
    applyTheme(t)
    return t
  })
  const setTheme = useCallback((t: Theme) => {
    try { localStorage.setItem(THEME_KEY, t) } catch { /* private mode: applies for this visit only */ }
    applyTheme(t)
    setState(t)
  }, [])
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}
