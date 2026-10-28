import { addDays, endOfWeek, format, startOfWeek } from 'date-fns'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import type { Program, ProgramActivation, WorkoutSession } from '@/types/database'
import type { WeightUnit } from '@/types/common'
import { calcEntryVolume, calcTotalReps, convertWeight } from '@/types/common'
import {
  buildStages,
  entryValuesFor,
  generateSchedule,
  parseWildmanConfig,
  parseWildmanProgress,
  sessionsForStage,
} from './wildman'

/**
 * The calendar day a workout session belongs to. Calendar "mark complete" stores the day as
 * `yyyy-MM-ddT09:00:00.000Z`, so read that date literally; live sessions use local time.
 */
function sessionDateKey(ws: WorkoutSession): string {
  if (ws.started_at.endsWith('T09:00:00.000Z')) return ws.started_at.slice(0, 10)
  return format(new Date(ws.started_at), 'yyyy-MM-dd')
}

/** `${date}|${slot}` for every completed workout session (slot from the `session:<slot>` notes tag) */
export function completedSlotKeys(sessions: WorkoutSession[]): Set<string> {
  const keys = new Set<string>()
  for (const ws of sessions) {
    if (!ws.completed_at) continue
    const slot = ws.notes?.match(/^session:(.+)$/)?.[1] ?? 'all'
    keys.add(`${sessionDateKey(ws)}|${slot}`)
  }
  return keys
}

export function isEntryDone(entry: Pick<PlannedEntry, 'date' | 'session'>, keys: Set<string>) {
  return keys.has(`${entry.date}|${entry.session}`) || keys.has(`${entry.date}|all`)
}

export interface ProgressCount {
  done: number
  total: number
}

export interface ProgramProgress {
  /** Workouts done / scheduled in the current Sunday–Saturday week */
  week: ProgressCount
  /** 0–100 */
  totalPercent: number
  /** e.g. "12 / 56 workouts" or "Stage 3 of 16" */
  totalLabel: string
}

/** One workout = one date + time slot, however many exercises it has */
function workoutSlots<T extends Pick<PlannedEntry, 'date' | 'session'>>(entries: T[]) {
  const slots = new Map<string, T>()
  for (const e of entries) slots.set(`${e.date}|${e.session}`, e)
  return [...slots.values()]
}

/**
 * Week and overall progress for an active program.
 * Overall = done ÷ (done + still scheduled), so missed days don't count against it.
 * Manual-progression templates only schedule a rolling window, so their overall progress is by stage.
 */
export function programProgress(
  program: Program,
  activation: ProgramActivation,
  activationEntries: PlannedEntry[],
  doneKeys: Set<string>,
  today: Date = new Date(),
): ProgramProgress {
  const todayKey = format(today, 'yyyy-MM-dd')
  const weekStart = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd')
  const slots = workoutSlots(activationEntries)

  const weekSlots = slots.filter((e) => e.date >= weekStart && e.date <= weekEnd)
  const week = { done: weekSlots.filter((e) => isEntryDone(e, doneKeys)).length, total: weekSlots.length }

  const config = program.template_type === 'wildman_reverse_ladder' ? parseWildmanConfig(program.template_config) : null
  const progress = config ? parseWildmanProgress(activation.progress, config, activation.start_date) : null

  if (config && progress && config.increment_mode === 'manual') {
    const stages = buildStages(config)
    const stage = stages[Math.min(progress.stage_index, stages.length - 1)]
    const inStage = slots.filter((e) => e.date >= progress.stage_started_on && isEntryDone(e, doneKeys)).length
    const fraction = Math.min(1, inStage / sessionsForStage(stage, progress.extra_sessions, config))
    return {
      week,
      totalPercent: Math.round(((progress.stage_index + fraction) / stages.length) * 100),
      totalLabel: `Stage ${progress.stage_index + 1} of ${stages.length}`,
    }
  }

  // Template cycles restart the count; basic programs count from activation
  const since = progress?.cycle_started_on ?? activation.start_date
  const done = slots.filter((e) => e.date >= since && isEntryDone(e, doneKeys)).length
  const remaining = slots.filter((e) => e.date >= todayKey && !isEntryDone(e, doneKeys)).length
  const total = done + remaining
  return {
    week,
    totalPercent: total > 0 ? Math.round((done / total) * 100) : 0,
    totalLabel: `${done} / ${total} workouts`,
  }
}

