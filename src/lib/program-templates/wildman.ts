import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { RepType, WeightUnit } from '@/types/common'
import { calcTotalReps, convertWeight, formatReps } from '@/types/common'
import type { WildmanConfig, WildmanProgress, WildmanStage, ScheduleOverride } from '@/types/program-templates'

/** Rep types that make sense for a reverse-ladder program */
export const WILDMAN_REP_TYPES: { value: RepType; label: string }[] = [
  { value: 'double_reverse_ladder', label: 'Double Reverse Ladder (per arm, e.g. 3/3 2/2 1/1)' },
  { value: 'double_reverse_ladder_per_minute', label: 'Double Reverse Ladder / Min (EMOM)' },
  { value: 'reverse_ladder', label: 'Reverse Ladder (e.g. 3/2/1)' },
  { value: 'reverse_ladder_per_minute', label: 'Reverse Ladder / Min (EMOM)' },
]

/** In manual mode, how far ahead the current stage is repeated on the calendar */
const MANUAL_WINDOW_WEEKS = 8

export function stageKey(stage: WildmanStage): string {
  return `${stage.sets}x${stage.topReps}`
}

/** Every stage of one cycle, in order: for each set count, every top-rung value */
export function buildStages(config: Pick<WildmanConfig, 'min_sets' | 'max_sets' | 'min_reps' | 'max_reps'>): WildmanStage[] {
  const stages: WildmanStage[] = []
  for (let sets = config.min_sets; sets <= config.max_sets; sets++) {
    for (let topReps = config.min_reps; topReps <= config.max_reps; topReps++) {
      stages.push({ sets, topReps })
    }
  }
  return stages
}

/** e.g. "3 × 4/4, 3/3, 2/2, 1/1" */
export function stageLabel(stage: WildmanStage, repType: RepType): string {
  return `${stage.sets} × ${formatReps(repType, stage.topReps)}`
}

export function defaultSessionsForStage(stage: WildmanStage): number {
  return stage.topReps
}

export function sessionsForStage(stage: WildmanStage, extraSessions: number): number {
  return Math.max(1, stage.topReps + extraSessions)
}

export function initialProgress(config: WildmanConfig, startDate: string): WildmanProgress {
  return {
    stage_index: 0,
    stage_started_on: startDate,
    extra_sessions: 0,
    weight: config.weight,
    weight_unit: config.weight_unit,
    cycle: 1,
    overrides: [],
    synced_on: format(new Date(), 'yyyy-MM-dd'),
  }
}

/**
 * The next `count` training dates on/after `fromDate`, following the selected weekdays.
 * One-off moves (overrides) replace the date the generator would have used.
 */
export function trainingDates(
  daysOfWeek: number[],
  fromDate: string,
  count: number,
  overrides: ScheduleOverride[] = [],
): string[] {
  if (daysOfWeek.length === 0 || count <= 0) return []
  const start = parseISO(fromDate)
  // Generous window: enough weeks for `count` sessions plus room for moved workouts
  const windowDays = Math.ceil(count / daysOfWeek.length) * 7 + 14
  const overrideMap = new Map(overrides.map((o) => [o.from, o.to]))
  const dates: string[] = []
  for (let i = 0; i < windowDays; i++) {
    const d = addDays(start, i)
    if (!daysOfWeek.includes(d.getDay())) continue
    const key = format(d, 'yyyy-MM-dd')
    const date = overrideMap.get(key) ?? key
    if (date >= fromDate) dates.push(date)
  }
  return dates.sort().slice(0, count)
}

export interface ScheduledWorkout {
  date: string
  stageIndex: number
  stage: WildmanStage
}

/**
 * Lay out the remaining workouts of the current cycle from `fromDate`.
 * Auto mode: the current stage gets its remaining sessions, later stages their defaults.
 * Manual mode: the current stage repeats until the user progresses.
 */
export function generateSchedule(
  config: WildmanConfig,
  progress: WildmanProgress,
  fromDate: string,
  completedInStage: number,
): ScheduledWorkout[] {
  const stages = buildStages(config)
  const current = stages[progress.stage_index]
  if (!current) return []

  const plan: { stageIndex: number; count: number }[] = []
  if (config.increment_mode === 'manual') {
    plan.push({ stageIndex: progress.stage_index, count: config.days_of_week.length * MANUAL_WINDOW_WEEKS })
  } else {
    const remaining = Math.max(0, sessionsForStage(current, progress.extra_sessions) - completedInStage)
    plan.push({ stageIndex: progress.stage_index, count: remaining })
    for (let i = progress.stage_index + 1; i < stages.length; i++) {
      plan.push({ stageIndex: i, count: defaultSessionsForStage(stages[i]) })
    }
  }

  const total = plan.reduce((sum, p) => sum + p.count, 0)
  const dates = trainingDates(config.days_of_week, fromDate, total, progress.overrides)
  const result: ScheduledWorkout[] = []
  let cursor = 0
  for (const { stageIndex, count } of plan) {
    for (let i = 0; i < count && cursor < dates.length; i++) {
      result.push({ date: dates[cursor++], stageIndex, stage: stages[stageIndex] })
    }
  }
  return result
}

