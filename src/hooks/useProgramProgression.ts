import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import type usePrograms from '@/hooks/usePrograms'
import { assignEntryToProgram, deleteEntries, insertProgramEntries, loadProgramEntries, moveEntriesToDates, replaceProgramEntriesFrom } from '@/hooks/useWeeklyPlan'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import type { Json, Program, ProgramActivation, WorkoutSession } from '@/types/database'
import type { WeightUnit } from '@/types/common'
import type { WildmanConfig, WildmanProgress, WildmanStage } from '@/types/program-templates'
import {
  buildStages,
  defaultSessionsForStage,
  entryValuesFor,
  generateSchedule,
  parseWildmanConfig,
  parseWildmanProgress,
  sessionsForStage,
} from '@/lib/program-templates/wildman'
import { completedSlotKeys, isEntryDone, pushBackPlan, withoutSkippedDays } from '@/lib/program-templates/progress'
import type { PushBackPlan } from '@/lib/program-templates/progress'

export { completedSlotKeys }

type ProgramsApi = ReturnType<typeof usePrograms>

export interface TemplateProgramStatus {
  activation: ProgramActivation
  program: Program
  config: WildmanConfig
  progress: WildmanProgress
  stages: WildmanStage[]
  stage: WildmanStage
  nextStage: WildmanStage | null
  isFinalStage: boolean
  completedInStage: number
  /** Sessions this stage lasts in auto mode (including push-backs) */
  requiredInStage: number
  /** Auto mode: the stage's sessions are all done and the user should be asked to progress */
  isDue: boolean
  /**
   * Auto mode: when the next step up happens — the first workout at the next stage, or for the
   * final stage the last workout of the cycle. Null in manual mode or when nothing is scheduled.
   */
  nextIncrement: { date: string; kind: 'stage' | 'cycle_end' } | null
}

export type AdvanceResult = 'advanced' | 'cycle_end'

/** What a skip changed in the plan, stored with the skipped day so undo reverses exactly that */
export interface SkipChanges {
  /** Workouts moved to a later day */
  moved: { id: string; from: string; to: string }[]
  /** Ids of the copies added on the next workout day */
  added: string[]
  /** Workouts removed (template programs rebuild them from today on); restored on undo */
  removed: PlannedEntry[]
  /** Template programs whose stage the skip changed: the stage before and after, restored on undo */
  progress?: { activationId: string; before: StageState; after: StageState }[]
}

type StageState = Pick<WildmanProgress, 'stage_index' | 'stage_started_on' | 'extra_sessions'>

function stageState(p: WildmanProgress): StageState {
  return { stage_index: p.stage_index, stage_started_on: p.stage_started_on, extra_sessions: p.extra_sessions }
}

/** Done workouts of a template program on/after `since` (its stage's completed sessions) */
function completedSince(entries: PlannedEntry[], since: string, doneKeys: Set<string>) {
  return entries.filter((e) => e.date >= since && isEntryDone(e, doneKeys)).length
}

/**
 * A skipped past workout pushed into the schedule that's rebuilt from `from`: if the rebuilt
 * schedule doesn't already start with that workout's stage, owe one session of it first.
 * Same stage → one more session of the current stage. An earlier stage (auto mode, nothing done
 * yet at the current stage) → step back to it for one session; "Ready to increment?" follows.
 */
function oweWorkout(status: TemplateProgramStatus, progress: WildmanProgress, workout: PlannedEntry, from: string): WildmanProgress {
  const { config, stages, completedInStage } = status
  const owed = stages.findIndex((s) => s.sets === workout.sets && s.topReps === workout.reps)
  if (owed < 0) return progress
  const first = generateSchedule(config, progress, from, completedInStage)[0]
  if (first?.stageIndex === owed) return progress
  if (config.increment_mode !== 'auto') return progress
  if (owed === progress.stage_index) return { ...progress, extra_sessions: progress.extra_sessions + 1 }
  if (owed < progress.stage_index && completedInStage === 0) {
    return {
      ...progress,
      stage_index: owed,
      stage_started_on: from,
      extra_sessions: 1 - defaultSessionsForStage(stages[owed], config),
    }
  }
  return progress
}

