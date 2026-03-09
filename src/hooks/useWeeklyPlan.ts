import { useCallback, useEffect, useState } from 'react'
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  eachDayOfInterval,
  format,
} from 'date-fns'
import { supabase, isDev } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { InsertDto } from '@/types/database'
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
  timer_id: string | null
}

export type PlannedEntryUpdate = Partial<Pick<PlannedEntry, 'exercise_id' | 'sets' | 'reps' | 'rep_type' | 'reps_right' | 'weight' | 'weight_unit' | 'intensity' | 'notes' | 'session' | 'timer_id'>>

const STORAGE_KEY = 'fittrack:weekly_plan'

function loadAll(): PlannedEntry[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  const parsed = JSON.parse(raw) as Partial<PlannedEntry>[]
  return parsed.map((e): PlannedEntry => ({
    id: e.id!,
    user_id: e.user_id!,
    program_id: e.program_id ?? null,
    date: e.date!,
    session: e.session ?? 'noon',
    exercise_id: e.exercise_id!,
    sort_order: e.sort_order ?? 0,
    sets: e.sets ?? null,
    reps: e.reps ?? null,
    rep_type: e.rep_type ?? 'single',
    reps_right: e.reps_right ?? null,
    weight: e.weight ?? null,
    weight_unit: e.weight_unit ?? 'lbs',
    intensity: e.intensity ?? null,
    notes: e.notes ?? null,
    timer_id: (e as Record<string, unknown>).timer_id as string | null ?? null,
  }))
}

