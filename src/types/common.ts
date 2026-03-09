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
  Timer,
  TimerInterval,
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
  { value: 'slate', label: 'Slate', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700', dot: 'bg-slate-400' },
  { value: 'red', label: 'Red', bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-400' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700', dot: 'bg-orange-400' },
  { value: 'amber', label: 'Amber', bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700', dot: 'bg-amber-400' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  { value: 'lime', label: 'Lime', bg: 'bg-lime-100', border: 'border-lime-300', text: 'text-lime-700', dot: 'bg-lime-400' },
  { value: 'green', label: 'Green', bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-400' },
  { value: 'teal', label: 'Teal', bg: 'bg-teal-100', border: 'border-teal-300', text: 'text-teal-700', dot: 'bg-teal-400' },
  { value: 'cyan', label: 'Cyan', bg: 'bg-cyan-100', border: 'border-cyan-300', text: 'text-cyan-700', dot: 'bg-cyan-400' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-700', dot: 'bg-blue-400' },
  { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-700', dot: 'bg-indigo-400' },
  { value: 'violet', label: 'Violet', bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-700', dot: 'bg-violet-400' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700', dot: 'bg-purple-400' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-100', border: 'border-pink-300', text: 'text-pink-700', dot: 'bg-pink-400' },
  { value: 'rose', label: 'Rose', bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-700', dot: 'bg-rose-400' },
] as const

export type ExerciseColor = (typeof EXERCISE_COLORS)[number]['value']

const NO_COLOR = { value: '', label: 'None', bg: '', border: '', text: '', dot: '' } as const

export function getExerciseColorClasses(color: string | null) {
  if (!color) return NO_COLOR
  return EXERCISE_COLORS.find((c) => c.value === color) ?? NO_COLOR
}

export type UnitSystem = 'imperial' | 'metric'

export type RecordType = 'max_weight' | 'max_reps' | 'max_volume' | 'max_duration'

export type RepType = 'single' | 'left_right' | 'reverse_ladder' | 'double_reverse_ladder' | 'ladder' | 'double_ladder' | 'time' | 'reps_per_minute'

export type WeightUnit = 'lbs' | 'kg' | 'pood' | 'bodyweight'

export const REP_TYPE_OPTIONS: { value: RepType; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'left_right', label: 'Left / Right' },
  { value: 'reverse_ladder', label: 'Reverse Ladder' },
  { value: 'double_reverse_ladder', label: 'Double Reverse Ladder' },
  { value: 'ladder', label: 'Ladder' },
  { value: 'double_ladder', label: 'Double Ladder' },
  { value: 'time', label: 'Time' },
  { value: 'reps_per_minute', label: 'Reps / Min' },
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
    case 'reps_per_minute':
      return `${reps}/min × ${repsRight ?? 1}min`
    default:
      return `${reps}`
  }
}

/** Calculate total reps for an entry, accounting for rep type (ladders, left/right, etc.) */
export function calcTotalReps(
  sets: number | null,
  reps: number | null,
  repType: RepType,
  repsRight: number | null,
): number {
  if (sets == null || reps == null) return 0
  if (repType === 'time') return 0

  switch (repType) {
    case 'reverse_ladder':
      // n + (n-1) + ... + 1 = n*(n+1)/2
      return sets * (reps * (reps + 1)) / 2
    case 'ladder':
      // 1+2+...+n+(n-1)+...+1 = n²
      return sets * reps * reps
    case 'double_reverse_ladder':
      // Both sides: 2 × n*(n+1)/2
      return sets * reps * (reps + 1)
    case 'double_ladder':
      // Both sides of ladder: 2 × n²
      return sets * 2 * reps * reps
    case 'left_right':
      return sets * (reps + (repsRight ?? reps))
    case 'reps_per_minute':
      return sets * reps * (repsRight ?? 1)
    default:
      return sets * reps
  }
}

/** Calculate total weight moved (volume) for a planned entry, in the preferred unit. */
export function calcEntryVolume(
  sets: number | null,
  reps: number | null,
  repType: RepType,
  repsRight: number | null,
  weight: number | null,
  weightUnit: WeightUnit,
  preferredUnit: WeightUnit,
): number {
  if (weight == null || weightUnit === 'bodyweight') return 0
  const totalReps = calcTotalReps(sets, reps, repType, repsRight)
  if (totalReps === 0) return 0
  const normalizedWeight = convertWeight(weight, weightUnit, preferredUnit)
  return Math.round(totalReps * normalizedWeight)
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