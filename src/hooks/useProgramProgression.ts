import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import type usePrograms from '@/hooks/usePrograms'
import { assignEntryToProgram, loadProgramEntries, replaceProgramEntriesFrom } from '@/hooks/useWeeklyPlan'
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
import { completedSlotKeys, isEntryDone } from '@/lib/program-templates/progress'

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
}

export type AdvanceResult = 'advanced' | 'cycle_end'

const todayKey = () => format(new Date(), 'yyyy-MM-dd')

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
  const [entriesLoaded, setEntriesLoaded] = useState(false)

  const templateActivations = useMemo(
    () => activations.filter((a) => programs.find((p) => p.id === a.program_id)?.template_type === 'wildman_reverse_ladder'),
    [activations, programs],
  )
  const templateIds = templateActivations.map((a) => a.id).join(',')

  const loadEntries = useCallback(async () => {
    if (!user) return
    const result: Record<string, PlannedEntry[]> = {}
    for (const act of templateActivations) {
      result[act.id] = await loadProgramEntries(user.id, act.id)
    }
    setEntriesByActivation(result)
    setEntriesLoaded(true)
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
      list.push({
        activation,
        program,
        config,
        progress,
        stages,
        stage,
        nextStage: stages[progress.stage_index + 1] ?? null,
        isFinalStage: progress.stage_index >= stages.length - 1,
        completedInStage,
        requiredInStage,
        isDue: config.increment_mode === 'auto' && completedInStage >= requiredInStage,
      })
    }
    return list
  }, [templateActivations, programs, entriesByActivation, doneKeys])

  /** First date the schedule may be rewritten from: today, unless today's workout is already done */
  function regenFromDate(status: TemplateProgramStatus, entries = entriesByActivation[status.activation.id] ?? []) {
    const today = todayKey()
    const todayDone = entries.some((e) => e.date === today && isEntryDone(e, doneKeys))
    const from = todayDone ? format(addDays(parseISO(today), 1), 'yyyy-MM-dd') : today
    return from < status.activation.start_date ? status.activation.start_date : from
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
    await replaceProgramEntriesFrom(user.id, status.activation.id, from, schedule.map((w) => entryValuesFor(config, next, w)))
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
    entriesFor: (activationId: string) => entriesByActivation[activationId] ?? [],
    doneKeys,
    advance,
    adjust,
    finishCycle,
    recordMove,
    moveWeekday,
    creditEntry,
    cancel,
    refresh: loadEntries,
  }
}
