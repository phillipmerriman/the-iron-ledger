import { useCallback, useEffect, useState } from 'react'
import { addDays, differenceInDays, parseISO, format, startOfWeek } from 'date-fns'
import { supabase, isDev } from '@/lib/supabase'
import { localDb } from '@/lib/local-storage'
import { useAuth } from '@/contexts/AuthContext'
import type { Program, ProgramDay, ProgramDayExercise, ProgramActivation, InsertDto, UpdateDto } from '@/types/database'

const sortByName = (a: Program, b: Program) => a.name.localeCompare(b.name)

const ACTIVATIONS_KEY = 'fittrack:program_activations'

function loadActivations(): ProgramActivation[] {
  const raw = localStorage.getItem(ACTIVATIONS_KEY)
  return raw ? JSON.parse(raw) : []
}

function saveActivations(activations: ProgramActivation[]) {
  localStorage.setItem(ACTIVATIONS_KEY, JSON.stringify(activations))
}

export default function usePrograms() {
  const { user } = useAuth()
  const [programs, setPrograms] = useState<Program[]>([])
  const [activations, setActivations] = useState<ProgramActivation[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    if (isDev) {
      const all = localDb.getAll('programs').filter((p) => p.user_id === user.id)
      setPrograms(all.sort(sortByName))
      setActivations(loadActivations().filter((a) => a.user_id === user.id))
    } else {
      const { data } = await supabase
        .from('programs')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
      setPrograms(data ?? [])
      const { data: acts } = await supabase
        .from('program_activations')
        .select('*')
        .eq('user_id', user.id)
      setActivations(acts ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function create(values: Omit<InsertDto<'programs'>, 'user_id'>) {
    if (!user) return
    if (isDev) {
      const now = new Date().toISOString()
      const row: Program = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: values.name,
        description: values.description ?? null,
        weeks: values.weeks ?? 1,
        start_date: values.start_date,
        is_active: values.is_active ?? false,
        created_at: now,
        updated_at: now,
      }
      localDb.insert('programs', row)
      setPrograms((prev) => [...prev, row].sort(sortByName))
      return row
    }
    const { data, error } = await supabase
      .from('programs')
      .insert({ ...values, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    setPrograms((prev) => [...prev, data].sort(sortByName))
    return data
  }

  async function update(id: string, values: UpdateDto<'programs'>) {
    if (isDev) {
      const updated = localDb.update('programs', id, values)
      if (!updated) throw new Error('Program not found')
      setPrograms((prev) =>
        prev.map((p) => (p.id === id ? (updated as Program) : p)).sort(sortByName),
      )
      return updated as Program
    }
    const { data, error } = await supabase
      .from('programs')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setPrograms((prev) =>
      prev.map((p) => (p.id === id ? data : p)).sort(sortByName),
    )
    return data
  }

  async function remove(id: string) {
    if (isDev) {
      // Remove child days and their exercises first
      const days = localDb.getAll('program_days').filter((d) => d.program_id === id)
      for (const day of days) {
        const dayExercises = localDb.getAll('program_day_exercises').filter((de) => de.program_day_id === day.id)
        for (const de of dayExercises) localDb.remove('program_day_exercises', de.id)
        localDb.remove('program_days', day.id)
      }
      localDb.remove('programs', id)
    } else {
      const { error } = await supabase.from('programs').delete().eq('id', id)
      if (error) throw error
    }
    setPrograms((prev) => prev.filter((p) => p.id !== id))
  }

  async function activate(programId: string, newStartDate: string) {
    if (!user) return

    const program = programs.find((p) => p.id === programId)
    if (!program) return

    // Snap the chosen start date to its week's Sunday
    const chosenSunday = format(startOfWeek(parseISO(newStartDate), { weekStartsOn: 0 }), 'yyyy-MM-dd')

    // Create activation record
    const activation: ProgramActivation = {
      id: crypto.randomUUID(),
      user_id: user.id,
      program_id: programId,
      start_date: chosenSunday,
      created_at: new Date().toISOString(),
    }

    // Calculate day offset between template start and chosen start
    const templateStart = parseISO(program.start_date)
    const activationStart = parseISO(chosenSunday)
    const dayOffset = differenceInDays(activationStart, templateStart)

    // Load all template entries and copy them with shifted dates, scoped to activation ID
    const STORAGE_KEY = 'fittrack:weekly_plan'

    if (isDev) {
      // Load template entries
      const allEntries = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Record<string, unknown>[]
      const templateEntries = allEntries.filter((e) => e.program_id === programId)

      // Create copies scoped to the activation
      const copies = templateEntries.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        program_id: activation.id,
        date: format(addDays(parseISO(e.date as string), dayOffset), 'yyyy-MM-dd'),
      }))

      allEntries.push(...copies)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allEntries))

      // Save activation
      const acts = loadActivations()
      acts.push(activation)
      saveActivations(acts)
    } else {
      // Save activation to Supabase
      const { error: actErr } = await supabase.from('program_activations').insert(activation)
      if (actErr) throw actErr

      // Load template entries
      const { data: templateEntries } = await supabase
        .from('planned_entries')
        .select('*')
        .eq('program_id', programId)

      if (templateEntries && templateEntries.length > 0) {
        const copies = templateEntries.map((e) => ({
          user_id: e.user_id,
          program_id: activation.id,
          date: format(addDays(parseISO(e.date), dayOffset), 'yyyy-MM-dd'),
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
        }))
        const { error } = await supabase.from('planned_entries').insert(copies)
        if (error) throw error
      }
    }

    setActivations((prev) => [...prev, activation])
  }

  async function deactivate(activationId: string) {
    if (!user) return
    const today = format(new Date(), 'yyyy-MM-dd')

    if (isDev) {
      // Remove future entries for this activation, keep past/today
      const STORAGE_KEY = 'fittrack:weekly_plan'
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const entries = JSON.parse(raw) as { program_id: string | null; date: string }[]
        const filtered = entries.filter((e) =>
          e.program_id !== activationId || e.date <= today,
        )
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      }

      // Remove activation record
      const acts = loadActivations().filter((a) => a.id !== activationId)
      saveActivations(acts)
    } else {
      // Remove future entries
      await supabase
        .from('planned_entries')
        .delete()
        .eq('program_id', activationId)
        .gt('date', today)

      // Remove activation record
      await supabase.from('program_activations').delete().eq('id', activationId)
    }

    setActivations((prev) => prev.filter((a) => a.id !== activationId))
  }

  return { programs, activations, loading, refetch: fetch, create, update, remove, activate, deactivate }
}

