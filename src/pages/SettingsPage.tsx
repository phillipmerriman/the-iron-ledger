import { useAuth } from '@/contexts/AuthContext'
import type { WeightUnit } from '@/types/common'
import { WEIGHT_UNIT_OPTIONS } from '@/types/common'

const PREF_WEIGHT_OPTIONS = WEIGHT_UNIT_OPTIONS.filter((o) => o.value !== 'bodyweight')

export default function SettingsPage() {
  const { profile, updateProfile } = useAuth()

  function handleWeightUnitChange(value: string) {
    updateProfile({ preferred_weight_unit: value as 'lbs' | 'kg' | 'pood' })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="max-w-md space-y-4">
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
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
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