function saveAll(entries: PlannedEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

/** Cast Supabase row to PlannedEntry (types are compatible) */
function asEntry(row: Record<string, unknown>): PlannedEntry {
  return row as unknown as PlannedEntry
}

function asEntries(rows: Record<string, unknown>[]): PlannedEntry[] {
  return rows.map(asEntry)
}

interface UseWeeklyPlanOptions {
  startDate?: Date
  weekOffset?: number
  programId?: string | null
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

  const fetch = useCallback(async () => {
    if (!user) return
    if (isDev) {
      const all = loadAll().filter(
        (e) =>
          e.user_id === user.id &&
          dateKeys.includes(e.date) &&
          (programId
            ? (e.program_id === programId || (includeUnscoped && e.program_id == null))
            : true),
      )
      setEntries(all)
    } else {
      let query = supabase
        .from('planned_entries')
        .select('*')
        .eq('user_id', user.id)
        .in('date', dateKeys)

      if (programId) {
        if (includeUnscoped) {
          query = query.or(`program_id.eq.${programId},program_id.is.null`)
        } else {
          query = query.eq('program_id', programId)
        }
      }

      const { data, error } = await query.order('sort_order')
      if (error) throw error
      setEntries(asEntries(data ?? []))
    }
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

  async function addEntry(dateKey: string, exerciseId: string, presets?: PlannedEntryUpdate, session: Session = 'morning') {
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
      timer_id: presets?.timer_id ?? null,
    }

    if (isDev) {
      const all = loadAll()
      all.push(entry)
      saveAll(all)
    } else {
      const { error } = await supabase.from('planned_entries').insert({
        id: entry.id,
        user_id: entry.user_id,
        program_id: entry.program_id,
        date: entry.date,
        session: entry.session,
        exercise_id: entry.exercise_id,
        sort_order: entry.sort_order,
        sets: entry.sets,
        reps: entry.reps,
        rep_type: entry.rep_type,
        reps_right: entry.reps_right,
        weight: entry.weight,
        weight_unit: entry.weight_unit,
        intensity: entry.intensity,
        notes: entry.notes,
        timer_id: entry.timer_id,
      })
      if (error) throw error
    }
    setEntries((prev) => [...prev, entry])
  }

  async function updateEntry(id: string, values: PlannedEntryUpdate) {
    if (isDev) {
      const all = loadAll()
      const idx = all.findIndex((e) => e.id === id)
      if (idx === -1) return
      Object.assign(all[idx], values)
      saveAll(all)
    } else {
      const { error } = await supabase.from('planned_entries').update(values).eq('id', id)
      if (error) throw error
    }
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...values } : e)),
    )
  }

  async function removeEntry(id: string) {
    if (isDev) {
      const all = loadAll().filter((e) => e.id !== id)
      saveAll(all)
    } else {
      const { error } = await supabase.from('planned_entries').delete().eq('id', id)
      if (error) throw error
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function moveEntry(entryId: string, toDateKey: string, toIndex: number, toSession?: Session) {
    if (isDev) {
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
    } else {
      const entry = entries.find((e) => e.id === entryId)
      if (!entry) return

      const targetSession = toSession ?? entry.session

      await supabase.from('planned_entries').update({
        date: toDateKey,
        session: targetSession,
      }).eq('id', entryId)

      const updatedEntry = { ...entry, date: toDateKey, session: targetSession }
      const targetEntries = entries
        .filter((e) => e.date === toDateKey && e.session === targetSession && e.id !== entryId)
        .sort((a, b) => a.sort_order - b.sort_order)

      targetEntries.splice(toIndex, 0, updatedEntry)

      for (let i = 0; i < targetEntries.length; i++) {
        await supabase.from('planned_entries').update({ sort_order: i }).eq('id', targetEntries[i].id)
      }

      await fetch()
    }
  }

  async function clearDate(dateKey: string) {
    if (!user) return
    if (isDev) {
      const all = loadAll().filter(
        (e) => !(e.date === dateKey && e.user_id === user.id && (programId ? e.program_id === programId : true)),
      )
      saveAll(all)
    } else {
      let query = supabase.from('planned_entries').delete()
        .eq('user_id', user.id)
        .eq('date', dateKey)
      if (programId) {
        query = query.eq('program_id', programId)
      }
      const { error } = await query
      if (error) throw error
    }
    setEntries((prev) => prev.filter((e) => e.date !== dateKey))
  }

  async function clearSession(dateKey: string, session: Session) {
    if (!user) return
    if (isDev) {
      const all = loadAll().filter(
        (e) => !(e.date === dateKey && e.session === session && e.user_id === user.id && (programId ? e.program_id === programId : true)),
      )
      saveAll(all)
    } else {
      let query = supabase.from('planned_entries').delete()
        .eq('user_id', user.id)
        .eq('date', dateKey)
        .eq('session', session)
      if (programId) {
        query = query.eq('program_id', programId)
      }
      const { error } = await query
      if (error) throw error
    }
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
export async function loadWeekEntries(
  userId: string,
  programId: string,
  programStart: Date,
  weekOffset: number,
): Promise<(PlannedEntry & { dayIndex: number })[]> {
  const weekStart = startOfWeek(addWeeks(programStart, weekOffset), { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dateKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  if (isDev) {
    return loadAll()
      .filter((e) => e.user_id === userId && e.program_id === programId && dateKeys.includes(e.date))
      .map((e) => ({ ...e, dayIndex: dateKeys.indexOf(e.date) }))
  }

  const { data, error } = await supabase
    .from('planned_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .in('date', dateKeys)
    .order('sort_order')
  if (error) throw error
  return asEntries(data ?? []).map((e) => ({ ...e, dayIndex: dateKeys.indexOf(e.date) }))
}

/** Clear all entries for a specific week of a program */
export async function clearWeekEntries(
  userId: string,
  programId: string,
  programStart: Date,
  weekOffset: number,
): Promise<void> {
  const weekStart = startOfWeek(addWeeks(programStart, weekOffset), { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dateKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  if (isDev) {
    const all = loadAll().filter(
      (e) => !(e.user_id === userId && e.program_id === programId && dateKeys.includes(e.date)),
    )
    saveAll(all)
    return
  }

  const { error } = await supabase
    .from('planned_entries')
    .delete()
    .eq('user_id', userId)
    .eq('program_id', programId)
    .in('date', dateKeys)
  if (error) throw error
}

/** Paste copied week entries into a target week */
export async function pasteWeekEntries(
  userId: string,
  programId: string,
  programStart: Date,
  targetWeekOffset: number,
  copiedEntries: (PlannedEntry & { dayIndex: number })[],
): Promise<void> {
  const weekStart = startOfWeek(addWeeks(programStart, targetWeekOffset), { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dateKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  if (isDev) {
    const all = loadAll()

    const byDay = new Map<number, typeof copiedEntries>()
    for (const entry of copiedEntries) {
      const group = byDay.get(entry.dayIndex) ?? []
      group.push(entry)
      byDay.set(entry.dayIndex, group)
    }

    for (const [dayIndex, dayEntries] of byDay) {
      const targetDate = dateKeys[dayIndex]
      if (!targetDate) continue
      const existingCount = all.filter(
        (e) => e.user_id === userId && e.program_id === programId && e.date === targetDate,
      ).length
      const sorted = dayEntries.sort((a, b) => a.sort_order - b.sort_order)
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
          timer_id: (src as PlannedEntry).timer_id ?? null,
        })
      }
    }

    saveAll(all)
    return
  }

  // Get existing counts per date for sort_order
  const { data: existing } = await supabase
    .from('planned_entries')
    .select('date')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .in('date', dateKeys)

  const existingCounts = new Map<string, number>()
  for (const row of (existing ?? [])) {
    existingCounts.set(row.date, (existingCounts.get(row.date) ?? 0) + 1)
  }

  const rows: Array<InsertDto<'planned_entries'>> = []
  const byDay = new Map<number, typeof copiedEntries>()
  for (const entry of copiedEntries) {
    const group = byDay.get(entry.dayIndex) ?? []
    group.push(entry)
    byDay.set(entry.dayIndex, group)
  }

  for (const [dayIndex, dayEntries] of byDay) {
    const targetDate = dateKeys[dayIndex]
    if (!targetDate) continue
    const baseCount = existingCounts.get(targetDate) ?? 0
    const sorted = dayEntries.sort((a, b) => a.sort_order - b.sort_order)
    for (let i = 0; i < sorted.length; i++) {
      const src = sorted[i]
      rows.push({
        user_id: userId,
        program_id: programId,
        date: targetDate,
        session: src.session ?? 'noon',
        exercise_id: src.exercise_id,
        sort_order: baseCount + i,
        sets: src.sets,
        reps: src.reps,
        rep_type: src.rep_type,
        reps_right: src.reps_right,
        weight: src.weight,
        weight_unit: src.weight_unit,
        intensity: src.intensity,
        notes: src.notes,
        timer_id: (src as PlannedEntry).timer_id ?? null,
      })
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('planned_entries').insert(rows)
    if (error) throw error
  }
}

/** Load all entries for a given program across all weeks */
export async function loadProgramEntries(userId: string, programId: string): Promise<PlannedEntry[]> {
  if (isDev) {
    return loadAll().filter((e) => e.user_id === userId && e.program_id === programId)
  }
  const { data, error } = await supabase
    .from('planned_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('program_id', programId)
    .order('date')
    .order('sort_order')
  if (error) throw error
  return asEntries(data ?? [])
}

/** Load all entries for a user — includes program entries and unscoped (program_id: null) entries */
export async function loadUserEntries(userId: string, programId?: string | null): Promise<PlannedEntry[]> {
  if (isDev) {
    return loadAll().filter((e) =>
      e.user_id === userId &&
      (programId ? (e.program_id === programId || e.program_id == null) : true),
    )
  }

  let query = supabase
    .from('planned_entries')
    .select('*')
    .eq('user_id', userId)

  if (programId) {
    query = query.or(`program_id.eq.${programId},program_id.is.null`)
  }

  const { data, error } = await query.order('date').order('sort_order')
  if (error) throw error
  return asEntries(data ?? [])
}
