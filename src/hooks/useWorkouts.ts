import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { supabase, isDev } from '@/lib/supabase'
import { localDb } from '@/lib/local-storage'
import { useAuth } from '@/contexts/AuthContext'
import { calcEntryVolume } from '@/types/common'
import { loadUserEntries } from '@/hooks/useWeeklyPlan'
import type { WorkoutSession, WorkoutSet, InsertDto, UpdateDto } from '@/types/database'

const sortByDate = (a: WorkoutSession, b: WorkoutSession) =>
  new Date(b.started_at).getTime() - new Date(a.started_at).getTime()

export default function useWorkouts() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    if (isDev) {
      const all = localDb.getAll('workout_sessions').filter((s) => s.user_id === user.id) as WorkoutSession[]
      // Migrate: backfill total_weight_moved for completed sessions missing it
      const needsMigration = all.filter((s) => s.completed_at && (s.total_weight_moved == null || typeof s.total_weight_moved === 'number'))
      if (needsMigration.length > 0) {
        const planned = await loadUserEntries(user.id)
        const preferredUnit = 'lbs'
        for (const s of needsMigration) {
          if (typeof s.total_weight_moved === 'number') {
            // Migrate old numeric value to string
            s.total_weight_moved = `${(s.total_weight_moved as number).toLocaleString()} ${preferredUnit}`
          } else {
            const dateKey = format(new Date(s.started_at), 'yyyy-MM-dd')
            const dayEntries = planned.filter((e) => e.date === dateKey)
            const total = dayEntries.reduce((sum, e) =>
              sum + calcEntryVolume(e.sets, e.reps, e.rep_type, e.reps_right, e.weight, e.weight_unit, preferredUnit), 0)
            s.total_weight_moved = total > 0 ? `${total.toLocaleString()} ${preferredUnit}` : null
          }
          localDb.update('workout_sessions', s.id, { total_weight_moved: s.total_weight_moved } as never)
        }
      }
      setSessions(all.sort(sortByDate))
    } else {
      const { data } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })
      setSessions(data ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function create(values: Omit<InsertDto<'workout_sessions'>, 'user_id'>) {
    if (!user) return
    if (isDev) {
      const now = new Date().toISOString()
      const row: WorkoutSession = {
        id: crypto.randomUUID(),
        user_id: user.id,
        template_id: values.template_id ?? null,
        name: values.name,
        started_at: values.started_at ?? now,
        completed_at: values.completed_at ?? null,
        duration_sec: values.duration_sec ?? null,
        total_weight_moved: values.total_weight_moved ?? null,
        notes: values.notes ?? null,
        created_at: now,
      }
      localDb.insert('workout_sessions', row)
      setSessions((prev) => [row, ...prev])
      return row
    }
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({ ...values, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    setSessions((prev) => [data, ...prev])
    return data
  }

  async function update(id: string, values: UpdateDto<'workout_sessions'>) {
    if (isDev) {
      const updated = localDb.update('workout_sessions', id, values)
      if (!updated) throw new Error('Session not found')
      setSessions((prev) =>
        prev.map((s) => (s.id === id ? (updated as WorkoutSession) : s)).sort(sortByDate),
      )
      return updated as WorkoutSession
    }
    const { data, error } = await supabase
      .from('workout_sessions')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? data : s)).sort(sortByDate),
    )
    return data
  }

  async function remove(id: string) {
    if (isDev) {
      const sets = localDb.getAll('workout_sets').filter((s) => s.session_id === id)
      for (const s of sets) localDb.remove('workout_sets', s.id)
      localDb.remove('workout_sessions', id)
    } else {
      const { error } = await supabase.from('workout_sessions').delete().eq('id', id)
      if (error) throw error
    }
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  return { sessions, loading, refetch: fetch, create, update, remove }
}

// ---- Workout Sets ----

export function useWorkoutSets(sessionId: string) {
  const [sets, setSets] = useState<WorkoutSet[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    if (isDev) {
      const all = localDb.getAll('workout_sets').filter((s) => s.session_id === sessionId)
      setSets(all.sort((a, b) => {
        if (a.exercise_id !== b.exercise_id) return a.exercise_id.localeCompare(b.exercise_id)
        return a.set_number - b.set_number
      }))
    } else {
      const { data } = await supabase
        .from('workout_sets')
        .select('*')
        .eq('session_id', sessionId)
        .order('performed_at')
      setSets(data ?? [])
    }
    setLoading(false)
  }, [sessionId])

  useEffect(() => { fetch() }, [fetch])

  async function addSet(values: Omit<InsertDto<'workout_sets'>, 'session_id'>) {
    if (isDev) {
      const row: WorkoutSet = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        exercise_id: values.exercise_id,
        set_number: values.set_number,
        reps: values.reps ?? null,
        weight: values.weight ?? null,
        duration_sec: values.duration_sec ?? null,
        distance_meters: values.distance_meters ?? null,
        rpe: values.rpe ?? null,
        is_warmup: values.is_warmup ?? false,
        notes: values.notes ?? null,
        performed_at: values.performed_at ?? new Date().toISOString(),
      }
      localDb.insert('workout_sets', row)
      setSets((prev) => [...prev, row])
      return row
    }
    const { data, error } = await supabase
      .from('workout_sets')
      .insert({ ...values, session_id: sessionId })
      .select()
      .single()
    if (error) throw error
    setSets((prev) => [...prev, data])
    return data
  }

  async function updateSet(id: string, values: UpdateDto<'workout_sets'>) {
    if (isDev) {
      const updated = localDb.update('workout_sets', id, values)
      if (!updated) throw new Error('Set not found')
      setSets((prev) => prev.map((s) => (s.id === id ? (updated as WorkoutSet) : s)))
      return updated as WorkoutSet
    }
    const { data, error } = await supabase
      .from('workout_sets')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setSets((prev) => prev.map((s) => (s.id === id ? data : s)))
    return data
  }

  async function removeSet(id: string) {
    if (isDev) {
      localDb.remove('workout_sets', id)
    } else {
      const { error } = await supabase.from('workout_sets').delete().eq('id', id)
      if (error) throw error
    }
    setSets((prev) => prev.filter((s) => s.id !== id))
  }

  return { sets, loading, refetch: fetch, addSet, updateSet, removeSet }
}
