import { useCallback, useEffect, useState } from 'react'
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  eachDayOfInterval,
  format,
} from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import type { RepType, WeightUnit } from '@/types/common'

export interface PlannedEntry {
  id: string
  user_id: string
  program_id: string | null
  date: string        // YYYY-MM-DD
  exercise_id: string
  sort_order: number
  sets: number | null
  reps: number | null
  rep_type: RepType
  reps_right: number | null
  weight: number | null
  weight_unit: WeightUnit
  intensity: 'light' | 'heavy' | null
}

export type PlannedEntryUpdate = Partial<Pick<PlannedEntry, 'sets' | 'reps' | 'rep_type' | 'reps_right' | 'weight' | 'weight_unit' | 'intensity'>>

const STORAGE_KEY = 'fittrack:weekly_plan'

function loadAll(): PlannedEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  // Migrate old entries that lack new fields
  const parsed = JSON.parse(raw) as PlannedEntry[]
  return parsed.map((e) => ({
    sets: null,
    reps: null,
    rep_type: 'single' as RepType,
    reps_right: null,
    weight: null,
    weight_unit: 'lbs' as WeightUnit,
    intensity: null,
    ...e,
  }))
}

function saveAll(entries: PlannedEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

interface UseWeeklyPlanOptions {
  /** The reference date for week 0 (program start_date or current date) */
  startDate?: Date
  /** Which week offset to display (0-indexed) */
  weekOffset?: number
  /** Scope entries to a specific program */
  programId?: string | null
  /** Also include entries with no program (program_id: null) when programId is set */
  includeUnscoped?: boolean
}

export default function useWeeklyPlan(options: UseWeeklyPlanOptions = {}) {
  const { user } = useAuth()
  const {
    startDate = new Date(),
    weekOffset = 0,
    programId = null,
    includeUnscoped = false,
  } = options

  const [entries, setEntries] = useState<PlannedEntry[]>([])

  const weekStart = startOfWeek(addWeeks(startDate, weekOffset), { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dateKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  const fetch = useCallback(() => {
    if (!user) return
    const all = loadAll().filter(
      (e) =>
        e.user_id === user.id &&
        dateKeys.includes(e.date) &&
        (programId
          ? (e.program_id === programId || (includeUnscoped && e.program_id == null))
          : true),
    )
    setEntries(all)
  }, [user, dateKeys.join(','), programId, includeUnscoped])

  useEffect(() => { fetch() }, [fetch])

  function getEntriesForDate(dateKey: string) {
    return entries
      .filter((e) => e.date === dateKey)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  function addEntry(dateKey: string, exerciseId: string, presets?: PlannedEntryUpdate) {
    if (!user) return
    const dateEntries = entries.filter((e) => e.date === dateKey)
    const entry: PlannedEntry = {
      id: crypto.randomUUID(),
      user_id: user.id,
      program_id: programId,
      date: dateKey,
      exercise_id: exerciseId,
      sort_order: dateEntries.length,
      sets: presets?.sets ?? 3,
      reps: presets?.reps ?? 10,
      rep_type: presets?.rep_type ?? 'single',
      reps_right: presets?.reps_right ?? null,
      weight: presets?.weight ?? null,
      weight_unit: presets?.weight_unit ?? 'lbs',
      intensity: presets?.intensity ?? null,
    }
    const all = loadAll()
    all.push(entry)
    saveAll(all)
    setEntries((prev) => [...prev, entry])
  }

  function updateEntry(id: string, values: PlannedEntryUpdate) {
    const all = loadAll()
    const idx = all.findIndex((e) => e.id === id)
    if (idx === -1) return
    Object.assign(all[idx], values)
    saveAll(all)
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...values } : e)),
    )
  }

  function removeEntry(id: string) {
    const all = loadAll().filter((e) => e.id !== id)
    saveAll(all)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function moveEntry(entryId: string, toDateKey: string, toIndex: number) {
    const all = loadAll()
    const idx = all.findIndex((e) => e.id === entryId)
    if (idx === -1) return

    all[idx].date = toDateKey

    const dateEntries = all
      .filter((e) => e.date === toDateKey && e.user_id === user?.id && (programId ? e.program_id === programId : true))
      .sort((a, b) => a.sort_order - b.sort_order)

    const withoutMoved = dateEntries.filter((e) => e.id !== entryId)
    withoutMoved.splice(toIndex, 0, all[idx])
    withoutMoved.forEach((e, i) => {
      const globalIdx = all.findIndex((a) => a.id === e.id)
      if (globalIdx !== -1) all[globalIdx].sort_order = i
    })

    saveAll(all)
    setEntries(
      all.filter((e) => e.user_id === user?.id && dateKeys.includes(e.date) && (programId ? e.program_id === programId : true)),
    )
  }

  function clearDate(dateKey: string) {
    if (!user) return
    const all = loadAll().filter(
      (e) => !(e.date === dateKey && e.user_id === user.id && (programId ? e.program_id === programId : true)),
    )
    saveAll(all)
    setEntries((prev) => prev.filter((e) => e.date !== dateKey))
  }

  return {
    entries,
    days,
    dateKeys,
    weekStart,
    weekEnd,
    getEntriesForDate,
    addEntry,
    updateEntry,
    removeEntry,
    moveEntry,
    clearDate,
    refetch: fetch,
  }
}

/** Load all entries for a given program across all weeks */
export function loadProgramEntries(userId: string, programId: string): PlannedEntry[] {
  return loadAll().filter((e) => e.user_id === userId && e.program_id === programId)
}

/** Load all entries for a user — includes program entries and unscoped (program_id: null) entries */
export function loadUserEntries(userId: string, programId?: string | null): PlannedEntry[] {
  return loadAll().filter((e) =>
    e.user_id === userId &&
    (programId ? (e.program_id === programId || e.program_id == null) : true),
  )
}
