import { useState, type FormEvent } from 'react'
import { X, ChevronDown } from 'lucide-react'
import type { Exercise } from '@/types/database'
import type { ExerciseType, ExerciseRate, MuscleGroup, Equipment, RepType, WeightUnit } from '@/types/common'
import { EXERCISE_COLORS, type ExerciseColor, REP_TYPE_OPTIONS, WEIGHT_UNIT_OPTIONS } from '@/types/common'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'

const exerciseTypeOptions: { value: ExerciseType; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'flexibility', label: 'Flexibility' },
  { value: 'warm_up', label: 'Warm Up' },
  { value: 'cool_down', label: 'Cool Down' },
  { value: 'other', label: 'Other' },
]

const muscleOptions: { value: MuscleGroup; label: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'forearms', label: 'Forearms' },
  { value: 'core', label: 'Core' },
  { value: 'quads', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'full_body', label: 'Full Body' },
  { value: 'upper_body', label: 'Upper Body' },
  { value: 'lower_body', label: 'Lower Body' },
  { value: 'other', label: 'Other' },
]

const exerciseRateOptions: { value: string; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'ballistic', label: 'Ballistic' },
  { value: 'grind', label: 'Grind' },
]

const equipmentOptions: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'machine', label: 'Machine' },
  { value: 'cable', label: 'Cable' },
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'band', label: 'Band' },
  { value: 'steel_mace', label: 'Steel Mace' },
  { value: 'steel_club', label: 'Steel Club' },
  { value: 'other', label: 'Other' },
]

interface ExerciseFormProps {
  initial?: Exercise | null
  onSubmit: (values: {
    name: string
    exercise_type: ExerciseType
    exercise_rate: ExerciseRate | null
    primary_muscle: MuscleGroup
    equipment: Equipment
    color: string | null
    notes: string
    default_sets: number | null
    default_reps: number | null
    default_rep_type: RepType
    default_weight: number | null
    default_weight_unit: WeightUnit
    default_intensity: 'light' | 'heavy' | null
  }) => Promise<void>
  onCancel: () => void
  submitting?: boolean
  loading?: boolean
}

