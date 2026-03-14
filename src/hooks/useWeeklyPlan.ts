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

export type Session = 'all' | 'morning' | 'noon' | 'night'
export const SESSIONS: Session[] = ['all', 'morning', 'noon', 'night']
export const SESSION_LABELS: Record<Session, string> = {
  all: 'Any',
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
  set_markers: boolean
}

export type PlannedEntryUpdate = Partial<Pick<PlannedEntry, 'exercise_id' | 'sets' | 'reps' | 'rep_type' | 'reps_right' | 'weight' | 'weight_unit' | 'intensity' | 'notes' | 'session' | 'timer_id' | 'set_markers'>>

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
    set_markers: !!(e as Record<string, unknown>).set_markers,
  }))
}

function saveAll(entries: PlannedEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

/** Cast Supabase row to PlannedEntry (types are compatible) */
function asEntry(row: Record<string, unknown>): PlannedEntry {
  const entry = row as unknown as PlannedEntry
  if (entry.set_markers == null) entry.set_markers = false
  return entry
}

function asEntries(rows: Record<string, unknown>[]): PlannedEntry[] {
  return rows.map(asEntry)
}

interface UseWeeklyPlanOptions {
  startDate?: Date
  weekOffset?: number
  programId?: string | null
  /** Pass multiple IDs to include entries from several activations */
  programIds?: string[]
  includeUnscoped?: boolean
}

export default function useWeeklyPlan(options: UseWeeklyPlanOptions = {}) {
  const { user } = useAuth()
  const {
    startDate = new Date(),
    weekOffset = 0,
    programId = null,
    programIds,
    includeUnscoped = false,
  } = options

  const [entries, setEntries] = useState<PlannedEntry[]>([])

  const weekStart = startOfWeek(addWeeks(startDate, weekOffset), { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dateKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  const fetch = useCallback(async () => {
    if (!user) return
    const hasMultiple = programIds && programIds.length > 0

    if (isDev) {
      const today = format(new Date(), 'yyyy-MM-dd')
      const all = loadAll().filter(
        (e) =>
          e.user_id === user.id &&
          dateKeys.includes(e.date) &&
          (hasMultiple
            ? (programIds.includes(e.program_id!) || e.program_id == null || e.date <= today)
            : programId
              ? (e.program_id === programId || (includeUnscoped && e.program_id == null))
              : (e.program_id == null || e.date <= today)),
      )
      setEntries(all)
    } else {
      const today = format(new Date(), 'yyyy-MM-dd')
      let query = supabase
        .from('planned_entries')
        .select('*')
        .eq('user_id', user.id)
        .in('date', dateKeys)

      if (hasMultiple) {
        const idFilters = programIds.map((id) => `program_id.eq.${id}`).join(',')
        query = query.or(`${idFilters},program_id.is.null,date.lte.${today}`)
      } else if (programId) {
        if (includeUnscoped) {
          query = query.or(`program_id.eq.${programId},program_id.is.null`)
        } else {
          query = query.eq('program_id', programId)
        }
      } else {
        // Show unscoped entries + past program entries (today and earlier)
        query = query.or(`program_id.is.null,date.lte.${today}`)
      }

      const { data, error } = await query.order('sort_order')
      if (error) throw error
      setEntries(asEntries(data ?? []))
    }
  }, [user, dateKeys.join(','), programId, programIds?.join(','), includeUnscoped])

  useEffect(() => { fetch() }, [fetch])

  function getEntriesForDate(dateKey: string) {
    const sessionOrder = { all: 0, morning: 1, noon: 2, night: 3 }
    return entries
      .filter((e) => e.date === dateKey)
      .sort((a, b) => (sessionOrder[a.session] - sessionOrder[b.session]) || (a.sort_order - b.sort_order))
  }

  function getEntriesForDateSession(dateKey: string, session: Session) {
    return entries
      .filter((e) => e.date === dateKey && e.session === session)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  async function addEntry(dateKey: string, exerciseId: string, presets?: PlannedEntryUpdate, session: Session = 'all') {
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
      set_markers: presets?.set_markers ?? false,
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
        set_markers: entry.set_markers,
      })
      if (error) throw error
    }
    setEntries((prev) => [...prev, entry])
  }

  async function addEntries(dateKey: string, items: { exerciseId: string; presets?: PlannedEntryUpdate }[], session: Session = 'all') {
    if (!user || items.length === 0) return
    const existing = entries.filter((e) => e.date === dateKey && e.session === session)
    const newEntries: PlannedEntry[] = items.map((item, i) => ({
      id: crypto.randomUUID(),
      user_id: user.id,
      program_id: programId,
      date: dateKey,
      session,
      exercise_id: item.exerciseId,
      sort_order: existing.length + i,
      sets: item.presets?.sets ?? 3,
      reps: item.presets?.reps ?? 10,
      rep_type: item.presets?.rep_type ?? 'single',
      reps_right: item.presets?.reps_right ?? null,
      weight: item.presets?.weight ?? null,
      weight_unit: item.presets?.weight_unit ?? 'lbs',
      intensity: item.presets?.intensity ?? null,
      notes: item.presets?.notes ?? null,
      timer_id: item.presets?.timer_id ?? null,
      set_markers: item.presets?.set_markers ?? false,
    }))

    if (isDev) {
      const all = loadAll()
      all.push(...newEntries)
      saveAll(all)
    } else {
      const { error } = await supabase.from('planned_entries').insert(
        newEntries.map((e) => ({
          id: e.id,
          user_id: e.user_id,
          program_id: e.program_id,
          date: e.date,
          session: e.session,
          exercise_id: e.exercise_id,
          sort_order: e.sort_order,
          sets: e.sets,
          reps: e.reps,
          rep_type: e.rep_type,
          reps_right: e.reps_right,
          weight: e.weight,
          weight_unit: e.weight_unit,
          intensity: e.intensity,
          notes: e.notes,
          timer_id: e.timer_id,
          set_markers: e.set_markers,
        })),
      )
      if (error) throw error
    }
    setEntries((prev) => [...prev, ...newEntries])
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
    addEntries,
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
          set_markers: (src as PlannedEntry).set_markers ?? false,
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
        set_markers: (src as PlannedEntry).set_markers ?? false,
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
export async function loadUserEntries(userId: string, activationIds?: string[]): Promise<PlannedEntry[]> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const hasActivations = activationIds && activationIds.length > 0

  if (isDev) {
    return loadAll().filter((e) =>
      e.user_id === userId &&
      (hasActivations
        ? (activationIds.includes(e.program_id!) || e.program_id == null || e.date <= today)
        : (e.program_id == null || e.date <= today)),
    )
  }

  let query = supabase
    .from('planned_entries')
    .select('*')
    .eq('user_id', userId)

  if (hasActivations) {
    const idFilters = activationIds.map((id) => `program_id.eq.${id}`).join(',')
    query = query.or(`${idFilters},program_id.is.null,date.lte.${today}`)
  } else {
    query = query.or(`program_id.is.null,date.lte.${today}`)
  }

  const { data, error } = await query.order('date').order('sort_order')
  if (error) throw error
  return asEntries(data ?? [])
}

/** Remove unscoped entries on dates that already have entries for the given program */
export async function removeUnscopedDuplicates(userId: string, programId: string) {
  if (isDev) {
    const all = loadAll()
    // Find dates that have entries for this program
    const programDates = new Set(
      all.filter((e) => e.user_id === userId && e.program_id === programId).map((e) => e.date),
    )
    // Remove unscoped entries on those same dates
    const kept = all.filter(
      (e) => !(e.user_id === userId && e.program_id == null && programDates.has(e.date)),
    )
    saveAll(kept)
    return
  }

  // Get dates that have program entries
  const { data: programEntries } = await supabase
    .from('planned_entries')
    .select('date')
    .eq('user_id', userId)
    .eq('program_id', programId)
  if (!programEntries?.length) return

  const dates = [...new Set(programEntries.map((e) => e.date))]
  const { error } = await supabase
    .from('planned_entries')
    .delete()
    .eq('user_id', userId)
    .is('program_id', null)
    .in('date', dates)
  if (error) throw error
}

/** Remove planned entries for a program that are strictly after today */
export async function clearFutureEntries(userId: string, programId: string) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const cutoff = tomorrow.toISOString().slice(0, 10) // yyyy-MM-dd

  if (isDev) {
    const kept = loadAll().filter(
      (e) => !(e.user_id === userId && e.program_id === programId && e.date >= cutoff),
    )
    saveAll(kept)
    return
  }
  const { error } = await supabase
    .from('planned_entries')
    .delete()
    .eq('user_id', userId)
    .eq('program_id', programId)
    .gte('date', cutoff)
  if (error) throw error
}
