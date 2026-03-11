import { useCallback, useEffect, useState } from 'react'
import { supabase, isDev } from '@/lib/supabase'
import { localDb } from '@/lib/local-storage'
import { useAuth } from '@/contexts/AuthContext'
import type { WorkoutTemplate, WorkoutTemplateExercise, InsertDto } from '@/types/database'
import type { PlannedEntry } from './useWeeklyPlan'
import type { RepType, WeightUnit } from '@/types/common'

export interface TemplateExerciseExtras {
  rep_type: RepType
  reps_right: number | null
  weight_unit: WeightUnit
  target_duration_sec: number | null
  intensity: 'light' | 'heavy' | null
  user_notes: string | null
  timer_id: string | null
}

const EXTRAS_DEFAULTS: TemplateExerciseExtras = {
  rep_type: 'single',
  reps_right: null,
  weight_unit: 'lbs',
  target_duration_sec: null,
  intensity: null,
  user_notes: null,
  timer_id: null,
}

/** Parse extra fields stored as JSON in the notes column */
function parseExtras(notes: string | null): TemplateExerciseExtras {
  if (!notes) return { ...EXTRAS_DEFAULTS }
  try {
    return { ...EXTRAS_DEFAULTS, ...JSON.parse(notes) }
  } catch {
    return { ...EXTRAS_DEFAULTS }
  }
}

