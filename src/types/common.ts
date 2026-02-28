// Re-export all DB row types for convenience
export type {
  Profile,
  Exercise,
  WorkoutTemplate,
  WorkoutTemplateExercise,
  WorkoutSession,
  WorkoutSet,
  Program,
  ProgramDay,
  ProgramDayExercise,
  PersonalRecord,
  BodyMeasurement,
  Tables,
  InsertDto,
  UpdateDto,
} from './database'

export type ExerciseType = 'strength' | 'cardio' | 'flexibility' | 'warm_up' | 'cool_down' | 'other'

export type ExerciseRate = 'ballistic' | 'grind'

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'forearms' | 'core' | 'quads' | 'hamstrings' | 'glutes'
  | 'calves' | 'full_body' | 'upper_body' | 'lower_body' | 'other'

export type Equipment =
  | 'barbell' | 'dumbbell' | 'machine' | 'cable'
  | 'bodyweight' | 'kettlebell' | 'band' | 'steel_mace' | 'steel_club' | 'other'

export const EXERCISE_COLORS = [
  { value: 'slate', label: 'Slate', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
  { value: 'red', label: 'Red', bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700' },
  { value: 'amber', label: 'Amber', bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700' },
  { value: 'lime', label: 'Lime', bg: 'bg-lime-100', border: 'border-lime-300', text: 'text-lime-700' },
  { value: 'green', label: 'Green', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700' },
  { value: 'teal', label: 'Teal', bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-700' },
  { value: 'cyan', label: 'Cyan', bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-700' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700' },
  { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-700' },
  { value: 'violet', label: 'Violet', bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-700' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700' },
  { value: 'rose', label: 'Rose', bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-700' },
] as const

export type ExerciseColor = (typeof EXERCISE_COLORS)[number]['value']

const NO_COLOR = { value: '', label: 'None', bg: '', border: '', text: '' } as const

export function getExerciseColorClasses(color: string | null) {
  if (!color) return NO_COLOR
  return EXERCISE_COLORS.find((c) => c.value === color) ?? NO_COLOR
}

export type UnitSystem = 'imperial' | 'metric'

export type RecordType = 'max_weight' | 'max_reps' | 'max_volume' | 'max_duration'

export type RepType = 'single' | 'left_right' | 'reverse_ladder' | 'double_reverse_ladder' | 'ladder' | 'double_ladder' | 'time'

export type WeightUnit = 'lbs' | 'kg' | 'pood' | 'bodyweight'

export const REP_TYPE_OPTIONS: { value: RepType; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'left_right', label: 'Left / Right' },
  { value: 'reverse_ladder', label: 'Reverse Ladder' },
  { value: 'double_reverse_ladder', label: 'Double Reverse Ladder' },
  { value: 'ladder', label: 'Ladder' },
  { value: 'double_ladder', label: 'Double Ladder' },
  { value: 'time', label: 'Time' },
]

export const WEIGHT_UNIT_OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: 'lbs', label: 'lbs' },
  { value: 'kg', label: 'kg' },
  { value: 'pood', label: 'pood' },
  { value: 'bodyweight', label: 'BW' },
]

export function formatReps(repType: RepType, reps: number | null, repsRight?: number | null): string {
  if (reps == null) return ''

  switch (repType) {
    case 'single':
      return `${reps}`
    case 'left_right':
      return `${reps}/${repsRight ?? reps}`
    case 'reverse_ladder': {
      const parts: number[] = []
      for (let i = reps; i >= 1; i--) parts.push(i)
      return parts.join('/')
    }
    case 'double_reverse_ladder': {
      const parts: string[] = []
      for (let i = reps; i >= 1; i--) parts.push(`${i}/${i}`)
      return parts.join(', ')
    }
    case 'ladder': {
      const up: number[] = []
      for (let i = 1; i <= reps; i++) up.push(i)
      const down: number[] = []
      for (let i = reps - 1; i >= 1; i--) down.push(i)
      return [...up, ...down].join('/')
    }
    case 'double_ladder': {
      const up: string[] = []
      for (let i = 1; i <= reps; i++) up.push(`${i}/${i}`)
      const down: string[] = []
      for (let i = reps - 1; i >= 1; i--) down.push(`${i}/${i}`)
      return [...up, ...down].join(', ')
    }
    case 'time': {
      const mins = Math.floor(reps / 60)
      const secs = reps % 60
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
    default:
      return `${reps}`
  }
}

/** Convert a weight value between units. Bodyweight is returned as-is. */
export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to || from === 'bodyweight' || to === 'bodyweight') return value
  // Convert to lbs first, then to target
  const toLbs: Record<string, number> = { lbs: 1, kg: 2.20462, pood: 36 }
  const lbs = value * toLbs[from]
  return lbs / toLbs[to]
}

/** Format weight with optional conversion parenthetical.
 *  e.g. "2pood (72lbs)" when preferred differs, or just "72lbs" when same. */
export function formatWeightWithConversion(
  weight: number | null,
  unit: WeightUnit,
  preferredUnit: WeightUnit,
): string {
  if (unit === 'bodyweight') return 'BW'
  if (weight == null) return ''
  if (unit === preferredUnit) return `${weight}${unit}`
  const converted = convertWeight(weight, unit, preferredUnit)
  const rounded = Math.round(converted * 10) / 10
  return `${weight}${unit} (${rounded}${preferredUnit})`
}