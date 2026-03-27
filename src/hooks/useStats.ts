import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  format,
  parseISO,
  addWeeks,
  startOfWeek,
  startOfMonth,
  startOfYear,
  isBefore,
  isWithinInterval,
  endOfWeek,
  endOfMonth,
  endOfYear,
  isSameDay,
  startOfDay,
  subDays,
} from 'date-fns'
import { supabase, isDev } from '@/lib/supabase'
import { localDb } from '@/lib/local-storage'
import { useAuth } from '@/contexts/AuthContext'
import { loadUserEntries } from '@/hooks/useWeeklyPlan'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import type { WorkoutSession, Program, Exercise } from '@/types/database'
import { calcEntryVolume, calcTotalReps } from '@/types/common'
import type { WeightUnit } from '@/types/common'

export interface TimeRangeTotals {
  week: number; month: number; year: number; allTime: number
}

export interface ExerciseStats {
  exerciseId: string
  name: string
  color: string | null
  reps: TimeRangeTotals
  tut: TimeRangeTotals // time under tension in seconds (for rep_type === 'time')
  volume: TimeRangeTotals
  sessions: number
  isTimed: boolean // true if this exercise primarily uses time rep type
  timeline: Array<{ date: string; volume: number; totalReps: number; tut: number; sets: number }>
}

export interface StatsData {
  // Programs
  programsCompleted: number

  // Volume
  totalWeightAllTime: number
  totalWeightThisYear: number
  totalWeightThisMonth: number
  totalWeightThisWeek: number
  totalWeightByYear: Record<number, number>

  // Volume per day (for charts)
  volumeByDay: Record<string, number>

  // Workouts
  workoutsAllTime: number
  workoutsThisYear: number
  workoutsThisMonth: number
  workoutsThisWeek: number
  streak: number

  // Per-exercise
  exerciseStats: ExerciseStats[]

  // Raw data for future use
  preferredUnit: WeightUnit
}

export interface UseStatsOptions {
  /** Pre-fetched sessions — skips the workout_sessions query when provided */
  sessions?: WorkoutSession[]
  /** Pre-fetched programs — skips the programs query when provided */
  programs?: Program[]
  /** Activation IDs to scope planned entries (includes both program-scoped and unscoped) */
  activationIds?: string[]
}