export default function useWorkoutTemplates() {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([])
  const [templateExercises, setTemplateExercises] = useState<WorkoutTemplateExercise[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    if (isDev) {
      const allT = localDb.getAll('workout_templates').filter((t) => t.user_id === user.id)
      const tIds = new Set(allT.map((t) => t.id))
      const allE = localDb.getAll('workout_template_exercises').filter((e) => tIds.has(e.template_id))
      setTemplates(allT)
      setTemplateExercises(allE)
    } else {
      const { data: tData } = await supabase
        .from('workout_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setTemplates(tData ?? [])
      if (tData && tData.length > 0) {
        const ids = tData.map((t) => t.id)
        const { data: eData } = await supabase
          .from('workout_template_exercises')
          .select('*')
          .in('template_id', ids)
          .order('sort_order')
        setTemplateExercises(eData ?? [])
      } else {
        setTemplateExercises([])
      }
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  function getExercisesForTemplate(templateId: string) {
    return templateExercises
      .filter((e) => e.template_id === templateId)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  async function create(name: string, description?: string) {
    if (!user) return
    const now = new Date().toISOString()
    if (isDev) {
      const row: WorkoutTemplate = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name,
        description: description ?? null,
        created_at: now,
        updated_at: now,
      }
      localDb.insert('workout_templates', row)
      setTemplates((prev) => [row, ...prev])
      return row
    }
    const { data, error } = await supabase
      .from('workout_templates')
      .insert({ user_id: user.id, name, description: description ?? null } satisfies InsertDto<'workout_templates'>)
      .select()
      .single()
    if (error) throw error
    setTemplates((prev) => [data, ...prev])
    return data
  }

  async function addExercise(templateId: string, values: Omit<InsertDto<'workout_template_exercises'>, 'template_id'>) {
    if (isDev) {
      const row: WorkoutTemplateExercise = {
        id: crypto.randomUUID(),
        template_id: templateId,
        exercise_id: values.exercise_id,
        sort_order: values.sort_order ?? 0,
        target_sets: values.target_sets ?? null,
        target_reps: values.target_reps ?? null,
        target_weight: values.target_weight ?? null,
        target_duration_sec: values.target_duration_sec ?? null,
        rest_seconds: values.rest_seconds ?? null,
        notes: values.notes ?? null,
      }
      localDb.insert('workout_template_exercises', row)
      setTemplateExercises((prev) => [...prev, row])
      return row
    }
    const { data, error } = await supabase
      .from('workout_template_exercises')
      .insert({ ...values, template_id: templateId })
      .select()
      .single()
    if (error) throw error
    setTemplateExercises((prev) => [...prev, data])
    return data
  }

  /** Update a template's name/description and replace all its exercises */
  async function updateTemplate(
    id: string,
    fields: { name: string; description?: string },
    newExercises: Omit<InsertDto<'workout_template_exercises'>, 'template_id'>[],
  ) {
    const now = new Date().toISOString()
    if (isDev) {
      // Update template row
      const all = localDb.getAll('workout_templates')
      const idx = all.findIndex((t) => t.id === id)
      if (idx !== -1) {
        all[idx] = { ...all[idx], name: fields.name, description: fields.description ?? null, updated_at: now }
        localStorage.setItem('fittrack:workout_templates', JSON.stringify(all))
      }
      // Remove old exercises
      const oldExs = localDb.getAll('workout_template_exercises').filter((e) => e.template_id === id)
      for (const e of oldExs) localDb.remove('workout_template_exercises', e.id)
      // Add new exercises
      const addedExs: WorkoutTemplateExercise[] = []
      for (const values of newExercises) {
        const row: WorkoutTemplateExercise = {
          id: crypto.randomUUID(),
          template_id: id,
          exercise_id: values.exercise_id,
          sort_order: values.sort_order ?? 0,
          target_sets: values.target_sets ?? null,
          target_reps: values.target_reps ?? null,
          target_weight: values.target_weight ?? null,
          target_duration_sec: values.target_duration_sec ?? null,
          rest_seconds: values.rest_seconds ?? null,
          notes: values.notes ?? null,
        }
        localDb.insert('workout_template_exercises', row)
        addedExs.push(row)
      }
      setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, name: fields.name, description: fields.description ?? null, updated_at: now } : t))
      setTemplateExercises((prev) => [...prev.filter((e) => e.template_id !== id), ...addedExs])
    } else {
      const { error } = await supabase
        .from('workout_templates')
        .update({ name: fields.name, description: fields.description ?? null, updated_at: now })
        .eq('id', id)
      if (error) throw error
      // Remove old exercises and insert new
      await supabase.from('workout_template_exercises').delete().eq('template_id', id)
      if (newExercises.length > 0) {
        const rows = newExercises.map((v) => ({ ...v, template_id: id }))
        const { data, error: exErr } = await supabase.from('workout_template_exercises').insert(rows).select()
        if (exErr) throw exErr
        setTemplateExercises((prev) => [...prev.filter((e) => e.template_id !== id), ...(data ?? [])])
      } else {
        setTemplateExercises((prev) => prev.filter((e) => e.template_id !== id))
      }
      setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, name: fields.name, description: fields.description ?? null, updated_at: now } : t))
    }
  }

  async function remove(id: string) {
    if (isDev) {
      const exs = localDb.getAll('workout_template_exercises').filter((e) => e.template_id === id)
      for (const e of exs) localDb.remove('workout_template_exercises', e.id)
      localDb.remove('workout_templates', id)
    } else {
      await supabase.from('workout_template_exercises').delete().eq('template_id', id)
      const { error } = await supabase.from('workout_templates').delete().eq('id', id)
      if (error) throw error
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id))
    setTemplateExercises((prev) => prev.filter((e) => e.template_id !== id))
  }

  /** Save a day's planned entries as a new workout template */
  async function saveDay(name: string, entries: PlannedEntry[]) {
    const template = await create(name)
    if (!template) return
    for (const entry of entries) {
      const extras: TemplateExerciseExtras = {
        rep_type: entry.rep_type,
        reps_right: entry.reps_right,
        weight_unit: entry.weight_unit,
        target_duration_sec: entry.rep_type === 'time' ? entry.reps : null,
        intensity: entry.intensity ?? null,
        user_notes: entry.notes ?? null,
      }
      await addExercise(template.id, {
        exercise_id: entry.exercise_id,
        sort_order: entry.sort_order,
        target_sets: entry.sets,
        target_reps: entry.rep_type === 'time' ? null : entry.reps,
        target_weight: entry.weight,
        target_duration_sec: entry.rep_type === 'time' ? entry.reps : null,
        rest_seconds: null,
        notes: JSON.stringify(extras),
      })
    }
    return template
  }

  return {
    templates,
    templateExercises,
    loading,
    refetch: fetch,
    getExercisesForTemplate,
    create,
    addExercise,
    remove,
    updateTemplate,
    saveDay,
    parseExtras,
  }
}