/** Planned-entry values for a scheduled workout */
export function entryValuesFor(config: WildmanConfig, progress: WildmanProgress, workout: ScheduledWorkout) {
  return {
    date: workout.date,
    session: config.session,
    exercise_id: config.exercise_id,
    sets: workout.stage.sets,
    reps: workout.stage.topReps,
    rep_type: config.rep_type,
    reps_right: null,
    weight: progress.weight_unit === 'bodyweight' ? null : progress.weight,
    weight_unit: progress.weight_unit,
    intensity: null,
    notes: null,
    timer_id: config.stage_timers[stageKey(workout.stage)] ?? null,
    set_markers: false,
  }
}

/** Fun comparisons for total weight moved, heaviest first */
const WEIGHT_EQUIVALENTS: { name: string; lbs: number }[] = [
  { name: 'blue whales', lbs: 300_000 },
  { name: 'elephants', lbs: 13_000 },
  { name: 'cars', lbs: 4_000 },
  { name: 'grand pianos', lbs: 1_000 },
  { name: 'refrigerators', lbs: 250 },
]

export function weightEquivalent(amount: number, unit: WeightUnit): string | null {
  if (unit === 'bodyweight' || amount <= 0) return null
  const lbs = convertWeight(amount, unit, 'lbs')
  const match = WEIGHT_EQUIVALENTS.find((e) => lbs / e.lbs >= 1)
  if (!match) return null
  const n = lbs / match.lbs
  return `≈ ${n >= 10 ? Math.round(n).toLocaleString() : n.toFixed(1)} ${match.name}`
}

export interface WildmanProjection {
  startDate: string | null
  endDate: string | null
  totalWeeks: number
  totalSessions: number
  totalStages: number
  totalReps: number
  firstSessionReps: number
  lastSessionReps: number
  /** In the preferred unit; 0 for bodyweight */
  totalVolume: number
  heaviestSessionVolume: number
  /** Total minutes of EMOM work (per-minute rep types only) */
  emomMinutes: number
  /** Total volume ÷ body weight, when a body weight was given */
  bodyWeightMultiple: number | null
}

/** Project one full cycle at the default pace (no push-backs) */
export function projectStats(config: WildmanConfig, startDate: string, preferredUnit: WeightUnit): WildmanProjection {
  const progress = initialProgress(config, startDate)
  const schedule = generateSchedule({ ...config, increment_mode: 'auto' }, progress, startDate, 0)
  const repsFor = (s: WildmanStage) => calcTotalReps(s.sets, s.topReps, config.rep_type, null)
  const weightInPref =
    config.weight != null && config.weight_unit !== 'bodyweight'
      ? convertWeight(config.weight, config.weight_unit, preferredUnit)
      : 0

  let totalReps = 0
  let heaviest = 0
  let emomMinutes = 0
  const perMinute = config.rep_type.endsWith('_per_minute')
  for (const w of schedule) {
    const reps = repsFor(w.stage)
    totalReps += reps
    heaviest = Math.max(heaviest, reps * weightInPref)
    if (perMinute) emomMinutes += w.stage.sets * w.stage.topReps
  }
  const totalVolume = Math.round(totalReps * weightInPref)

  const startOn = schedule[0]?.date ?? null
  const endOn = schedule[schedule.length - 1]?.date ?? null
  const totalWeeks = startOn && endOn
    ? Math.ceil((differenceInCalendarDays(parseISO(endOn), parseISO(startDate)) + 1) / 7)
    : 0

  let bodyWeightMultiple: number | null = null
  if (config.body_weight && config.body_weight > 0 && totalVolume > 0) {
    const bw = convertWeight(config.body_weight, config.body_weight_unit, preferredUnit)
    bodyWeightMultiple = bw > 0 ? totalVolume / bw : null
  }

  return {
    startDate: startOn,
    endDate: endOn,
    totalWeeks,
    totalSessions: schedule.length,
    totalStages: buildStages(config).length,
    totalReps,
    firstSessionReps: schedule[0] ? repsFor(schedule[0].stage) : 0,
    lastSessionReps: schedule.length ? repsFor(schedule[schedule.length - 1].stage) : 0,
    totalVolume,
    heaviestSessionVolume: Math.round(heaviest),
    emomMinutes,
    bodyWeightMultiple,
  }
}

/** Parse stored JSON config/progress defensively (older rows may miss fields) */
export function parseWildmanConfig(raw: unknown): WildmanConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Partial<WildmanConfig>
  if (!c.exercise_id || !c.rep_type) return null
  return {
    exercise_id: c.exercise_id,
    rep_type: c.rep_type,
    min_reps: c.min_reps ?? 2,
    max_reps: c.max_reps ?? 5,
    min_sets: c.min_sets ?? 2,
    max_sets: c.max_sets ?? 5,
    weight: c.weight ?? null,
    weight_unit: c.weight_unit ?? 'lbs',
    body_weight: c.body_weight ?? null,
    body_weight_unit: c.body_weight_unit ?? 'lbs',
    stage_timers: c.stage_timers ?? {},
    session: c.session ?? 'morning',
    days_of_week: c.days_of_week ?? [1, 3, 5],
    increment_mode: c.increment_mode ?? 'auto',
  }
}

export function parseWildmanProgress(raw: unknown, config: WildmanConfig, fallbackStart: string): WildmanProgress {
  const base = initialProgress(config, fallbackStart)
  if (!raw || typeof raw !== 'object') return base
  return { ...base, ...(raw as Partial<WildmanProgress>) }
}
