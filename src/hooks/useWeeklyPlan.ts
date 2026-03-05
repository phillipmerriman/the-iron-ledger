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

export type Session = 'morning' | 'noon' | 'night'
export const SESSIONS: Session[] = ['morning', 'noon', 'night']
export const SESSION_LABELS: Record<Session, string> = {
  morning: 'Morning',
  noon: 'Noon',
  night: 'Night',
}

export interface PlannedEntry {
  id: string
  user_id: string
  program_id: string | null
  date: string        // YYYY-MM-DD
  session: Session
  exercise_id: string
  sort_order: number
  sets: number | null
  reps: number | null
  rep_type: RepType
  reps_right: number | null
  weight: number | null
  weight_unit: WeightUnit
  intensity: 'light' | 'heavy' | null
  notes: string | null
}

export type PlannedEntryUpdate = Partial<Pick<PlannedEntry, 'exercise_id' | 'sets' | 'reps' | 'rep_type' | 'reps_right' | 'weight' | 'weight_unit' | 'intensity' | 'notes' | 'session'>>

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
    notes: null,
    session: 'noon' as Session,
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
    const sessionOrder = { morning: 0, noon: 1, night: 2 }
    return entries
      .filter((e) => e.date === dateKey)
      .sort((a, b) => (sessionOrder[a.session] - sessionOrder[b.session]) || (a.sort_order - b.sort_order))
  }

  function getEntriesForDateSession(dateKey: string, session: Session) {
    return entries
      .filter((e) => e.date === dateKey && e.session === session)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  function addEntry(dateKey: string, exerciseId: string, presets?: PlannedEntryUpdate, session: Session = 'morning') {
    if (!user) return
    const sessionEntries = entries.filter((e) => e.date === dateKey && e.session === session)
    const entry: PlannedEntry = {
      id: crypto.randomUUID(),
      user_id: user.id,
      program_id: programId,
      date: dateKey,
      session,
      exercise_id: exerciseId,
      sort_order: sessionEntries.length,
      sets: presets?.sets ?? 3,
      reps: presets?.reps ?? 10,
      rep_type: presets?.rep_type ?? 'single',
      reps_right: presets?.reps_right ?? null,
      weight: presets?.weight ?? null,
      weight_unit: presets?.weight_unit ?? 'lbs',
      intensity: presets?.intensity ?? null,
      notes: presets?.notes ?? null,
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

  function moveEntry(entryId: string, toDateKey: string, toIndex: number, toSession?: Session) {
    const all = loadAll()
    const idx = all.findIndex((e) => e.id === entryId)
    if (idx === -1) return

    all[idx].date = toDateKey
    if (toSession) all[idx].session = toSession

    const targetSession = all[idx].session
    const sessionEntries = all
      .filter((e) => e.date === toDateKey && e.session === targetSession && e.user_id === user?.id && (programId ? e.program_id === programId : true))
      .sort((a, b) => a.sort_order - b.sort_order)

    const withoutMoved = sessionEntries.filter((e) => e.id !== entryId)
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

  function clearSession(dateKey: string, session: Session) {
    if (!user) return
    const all = loadAll().filter(
      (e) => !(e.date === dateKey && e.session === session && e.user_id === user.id && (programId ? e.program_id === programId : true)),
    )
    saveAll(all)
    setEntries((prev) => prev.filter((e) => !(e.date === dateKey && e.session === session)))
  }

  return {
    entries,
    days,
    dateKeys,
    weekStart,
    weekEnd,
    getEntriesForDate,
    getEntriesForDateSession,
    addEntry,
    updateEntry,
    removeEntry,
    moveEntry,
    clearDate,
    clearSession,
    refetch: fetch,
  }
}

/** Load all entries for a specific week of a program, tagged with day-of-week index */
export function loadWeekEntries(
  userId: string,
  programId: string,
  programStart: Date,
  weekOffset: number,
): (PlannedEntry & { dayIndex: number })[] {
  const weekStart = startOfWeek(addWeeks(programStart, weekOffset), { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dateKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  return loadAll()
    .filter((e) => e.user_id === userId && e.program_id === programId && dateKeys.includes(e.date))
    .map((e) => ({ ...e, dayIndex: dateKeys.indexOf(e.date) }))
}

/** Clear all entries for a specific week of a program */
export function clearWeekEntries(
  userId: string,
  programId: string,
  programStart: Date,
  weekOffset: number,
): void {
  const weekStart = startOfWeek(addWeeks(programStart, weekOffset), { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dateKeys = new Set(days.map((d) => format(d, 'yyyy-MM-dd')))

  const all = loadAll().filter(
    (e) => !(e.user_id === userId && e.program_id === programId && dateKeys.has(e.date)),
  )
  saveAll(all)
}

/** Paste copied week entries into a target week */
export function pasteWeekEntries(
  userId: string,
  programId: string,
  programStart: Date,
  targetWeekOffset: number,
  copiedEntries: (PlannedEntry & { dayIndex: number })[],
): void {
  const weekStart = startOfWeek(addWeeks(programStart, targetWeekOffset), { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dateKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  const all = loadAll()
  const now = new Date().toISOString()

  // Group by dayIndex to compute sort_order per day
  const byDay = new Map<number, typeof copiedEntries>()
  for (const entry of copiedEntries) {
    const group = byDay.get(entry.dayIndex) ?? []
    group.push(entry)
    byDay.set(entry.dayIndex, group)
  }

  for (const [dayIndex, entries] of byDay) {
    const targetDate = dateKeys[dayIndex]
    if (!targetDate) continue
    // Count existing entries for this date to set sort_order
    const existingCount = all.filter(
      (e) => e.user_id === userId && e.program_id === programId && e.date === targetDate,
    ).length
    const sorted = entries.sort((a, b) => a.sort_order - b.sort_order)
    for (let i = 0; i < sorted.length; i++) {
      const src = sorted[i]
      all.push({
        id: crypto.randomUUID(),
        user_id: userId,
        program_id: programId,
        date: targetDate,
        session: src.session ?? 'noon' as Session,
        exercise_id: src.exercise_id,
        sort_order: existingCount + i,
        sets: src.sets,
        reps: src.reps,
        rep_type: src.rep_type,
        reps_right: src.reps_right,
        weight: src.weight,
        weight_unit: src.weight_unit,
        intensity: src.intensity,
        notes: src.notes,
      })
    }
  }

  saveAll(all)
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