type WorkItem = Pick<PlannedEntry, 'date' | 'session' | 'sets' | 'reps' | 'rep_type' | 'reps_right' | 'weight' | 'weight_unit'>

export interface ProgramStats {
  /** Last scheduled workout; for manual progression, assuming the default pace from today */
  projectedEnd: string | null
  workoutsDone: number
  workoutsLeft: number
  repsDone: number
  repsTotal: number
  /** In the preferred unit; 0 when everything is bodyweight */
  volumeDone: number
  volumeTotal: number
  heaviestWorkout: number
  /** Minutes of every-minute work still to do (per-minute rep types) */
  emomMinutesLeft: number
  /** Total planned volume ÷ body weight, when a body weight is known */
  bodyWeightMultiple: number | null
}

/**
 * Live version of the setup wizard's projection: what's done so far this cycle plus everything
 * still scheduled (including push-backs and moved days), so the numbers update as you train.
 */
export function programStats(
  program: Program,
  activation: ProgramActivation,
  activationEntries: PlannedEntry[],
  doneKeys: Set<string>,
  preferredUnit: WeightUnit,
  bodyWeight: { value: number; unit: WeightUnit } | null,
  today: Date = new Date(),
): ProgramStats {
  const todayKey = format(today, 'yyyy-MM-dd')
  const config = program.template_type === 'wildman_reverse_ladder' ? parseWildmanConfig(program.template_config) : null
  const progress = config ? parseWildmanProgress(activation.progress, config, activation.start_date) : null
  const since = progress?.cycle_started_on ?? activation.start_date

  const doneItems: WorkItem[] = activationEntries.filter((e) => e.date >= since && isEntryDone(e, doneKeys))
  let leftItems: WorkItem[] = activationEntries.filter((e) => e.date >= todayKey && !isEntryDone(e, doneKeys))

  // Manual progression only schedules a rolling window — project the rest of the cycle at the default pace
  if (config && progress && config.increment_mode === 'manual') {
    const inStage = activationEntries.filter((e) => e.date >= progress.stage_started_on && isEntryDone(e, doneKeys))
    const from = activationEntries.some((e) => e.date === todayKey && isEntryDone(e, doneKeys))
      ? format(addDays(today, 1), 'yyyy-MM-dd')
      : todayKey
    leftItems = generateSchedule({ ...config, increment_mode: 'auto' }, progress, from, workoutSlots(inStage).length)
      .map((w) => entryValuesFor(config, progress, w))
  }

  const repsOf = (items: WorkItem[]) => items.reduce((sum, e) => sum + calcTotalReps(e.sets, e.reps, e.rep_type, e.reps_right), 0)
  const volumeOf = (e: WorkItem) => calcEntryVolume(e.sets, e.reps, e.rep_type, e.reps_right, e.weight, e.weight_unit, preferredUnit)

  // Volume per workout (date + slot), for the heaviest one
  const perWorkout = new Map<string, number>()
  for (const e of [...doneItems, ...leftItems]) {
    const key = `${e.date}|${e.session}`
    perWorkout.set(key, (perWorkout.get(key) ?? 0) + volumeOf(e))
  }

  const volumeDone = doneItems.reduce((sum, e) => sum + volumeOf(e), 0)
  const volumeTotal = volumeDone + leftItems.reduce((sum, e) => sum + volumeOf(e), 0)
  const emomMinutesLeft = leftItems
    .filter((e) => e.rep_type.endsWith('_per_minute') && e.rep_type !== 'reps_per_minute' && e.rep_type !== 'left_right_per_minute')
    .reduce((sum, e) => sum + (e.sets ?? 0) * (e.reps ?? 0), 0)

  let bodyWeightMultiple: number | null = null
  if (bodyWeight && bodyWeight.value > 0 && volumeTotal > 0) {
    bodyWeightMultiple = volumeTotal / convertWeight(bodyWeight.value, bodyWeight.unit, preferredUnit)
  }

  const allDates = [...doneItems, ...leftItems].map((e) => e.date).sort()
  return {
    projectedEnd: allDates.length ? allDates[allDates.length - 1] : null,
    workoutsDone: workoutSlots(doneItems).length,
    workoutsLeft: workoutSlots(leftItems).length,
    repsDone: repsOf(doneItems),
    repsTotal: repsOf(doneItems) + repsOf(leftItems),
    volumeDone,
    volumeTotal,
    heaviestWorkout: Math.max(0, ...perWorkout.values()),
    emomMinutesLeft,
    bodyWeightMultiple,
  }
}