export default function ExerciseForm({ initial, onSubmit, onCancel, submitting, loading }: ExerciseFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [exerciseType, setExerciseType] = useState<ExerciseType>(
    (initial?.exercise_type as ExerciseType) ?? 'strength',
  )
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup>(
    (initial?.primary_muscle as MuscleGroup) ?? 'other',
  )
  const [exerciseRate, setExerciseRate] = useState<ExerciseRate | null>(
    (initial?.exercise_rate as ExerciseRate) ?? null,
  )
  const [equipment, setEquipment] = useState<Equipment>(
    (initial?.equipment as Equipment) ?? 'bodyweight',
  )
  const [color, setColor] = useState<ExerciseColor | null>(
    (initial?.color as ExerciseColor) ?? null,
  )
  const [notes, setNotes] = useState(initial?.notes ?? '')

  // Defaults
  const [showDefaults, setShowDefaults] = useState(() => {
    if (!initial) return false
    return initial.default_sets != null || initial.default_reps != null || initial.default_weight != null || initial.default_intensity != null
  })
  const [defaultSets, setDefaultSets] = useState<number | ''>(initial?.default_sets ?? '')
  const [defaultReps, setDefaultReps] = useState<number | ''>(initial?.default_reps ?? '')
  const [defaultRepType, setDefaultRepType] = useState<RepType>((initial?.default_rep_type as RepType) ?? 'single')
  const [defaultWeight, setDefaultWeight] = useState<number | ''>(initial?.default_weight ?? '')
  const [defaultWeightUnit, setDefaultWeightUnit] = useState<WeightUnit>((initial?.default_weight_unit as WeightUnit) ?? 'lbs')
  const [defaultIntensity, setDefaultIntensity] = useState<'light' | 'heavy' | null>(initial?.default_intensity ?? null)

  // Time fields for default reps when rep_type is 'time'
  const [defaultTimeMin, setDefaultTimeMin] = useState(() =>
    defaultRepType === 'time' && initial?.default_reps != null ? Math.floor(initial.default_reps / 60) : 0,
  )
  const [defaultTimeSec, setDefaultTimeSec] = useState(() =>
    defaultRepType === 'time' && initial?.default_reps != null ? initial.default_reps % 60 : 0,
  )

  const isSubmitting = submitting || loading

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const resolvedDefaultReps = defaultRepType === 'time'
      ? (Number(defaultTimeMin) || 0) * 60 + (Number(defaultTimeSec) || 0) || null
      : defaultReps === '' ? null : Number(defaultReps)

    await onSubmit({
      name: name.trim(),
      exercise_type: exerciseType,
      exercise_rate: exerciseRate,
      primary_muscle: primaryMuscle,
      equipment,
      color,
      notes: notes.trim(),
      default_sets: defaultSets === '' ? null : Number(defaultSets),
      default_reps: resolvedDefaultReps,
      default_rep_type: defaultRepType,
      default_weight: defaultWeightUnit === 'bodyweight' ? null : (defaultWeight === '' ? null : Number(defaultWeight)),
      default_weight_unit: defaultWeightUnit,
      default_intensity: defaultIntensity,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="exercise-name"
        label="Name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        onClear={() => setName('')}
        placeholder="e.g. Bench Press"
      />

      <Select
        id="exercise-type"
        label="Type"
        value={exerciseType}
        onChange={(e) => setExerciseType(e.target.value as ExerciseType)}
        options={exerciseTypeOptions}
      />

      <Select
        id="primary-muscle"
        label="Primary Muscle"
        value={primaryMuscle}
        onChange={(e) => setPrimaryMuscle(e.target.value as MuscleGroup)}
        options={muscleOptions}
      />

      <Select
        id="exercise-rate"
        label="Rate"
        value={exerciseRate ?? ''}
        onChange={(e) => setExerciseRate((e.target.value || null) as ExerciseRate | null)}
        options={exerciseRateOptions}
      />

      <Select
        id="equipment"
        label="Equipment"
        value={equipment}
        onChange={(e) => setEquipment(e.target.value as Equipment)}
        options={equipmentOptions}
      />

      {/* Color picker */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-surface-700">Color</label>
        <div className="flex flex-wrap gap-1.5">
          {EXERCISE_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(color === c.value ? null : c.value as ExerciseColor)}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                c.bg,
                color === c.value ? 'border-surface-900 ring-2 ring-surface-400 scale-110' : 'border-transparent',
              )}
              aria-label={c.label}
              title={c.label}
            />
          ))}
        </div>
      </div>

      {/* Defaults section */}
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setShowDefaults((p) => !p)}
          className="flex w-full items-center gap-1 text-sm font-medium text-surface-700 hover:text-surface-900"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', !showDefaults && '-rotate-90')} />
          Defaults
          <span className="ml-1 text-xs font-normal text-surface-400">— auto-fill when adding to plan</span>
        </button>
        {showDefaults && (
          <div className="space-y-3 rounded-lg border border-surface-200 bg-surface-50 p-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-surface-600">Sets</label>
                <input
                  type="number"
                  min={1}
                  value={defaultSets}
                  onChange={(e) => setDefaultSets(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="3"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-surface-600">Rep Type</label>
                <select
                  value={defaultRepType}
                  onChange={(e) => setDefaultRepType(e.target.value as RepType)}
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {REP_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reps / Duration */}
            {defaultRepType === 'time' ? (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-surface-600">Duration</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    value={defaultTimeMin}
                    onChange={(e) => setDefaultTimeMin(e.target.value === '' ? 0 : Number(e.target.value))}
                    className="w-16 rounded-lg border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="0"
                  />
                  <span className="text-xs text-surface-400">min</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={defaultTimeSec}
                    onChange={(e) => setDefaultTimeSec(e.target.value === '' ? 0 : Math.min(59, Number(e.target.value)))}
                    className="w-16 rounded-lg border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="0"
                  />
                  <span className="text-xs text-surface-400">sec</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-xs font-medium text-surface-600">Reps</label>
                <input
                  type="number"
                  min={1}
                  value={defaultReps}
                  onChange={(e) => setDefaultReps(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full rounded-lg border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  placeholder="10"
                />
              </div>
            )}

            {/* Weight */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-surface-600">Weight</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={defaultWeightUnit === 'bodyweight' ? '' : defaultWeight}
                  onChange={(e) => setDefaultWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={defaultWeightUnit === 'bodyweight'}
                  className="min-w-0 flex-1 rounded-lg border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-surface-100 disabled:text-surface-400"
                  placeholder={defaultWeightUnit === 'bodyweight' ? 'Bodyweight' : '0'}
                />
                <select
                  value={defaultWeightUnit}
                  onChange={(e) => setDefaultWeightUnit(e.target.value as WeightUnit)}
                  className="w-20 rounded-lg border border-surface-300 px-2 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {WEIGHT_UNIT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Intensity */}
            <div className="space-y-1">
              <label className="block text-xs font-medium text-surface-600">Intensity</label>
              <div className="flex gap-2">
                {(['light', 'heavy'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDefaultIntensity(defaultIntensity === opt ? null : opt)}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium capitalize transition-colors',
                      defaultIntensity === opt
                        ? opt === 'light'
                          ? 'border-info-500 bg-info-500/10 text-info-600'
                          : 'border-danger-500 bg-danger-500/10 text-danger-600'
                        : 'border-surface-200 text-surface-400 hover:border-surface-300',
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="exercise-notes" className="block text-sm font-medium text-surface-700">
          Notes
        </label>
        <div className="relative">
          <textarea
            id="exercise-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={cn(
              'block w-full rounded-lg border border-surface-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
              notes && 'pr-8',
            )}
            placeholder="Optional notes..."
          />
          {notes && (
            <button
              type="button"
              onClick={() => setNotes('')}
              className="absolute right-2 top-2 rounded p-0.5 text-surface-400 hover:text-surface-600"
              aria-label="Clear notes"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !name.trim()}>
          {initial ? 'Save Changes' : 'Add Exercise'}
        </Button>
      </div>
    </form>
  )
}