export default function useStats(options: UseStatsOptions = {}) {
  const { user, profile } = useAuth()
  const preferredUnit = (profile?.preferred_weight_unit as WeightUnit) ?? 'lbs'

  const [ownSessions, setOwnSessions] = useState<WorkoutSession[]>([])
  const [entries, setEntries] = useState<PlannedEntry[]>([])
  const [ownPrograms, setOwnPrograms] = useState<Program[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  const sessions = options.sessions ?? ownSessions
  const programs = options.programs ?? ownPrograms

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)

    if (isDev) {
      if (!options.sessions) {
        setOwnSessions(localDb.getAll('workout_sessions').filter((s) => s.user_id === user.id) as WorkoutSession[])
      }
      if (!options.programs) {
        setOwnPrograms(localDb.getAll('programs').filter((p) => p.user_id === user.id) as Program[])
      }
      setExercises(localDb.getAll('exercises').filter((e) => e.user_id === user.id) as Exercise[])
      setEntries(await loadUserEntries(user.id, options.activationIds?.length ? options.activationIds : undefined))
    } else {
      const fetches: Promise<void>[] = []

      if (!options.sessions) {
        fetches.push(
          supabase.from('workout_sessions').select('*').eq('user_id', user.id)
            .then(({ data }) => { setOwnSessions(data ?? []) }),
        )
      }
      if (!options.programs) {
        fetches.push(
          supabase.from('programs').select('*').eq('user_id', user.id)
            .then(({ data }) => { setOwnPrograms(data ?? []) }),
        )
      }
      fetches.push(
        supabase.from('exercises').select('*').eq('user_id', user.id)
          .then(({ data }) => { setExercises(data ?? []) }),
      )
      fetches.push(loadUserEntries(user.id, options.activationIds?.length ? options.activationIds : undefined).then(setEntries))

      await Promise.all(fetches)
    }

    setLoading(false)
  }, [user, !!options.sessions, !!options.programs, options.activationIds])

  useEffect(() => { fetch() }, [fetch])

  const stats = useMemo((): StatsData => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const yearStart = startOfYear(now)
    const yearEnd = endOfYear(now)

    // Build set of completed dates
    const completed = sessions.filter((s) => s.completed_at)
    const completedDates = new Set<string>()
    for (const s of completed) {
      completedDates.add(format(new Date(s.started_at), 'yyyy-MM-dd'))
    }

    // Filter entries to only completed days
    const completedEntries = entries.filter((e) => completedDates.has(e.date))

    // Programs completed: end date has passed
    let programsCompleted = 0
    for (const p of programs) {
      if (!p.start_date || !p.weeks) continue
      const endDate = addWeeks(parseISO(p.start_date), p.weeks)
      if (isBefore(endDate, now)) programsCompleted++
    }

    // Volume & reps accumulators
    let totalWeightAllTime = 0
    let totalWeightThisYear = 0
    let totalWeightThisMonth = 0
    let totalWeightThisWeek = 0
    const totalWeightByYear: Record<number, number> = {}
    const volumeByDay: Record<string, number> = {}

    // Per-exercise accumulators
    const exMap = new Map<string, {
      repsWeek: number; repsMonth: number; repsYear: number; repsAll: number
      tutWeek: number; tutMonth: number; tutYear: number; tutAll: number
      volWeek: number; volMonth: number; volYear: number; volAll: number
      timedCount: number; totalCount: number
      sessions: Set<string>
      timeline: Map<string, { volume: number; totalReps: number; tut: number; sets: number }>
    }>()

    for (const entry of completedEntries) {
      const vol = calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit)
      const reps = calcTotalReps(entry.sets, entry.reps, entry.rep_type, entry.reps_right)
      const isTimed = entry.rep_type === 'time'
      // TUT: for timed exercises, reps holds seconds per set, multiply by sets
      const tut = isTimed && entry.reps != null && entry.sets != null ? entry.sets * entry.reps : 0
      const entryDate = parseISO(entry.date)
      const year = entryDate.getFullYear()

      // Global volume
      totalWeightAllTime += vol
      totalWeightByYear[year] = (totalWeightByYear[year] ?? 0) + vol
      volumeByDay[entry.date] = (volumeByDay[entry.date] ?? 0) + vol

      const inWeek = isWithinInterval(entryDate, { start: weekStart, end: weekEnd })
      const inMonth = isWithinInterval(entryDate, { start: monthStart, end: monthEnd })
      const inYear = isWithinInterval(entryDate, { start: yearStart, end: yearEnd })

      if (inYear) totalWeightThisYear += vol
      if (inMonth) totalWeightThisMonth += vol
      if (inWeek) totalWeightThisWeek += vol

      // Per-exercise
      let ex = exMap.get(entry.exercise_id)
      if (!ex) {
        ex = {
          repsWeek: 0, repsMonth: 0, repsYear: 0, repsAll: 0,
          tutWeek: 0, tutMonth: 0, tutYear: 0, tutAll: 0,
          volWeek: 0, volMonth: 0, volYear: 0, volAll: 0,
          timedCount: 0, totalCount: 0,
          sessions: new Set(),
          timeline: new Map(),
        }
        exMap.set(entry.exercise_id, ex)
      }

      ex.repsAll += reps
      ex.volAll += vol
      ex.tutAll += tut
      ex.totalCount++
      if (isTimed) ex.timedCount++
      ex.sessions.add(entry.date)
      if (inWeek) { ex.repsWeek += reps; ex.volWeek += vol; ex.tutWeek += tut }
      if (inMonth) { ex.repsMonth += reps; ex.volMonth += vol; ex.tutMonth += tut }
      if (inYear) { ex.repsYear += reps; ex.volYear += vol; ex.tutYear += tut }

      // Timeline
      const existing = ex.timeline.get(entry.date)
      if (existing) {
        existing.volume += vol
        existing.totalReps += reps
        existing.tut += tut
        existing.sets += entry.sets ?? 0
      } else {
        ex.timeline.set(entry.date, { volume: vol, totalReps: reps, tut, sets: entry.sets ?? 0 })
      }
    }

    // Workout counts
    const workoutsAllTime = completed.length
    let workoutsThisWeek = 0
    let workoutsThisMonth = 0
    let workoutsThisYear = 0
    for (const s of completed) {
      const d = new Date(s.started_at)
      if (isWithinInterval(d, { start: weekStart, end: weekEnd })) workoutsThisWeek++
      if (isWithinInterval(d, { start: monthStart, end: monthEnd })) workoutsThisMonth++
      if (isWithinInterval(d, { start: yearStart, end: yearEnd })) workoutsThisYear++
    }

    // Streak
    let streak = 0
    let day = startOfDay(now)
    while (true) {
      const has = completed.some((s) => isSameDay(new Date(s.started_at), day))
      if (has) {
        streak++
        day = subDays(day, 1)
      } else break
    }

    // Build exercise stats array
    const exerciseStats: ExerciseStats[] = []
    for (const [exerciseId, data] of exMap) {
      const ex = exercises.find((e) => e.id === exerciseId)
      const timeline = Array.from(data.timeline.entries())
        .map(([date, d]) => ({ date, ...d }))
        .sort((a, b) => a.date.localeCompare(b.date))

      exerciseStats.push({
        exerciseId,
        name: ex?.name ?? 'Unknown',
        color: ex?.color ?? null,
        reps: { week: data.repsWeek, month: data.repsMonth, year: data.repsYear, allTime: data.repsAll },
        tut: { week: data.tutWeek, month: data.tutMonth, year: data.tutYear, allTime: data.tutAll },
        volume: { week: data.volWeek, month: data.volMonth, year: data.volYear, allTime: data.volAll },
        sessions: data.sessions.size,
        isTimed: data.timedCount > data.totalCount / 2,
        timeline,
      })
    }

    // Sort by all-time volume descending
    exerciseStats.sort((a, b) => b.volume.allTime - a.volume.allTime)

    return {
      programsCompleted,
      totalWeightAllTime,
      totalWeightThisYear,
      totalWeightThisMonth,
      totalWeightThisWeek,
      totalWeightByYear,
      volumeByDay,
      workoutsAllTime,
      workoutsThisYear,
      workoutsThisMonth,
      workoutsThisWeek,
      streak,
      exerciseStats,
      preferredUnit,
    }
  }, [sessions, entries, programs, exercises, preferredUnit])

  return { ...stats, loading, exercises, entries }
}
