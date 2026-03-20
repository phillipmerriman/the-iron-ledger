import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { WEIGHT_UNIT_OPTIONS } from '@/types/common'
import { Sun, Moon } from 'lucide-react'

const PREF_WEIGHT_OPTIONS = WEIGHT_UNIT_OPTIONS.filter((o) => o.value !== 'bodyweight')

export default function SettingsPage() {
  const { profile, updateProfile } = useAuth()
  const { theme, toggle } = useTheme()

  function handleWeightUnitChange(value: string) {
    updateProfile({ preferred_weight_unit: value as 'lbs' | 'kg' | 'pood' })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="max-w-md space-y-4">
        {/* Theme */}
        <div>
          <label className="text-sm font-medium text-surface-700">Theme</label>
          <p className="mb-1.5 text-xs text-surface-500">
            Switch between light and dark mode.
          </p>
          <button
            onClick={toggle}
            className="flex items-center gap-3 rounded-lg border border-surface-200 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-hover"
          >
            {theme === 'dark' ? (
              <>
                <Moon className="h-4 w-4 text-purple-400" />
                Dark
              </>
            ) : (
              <>
                <Sun className="h-4 w-4 text-warning-500" />
                Light
              </>
            )}
            <span className="ml-auto text-xs text-surface-400">Click to toggle</span>
          </button>
        </div>

        {/* Weight Unit */}
        <div>
          <label className="text-sm font-medium text-surface-700">
            Preferred Weight Unit
          </label>
          <p className="mb-1.5 text-xs text-surface-500">
            Weights entered in other units will show a conversion in parentheses.
          </p>
          <select
            value={profile?.preferred_weight_unit ?? 'lbs'}
            onChange={(e) => handleWeightUnitChange(e.target.value)}
            className="w-full rounded-lg border border-surface-200 bg-input-bg px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            {PREF_WEIGHT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