// ---- Program Days ----

export function useProgramDays(programId: string) {
  const [days, setDays] = useState<ProgramDay[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    if (isDev) {
      const all = localDb.getAll('program_days').filter((d) => d.program_id === programId)
      setDays(all.sort((a, b) => a.week_number - b.week_number || a.sort_order - b.sort_order))
    } else {
      const { data } = await supabase
        .from('program_days')
        .select('*')
        .eq('program_id', programId)
        .order('week_number')
        .order('sort_order')
      setDays(data ?? [])
    }
    setLoading(false)
  }, [programId])

  useEffect(() => { fetch() }, [fetch])

  async function addDay(values: Omit<InsertDto<'program_days'>, 'program_id'>) {
    if (isDev) {
      const row: ProgramDay = {
        id: crypto.randomUUID(),
        program_id: programId,
        week_number: values.week_number ?? 1,
        day_number: values.day_number ?? 1,
        name: values.name,
        sort_order: values.sort_order ?? days.length,
      }
      localDb.insert('program_days', row)
      setDays((prev) => [...prev, row].sort((a, b) => a.week_number - b.week_number || a.sort_order - b.sort_order))
      return row
    }
    const { data, error } = await supabase
      .from('program_days')
      .insert({ ...values, program_id: programId })
      .select()
      .single()
    if (error) throw error
    setDays((prev) => [...prev, data].sort((a, b) => a.week_number - b.week_number || a.sort_order - b.sort_order))
    return data
  }

  async function updateDay(id: string, values: UpdateDto<'program_days'>) {
    if (isDev) {
      const updated = localDb.update('program_days', id, values)
      if (!updated) throw new Error('Day not found')
      setDays((prev) =>
        prev.map((d) => (d.id === id ? (updated as ProgramDay) : d))
          .sort((a, b) => a.week_number - b.week_number || a.sort_order - b.sort_order),
      )
      return updated as ProgramDay
    }
    const { data, error } = await supabase
      .from('program_days')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setDays((prev) =>
      prev.map((d) => (d.id === id ? data : d))
        .sort((a, b) => a.week_number - b.week_number || a.sort_order - b.sort_order),
    )
    return data
  }

  async function removeDay(id: string) {
    if (isDev) {
      const dayExercises = localDb.getAll('program_day_exercises').filter((de) => de.program_day_id === id)
      for (const de of dayExercises) localDb.remove('program_day_exercises', de.id)
      localDb.remove('program_days', id)
    } else {
      const { error } = await supabase.from('program_days').delete().eq('id', id)
      if (error) throw error
    }
    setDays((prev) => prev.filter((d) => d.id !== id))
  }

  return { days, loading, refetch: fetch, addDay, updateDay, removeDay }
}

