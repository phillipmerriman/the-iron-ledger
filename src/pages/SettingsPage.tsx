import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { WEIGHT_UNIT_OPTIONS } from '@/types/common'
import { cn } from '@/lib/utils'
import { Sun, Moon } from 'lucide-react'

const PREF_WEIGHT_OPTIONS = WEIGHT_UNIT_OPTIONS.filter((o) => o.value !== 'bodyweight')

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const

export default function SettingsPage() {
  const { profile, updateProfile } = useAuth()
  const { theme, setTheme, skinDef } = useTheme()

  function handleWeightUnitChange(value: string) {
    updateProfile({ preferred_weight_unit: value as 'lbs' | 'kg' | 'pood' })
  }

  // Body weight is edited locally and saved when the field loses focus
  const savedBodyWeight = profile?.body_weight != null ? String(profile.body_weight) : ''
  const [bodyWeight, setBodyWeight] = useState(savedBodyWeight)
  const [bodyWeightError, setBodyWeightError] = useState<string | null>(null)
  useEffect(() => { setBodyWeight(savedBodyWeight) }, [savedBodyWeight])

  async function saveBodyWeight() {
    const trimmed = bodyWeight.trim()
    const value = trimmed === '' ? null : Number(trimmed)
    if (value != null && !(value > 0)) {
      setBodyWeightError('Enter a body weight greater than zero, or leave it blank.')
      return
    }
    setBodyWeightError(null)
    if (value === (profile?.body_weight ?? null)) return
    try {
      await updateProfile({ body_weight: value })
    } catch (err) {
      console.error('Failed to save body weight', err)
      setBodyWeightError('Could not save your body weight. Check your connection and try again.')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="max-w-md space-y-4">
        {/* Theme (dark-only skins have no light mode to switch to) */}
        {skinDef.mode === 'switchable' && <div>
          <label className="text-sm font-medium text-surface-700">Theme</label>
          <p className="mb-1.5 text-xs text-surface-500">
            Switch between light and dark mode.
          </p>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2">
            {THEME_OPTIONS.map(({ value, label, Icon }) => {
              const selected = theme === value
              return (
                <button
                  key={value}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors',
                    selected
                      ? 'border-primary-500 bg-nav-active-bg text-nav-active-text'
                      : 'border-surface-200 text-text-secondary hover:bg-hover hover:text-text',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              )
            })}
          </div>
        </div>}

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

        {/* Body Weight */}
        <div>
          <label htmlFor="settings-body-weight" className="text-sm font-medium text-surface-700">
            Approximate Body Weight
          </label>
          <p className="mb-1.5 text-xs text-surface-500">
            Optional. Used to suggest working weights when setting up programs.
          </p>
          <div className="flex gap-2">
            <input
              id="settings-body-weight"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              placeholder="e.g. 180"
              value={bodyWeight}
              onChange={(e) => setBodyWeight(e.target.value)}
              onBlur={saveBodyWeight}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
              className="min-w-0 flex-1 rounded-lg border border-surface-200 bg-input-bg px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <select
              aria-label="Body weight unit"
              value={profile?.body_weight_unit ?? 'lbs'}
              onChange={(e) => updateProfile({ body_weight_unit: e.target.value as 'lbs' | 'kg' })}
              className="w-24 rounded-lg border border-surface-200 bg-input-bg px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="lbs">lbs</option>
              <option value="kg">kg</option>
            </select>
          </div>
          {bodyWeightError && (
            <div className="mt-1.5 flex items-start justify-between gap-2 text-xs text-danger-600">
              <span>{bodyWeightError}</span>
              <button type="button" onClick={() => setBodyWeightError(null)} className="font-medium underline">Dismiss</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
