import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { ACTIVE_SKIN, SKINS, type SkinDef, type SkinId } from '@/lib/skins'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
  skin: SkinId
  skinDef: SkinDef
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'iron-ledger-theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
    return 'light'
  })

  const skin = ACTIVE_SKIN
  const skinDef = SKINS[skin]
  const isDark = skinDef.mode === 'dark' || theme === 'dark'

  // Layout effect so the skin is applied before first paint (no flash of the classic look)
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', isDark)
    root.dataset.skin = skin
  }, [isDark, skin])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  function setTheme(t: Theme) {
    setThemeState(t)
  }

  function toggle() {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle, skin, skinDef }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
