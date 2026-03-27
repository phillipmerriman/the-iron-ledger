import { useCallback, useEffect, useState } from 'react'
import { supabase, isDev } from '@/lib/supabase'
import { localDb } from '@/lib/local-storage'
import { useAuth } from '@/contexts/AuthContext'
import type { Exercise, InsertDto, UpdateDto } from '@/types/database'

const sortByName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name)

export default function useExercises(options?: { skip?: boolean }) {
  const { user } = useAuth()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(!options?.skip)

  const fetch = useCallback(async () => {
    if (!user || options?.skip) return
    setLoading(true)
    if (isDev) {
      const all = localDb.getAll('exercises').filter((e) => e.user_id === user.id)
      setExercises(all.sort(sortByName))
    } else {
      const { data } = await supabase
        .from('exercises')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
      setExercises(data ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function create(values: Omit<InsertDto<'exercises'>, 'user_id'>) {
    if (!user) return
    if (isDev) {
      const now = new Date().toISOString()
      const row: Exercise = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: values.name,
        exercise_type: values.exercise_type ?? 'strength',
        exercise_rate: values.exercise_rate ?? null,
        color: values.color ?? null,
        primary_muscle: values.primary_muscle ?? 'other',
        equipment: values.equipment ?? 'bodyweight',
        notes: values.notes ?? null,
        is_archived: false,
        default_sets: values.default_sets ?? null,
        default_reps: values.default_reps ?? null,
        default_rep_type: values.default_rep_type ?? 'single',
        default_weight: values.default_weight ?? null,
        default_weight_unit: values.default_weight_unit ?? 'lbs',
        default_intensity: values.default_intensity ?? null,
        created_at: now,
        updated_at: now,
      }
      localDb.insert('exercises', row)
      setExercises((prev) => [...prev, row].sort(sortByName))
      return row
    }
    const { data, error } = await supabase
      .from('exercises')
      .insert({ ...values, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    setExercises((prev) => [...prev, data].sort(sortByName))
    return data
  }

  async function update(id: string, values: UpdateDto<'exercises'>) {
    if (isDev) {
      const updated = localDb.update('exercises', id, values)
      if (!updated) throw new Error('Exercise not found')
      setExercises((prev) =>
        prev.map((e) => (e.id === id ? (updated as Exercise) : e)).sort(sortByName),
      )
      return updated as Exercise
    }
    const { data, error } = await supabase
      .from('exercises')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? data : e)).sort(sortByName),
    )
    return data
  }

  async function archive(id: string) {
    return update(id, { is_archived: true })
  }

  async function unarchive(id: string) {
    return update(id, { is_archived: false })
  }

  async function remove(id: string) {
    if (isDev) {
      localDb.remove('exercises', id)
    } else {
      const { error } = await supabase.from('exercises').delete().eq('id', id)
      if (error) throw error
    }
    setExercises((prev) => prev.filter((e) => e.id !== id))
  }

  return { exercises, loading, refetch: fetch, create, update, archive, unarchive, remove }
}