export interface SkipResult {
  activationIds: string[]
  changes: SkipChanges
}

const todayKey = () => format(new Date(), 'yyyy-MM-dd')

/** First date the schedule may be rewritten from: today, unless today's workout is already done */
function scheduleFromDate(activation: ProgramActivation, entries: PlannedEntry[], doneKeys: Set<string>) {
  const today = todayKey()
  const todayDone = entries.some((e) => e.date === today && isEntryDone(e, doneKeys))
  const from = todayDone ? format(addDays(parseISO(today), 1), 'yyyy-MM-dd') : today
  return from < activation.start_date ? activation.start_date : from
}

/** Activation id → date of last daily resync, shared by every hook instance so pages don't race */
const resyncedOn = new Map<string, string>()

/**
 * Progression state and actions for active template programs (e.g. Wildman Reverse Ladders).
 * Pass the page's usePrograms() result so activation state stays in one place.
 */
export default function useProgramProgression(
  programsApi: ProgramsApi,
  workoutSessions: WorkoutSession[],
  workoutsLoading: boolean,
  onScheduleChanged?: () => void,
) {
  const { user } = useAuth()
  const { programs, activations, updateActivation, update: updateProgram, deactivate, recordCompletion } = programsApi
  const [entriesByActivation, setEntriesByActivation] = useState<Record<string, PlannedEntry[]>>({})
  // The template programs whose entries are loaded. Loaded only once it matches the current ones:
  // programs arrive after the first (empty) load, and counting completions before their entries
  // are in would make the daily resync reschedule a whole stage.
  const [loadedIds, setLoadedIds] = useState<string | null>(null)

  const templateActivations = useMemo(
    () => activations.filter((a) => programs.find((p) => p.id === a.program_id)?.template_type === 'wildman_reverse_ladder'),
    [activations, programs],
  )
  const templateIds = templateActivations.map((a) => a.id).join(',')
  const entriesLoaded = !programsApi.loading && loadedIds === templateIds

  const loadEntries = useCallback(async () => {
    if (!user) return
    const result: Record<string, PlannedEntry[]> = {}
    for (const act of templateActivations) {
      result[act.id] = await loadProgramEntries(user.id, act.id)
    }
    setEntriesByActivation(result)
    setLoadedIds(templateIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, templateIds])

  useEffect(() => { loadEntries() }, [loadEntries])

  const doneKeys = useMemo(() => completedSlotKeys(workoutSessions), [workoutSessions])

  const statuses = useMemo<TemplateProgramStatus[]>(() => {
    const list: TemplateProgramStatus[] = []
    for (const activation of templateActivations) {
      const program = programs.find((p) => p.id === activation.program_id)!
      const config = parseWildmanConfig(program.template_config)
      if (!config) continue
      const progress = parseWildmanProgress(activation.progress, config, activation.start_date)
      const stages = buildStages(config)
      const stage = stages[Math.min(progress.stage_index, stages.length - 1)]
      const entries = entriesByActivation[activation.id] ?? []
      const completedInStage = entries.filter(
        (e) => e.date >= progress.stage_started_on && isEntryDone(e, doneKeys),
      ).length
      const requiredInStage = sessionsForStage(stage, progress.extra_sessions, config)
      const isFinalStage = progress.stage_index >= stages.length - 1
      let nextIncrement: TemplateProgramStatus['nextIncrement'] = null
      if (config.increment_mode === 'auto' && completedInStage < requiredInStage) {
        // Same layout regenerate() writes, so the date matches the plan
        const schedule = generateSchedule(config, progress, scheduleFromDate(activation, entries, doneKeys), completedInStage)
        const date = isFinalStage
          ? schedule.filter((w) => w.stageIndex === progress.stage_index).at(-1)?.date
          : schedule.find((w) => w.stageIndex > progress.stage_index)?.date
        if (date) nextIncrement = { date, kind: isFinalStage ? 'cycle_end' : 'stage' }
      }
      list.push({
        activation,
        program,
        config,
        progress,
        stages,
        stage,
        nextStage: stages[progress.stage_index + 1] ?? null,
        isFinalStage,
        completedInStage,
        requiredInStage,
        isDue: config.increment_mode === 'auto' && completedInStage >= requiredInStage,
        nextIncrement,
      })
    }
    return list
  }, [templateActivations, programs, entriesByActivation, doneKeys])

  function regenFromDate(status: TemplateProgramStatus, entries = entriesByActivation[status.activation.id] ?? []) {
    return scheduleFromDate(status.activation, entries, doneKeys)
  }

  async function regenerate(
    status: TemplateProgramStatus,
    progress: WildmanProgress,
    config: WildmanConfig = status.config,
    completedInStage = status.completedInStage,
    entries?: PlannedEntry[],
  ) {
    if (!user) return
    const from = regenFromDate(status, entries)
    const next: WildmanProgress = { ...progress, synced_on: todayKey() }
    const schedule = generateSchedule(config, next, from, completedInStage)
    // Skipped days keep their workout on the calendar (shown as skipped)
    await replaceProgramEntriesFrom(
      user.id, status.activation.id, from, schedule.map((w) => entryValuesFor(config, next, w)), next.skipped_dates ?? [],
    )
    await updateActivation(status.activation.id, { progress: next as unknown as Json })
    await loadEntries()
    onScheduleChanged?.()
  }

  /** Move to the next stage, or report that the cycle is finished */
  async function advance(status: TemplateProgramStatus): Promise<AdvanceResult> {
    if (status.isFinalStage) return 'cycle_end'
    const progress: WildmanProgress = {
      ...status.progress,
      stage_index: status.progress.stage_index + 1,
      stage_started_on: regenFromDate(status),
      extra_sessions: 0,
    }
    await regenerate(status, progress, status.config, 0)
    return 'advanced'
  }

  /** Add (+) or remove (−) sessions from the current stage */
  async function adjust(status: TemplateProgramStatus, delta: number) {
    const minExtra = 1 - defaultSessionsForStage(status.stage, status.config)
    const extra = Math.max(minExtra, status.progress.extra_sessions + delta)
    await regenerate(status, { ...status.progress, extra_sessions: extra })
  }

  /** End of the final stage: start over heavier, or finish. Both are logged as a completion. */
  async function finishCycle(
    status: TemplateProgramStatus,
    outcome: 'restart' | 'complete',
    newWeight?: { weight: number | null; unit: WeightUnit },
  ) {
    await recordCompletion({
      program_id: status.program.id,
      activation_id: status.activation.id,
      exercise_id: status.config.exercise_id,
      weight: status.progress.weight,
      weight_unit: status.progress.weight_unit,
      outcome,
    })
    if (outcome === 'complete') {
      await deactivate(status.activation.id, (e) => isEntryDone(e, doneKeys))
      onScheduleChanged?.()
      return
    }
    const progress: WildmanProgress = {
      ...status.progress,
      stage_index: 0,
      stage_started_on: regenFromDate(status),
      cycle_started_on: regenFromDate(status),
      extra_sessions: 0,
      cycle: status.progress.cycle + 1,
      weight: newWeight?.weight ?? status.progress.weight,
      weight_unit: newWeight?.unit ?? status.progress.weight_unit,
    }
    await regenerate(status, progress, status.config, 0)
  }

  /**
   * Count a completed workout that wasn't on the program's schedule (e.g. an extra session added by
   * hand) toward the program, then reschedule so the stage has one fewer session left.
   */
  async function creditEntry(status: TemplateProgramStatus, entry: PlannedEntry) {
    if (!user) return
    await assignEntryToProgram(user.id, entry.id, status.activation.id)
    const entries = [...(entriesByActivation[status.activation.id] ?? []), { ...entry, program_id: status.activation.id }]
    const inStage = entry.date >= status.progress.stage_started_on && isEntryDone(entry, doneKeys)
    await regenerate(status, status.progress, status.config, status.completedInStage + (inStage ? 1 : 0), entries)
  }

  /** Stop the program: upcoming workouts that aren't completed are removed, the rest stay */
  async function cancel(status: TemplateProgramStatus) {
    await deactivate(status.activation.id, (e) => isEntryDone(e, doneKeys))
    onScheduleChanged?.()
  }

  /** Remember a one-off move so regenerating the schedule keeps it */
  async function recordMove(status: TemplateProgramStatus, fromDate: string, toDate: string) {
    const overrides = status.progress.overrides.filter((o) => o.to !== fromDate)
    const original = status.progress.overrides.find((o) => o.to === fromDate)?.from ?? fromDate
    overrides.push({ from: original, to: toDate })
    const progress = { ...status.progress, overrides }
    await updateActivation(status.activation.id, { progress: progress as unknown as Json })
    await loadEntries()
  }

  /** Move every future workout on one weekday to another */
  async function moveWeekday(status: TemplateProgramStatus, fromDow: number, toDow: number) {
    const days = [...new Set(status.config.days_of_week.map((d) => (d === fromDow ? toDow : d)))].sort()
    const config: WildmanConfig = { ...status.config, days_of_week: days }
    await updateProgram(status.program.id, { template_config: config as unknown as Json })
    await regenerate(status, status.progress, config)
  }

  /**
   * Skip a day. The skipped day keeps its workouts (shown as skipped); each program with a
   * workout on it repeats that workout on its next workout day and pushes everything after it
   * back one workout day. Template programs do this by leaving the day out of their schedule.
   * `otherSkippedDates` are earlier skips, which stay where they are. Returns the activations
   * whose schedule changed and exactly what changed, so unskipDay can reverse just that.
   */
  async function skipDay(date: string, otherSkippedDates: string[] = []): Promise<SkipResult> {
    const changes: SkipChanges = { moved: [], added: [], removed: [] }
    if (!user) return { activationIds: [], changes }
    const changed: string[] = []

    async function apply(activationId: string, entries: PlannedEntry[], plan: PushBackPlan, keepBefore?: string) {
      if (!user) return
      const byId = new Map(entries.map((e) => [e.id, e]))
      // Template programs rebuild everything from `keepBefore` on, so a workout pushed past it is
      // already in the new schedule: remove it (and put it back on undo)
      const spill = plan.moves.filter((m) => keepBefore != null && m.date >= keepBefore)
      const moves = plan.moves.filter((m) => !spill.includes(m))
      await moveEntriesToDates(user.id, moves)
      changes.moved.push(...moves.map((m) => ({ id: m.id, from: byId.get(m.id)!.date, to: m.date })))
      await deleteEntries(user.id, spill.map((m) => m.id))
      changes.removed.push(...spill.map((m) => byId.get(m.id)!))
      changes.added.push(...await insertProgramEntries(user.id, activationId, plan.copies))
    }

    for (const activation of activations) {
      const status = statusForActivation(activation.id)
      const entries = status ? (entriesByActivation[activation.id] ?? []) : await loadProgramEntries(user.id, activation.id)
      if (!entries.some((e) => e.date === date && !isEntryDone(e, doneKeys))) continue
      if (status) {
        const from = regenFromDate(status, entries)
        const skipped = [...new Set([...(status.progress.skipped_dates ?? []), date])]
        let next: WildmanProgress = { ...status.progress, skipped_dates: skipped }
        if (date < from) {
          // A past day: shift the missed workouts after it like a basic program. The workout pushed
          // into the rebuilt schedule (from `from` on) must come first there.
          const past = entries.filter((e) => e.date < from)
          const plan = pushBackPlan(past, date, doneKeys, otherSkippedDates)
          const pushedIn = plan.copies.find((c) => c.date >= from)
            ?? past.find((e) => plan.moves.some((m) => m.id === e.id && m.date >= from))
          await apply(activation.id, past, plan, from)
          if (pushedIn) next = oweWorkout(status, next, pushedIn, from)
          const before = stageState(status.progress)
          const after = stageState(next)
          if (JSON.stringify(before) !== JSON.stringify(after)) {
            changes.progress = [...(changes.progress ?? []), { activationId: activation.id, before, after }]
          }
        }
        await regenerate(status, next, status.config, completedSince(entries, next.stage_started_on, doneKeys))
      } else {
        await apply(activation.id, entries, pushBackPlan(entries, date, doneKeys, otherSkippedDates))
      }
      changed.push(activation.id)
    }
    if (changed.length > 0) onScheduleChanged?.()
    return { activationIds: changed, changes }
  }

  /**
   * Undo skipDay: reverse the recorded changes (remove the copies, move workouts back, restore
   * removed ones) and put the day back into template schedules. Workouts changed since the skip
   * (completed, moved or deleted by hand) are left as they are. Without a record (skips saved
   * before changes were recorded) the plan is left alone.
   */
  async function unskipDay(date: string, activationIds: string[], recorded: SkipChanges | null) {
    if (!user) return
    if (recorded) {
      await deleteEntries(user.id, recorded.added)
      const current = new Map<string, PlannedEntry>()
      for (const id of activationIds) {
        for (const e of await loadProgramEntries(user.id, id)) current.set(e.id, e)
      }
      await moveEntriesToDates(user.id, recorded.moved
        .filter((m) => {
          const e = current.get(m.id)
          return e && e.date === m.to && !isEntryDone(e, doneKeys)
        })
        .map((m) => ({ id: m.id, date: m.from })))
      const byProgram = new Map<string, PlannedEntry[]>()
      for (const e of recorded.removed) {
        if (!e.program_id || current.has(e.id)) continue
        byProgram.set(e.program_id, [...(byProgram.get(e.program_id) ?? []), e])
      }
      for (const [programId, removed] of byProgram) await insertProgramEntries(user.id, programId, removed)
    }
    for (const id of activationIds) {
      const status = statusForActivation(id)
      if (!status) continue
      const skipped = (status.progress.skipped_dates ?? []).filter((d) => d !== date)
      let next: WildmanProgress = { ...status.progress, skipped_dates: skipped }
      // Put the stage back as it was before the skip, unless it has changed since (e.g. progressed)
      const stageChange = recorded?.progress?.find((p) => p.activationId === id)
      if (stageChange && JSON.stringify(stageState(status.progress)) === JSON.stringify(stageChange.after)) {
        next = { ...next, ...stageChange.before }
      }
      const entries = await loadProgramEntries(user.id, id)
      await regenerate(status, next, status.config, completedSince(entries, next.stage_started_on, doneKeys), entries)
    }
    if (activationIds.length > 0) {
      await loadEntries()
      onScheduleChanged?.()
    }
  }

  // Missed days: once a day, rebuild the schedule so unfinished sessions move to the next training days
  const syncingRef = useRef(false)
  useEffect(() => {
    if (workoutsLoading || !entriesLoaded || syncingRef.current) return
    const today = todayKey()
    const stale = statuses.filter((s) =>
      s.progress.synced_on < today && s.activation.start_date <= today && resyncedOn.get(s.activation.id) !== today)
    if (stale.length === 0) return
    syncingRef.current = true
    for (const s of stale) resyncedOn.set(s.activation.id, today)
    ;(async () => {
      try {
        for (const s of stale) await regenerate(s, s.progress)
      } catch (err) {
        console.error('Failed to reschedule template program', err)
      } finally {
        syncingRef.current = false
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, workoutsLoading, entriesLoaded])

  function statusForActivation(activationId: string | null | undefined) {
    return statuses.find((s) => s.activation.id === activationId) ?? null
  }

  return {
    statuses,
    /** Workouts and program entries are loaded, so completion counts are accurate */
    ready: !workoutsLoading && entriesLoaded,
    statusForActivation,
    /** This activation's planned entries (for progress bars) */
    entriesFor: (activationId: string) => withoutSkippedDays(
      entriesByActivation[activationId] ?? [],
      statusForActivation(activationId)?.progress.skipped_dates ?? [],
    ),
    doneKeys,
    advance,
    adjust,
    finishCycle,
    recordMove,
    moveWeekday,
    creditEntry,
    cancel,
    skipDay,
    unskipDay,
    refresh: loadEntries,
  }
}