// ---- Program Day Exercises ----

export function useProgramDayExercises(dayId: string) {
  const [dayExercises, setDayExercises] = useState<ProgramDayExercise[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    if (isDev) {
      const all = localDb.getAll('program_day_exercises').filter((de) => de.program_day_id === dayId)
      setDayExercises(all.sort((a, b) => a.sort_order - b.sort_order))
    } else {
      const { data } = await supabase
        .from('program_day_exercises')
        .select('*')
        .eq('program_day_id', dayId)
        .order('sort_order')
      setDayExercises(data ?? [])
    }
    setLoading(false)
  }, [dayId])

  useEffect(() => { fetch() }, [fetch])

  async function addExercise(values: Omit<InsertDto<'program_day_exercises'>, 'program_day_id'>) {
    if (isDev) {
      const row: ProgramDayExercise = {
        id: crypto.randomUUID(),
        program_day_id: dayId,
        exercise_id: values.exercise_id,
        sort_order: values.sort_order ?? dayExercises.length,
        target_sets: values.target_sets ?? null,
        target_reps: values.target_reps ?? null,
        target_weight: values.target_weight ?? null,
        target_duration_sec: values.target_duration_sec ?? null,
        rest_seconds: values.rest_seconds ?? null,
        notes: values.notes ?? null,
      }
      localDb.insert('program_day_exercises', row)
      setDayExercises((prev) => [...prev, row].sort((a, b) => a.sort_order - b.sort_order))
      return row
    }
    const { data, error } = await supabase
      .from('program_day_exercises')
      .insert({ ...values, program_day_id: dayId })
      .select()
      .single()
    if (error) throw error
    setDayExercises((prev) => [...prev, data].sort((a, b) => a.sort_order - b.sort_order))
    return data
  }

  async function updateExercise(id: string, values: UpdateDto<'program_day_exercises'>) {
    if (isDev) {
      const updated = localDb.update('program_day_exercises', id, values)
      if (!updated) throw new Error('Day exercise not found')
      setDayExercises((prev) =>
        prev.map((de) => (de.id === id ? (updated as ProgramDayExercise) : de))
          .sort((a, b) => a.sort_order - b.sort_order),
      )
      return updated as ProgramDayExercise
    }
    const { data, error } = await supabase
      .from('program_day_exercises')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setDayExercises((prev) =>
      prev.map((de) => (de.id === id ? data : de))
        .sort((a, b) => a.sort_order - b.sort_order),
    )
    return data
  }

  async function removeExercise(id: string) {
    if (isDev) {
      localDb.remove('program_day_exercises', id)
    } else {
      const { error } = await supabase.from('program_day_exercises').delete().eq('id', id)
      if (error) throw error
    }
    setDayExercises((prev) => prev.filter((de) => de.id !== id))
  }

  return { dayExercises, loading, refetch: fetch, addExercise, updateExercise, removeExercise }
}
