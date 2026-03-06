import { localDb } from '@/lib/local-storage'
import { supabase, isDev } from '@/lib/supabase'
import type { Database } from '@/types/database'

type TableName = keyof Database['public']['Tables']
import { format } from 'date-fns'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import type {
  Exercise,
  WorkoutTemplate,
  WorkoutTemplateExercise,
  WorkoutSession,
  WorkoutSet,
  Program,
  ProgramDay,
  ProgramDayExercise,
  PersonalRecord,
  BodyMeasurement,
} from '@/types/database'

export type CategoryKey =
  | 'exercises'
  | 'workout_templates'
  | 'workout_sessions'
  | 'programs'
  | 'weekly_plans'
  | 'personal_records'
  | 'body_measurements'

export interface CategoryInfo {
  key: CategoryKey
  label: string
  abbrev: string
  description: string
}

export const CATEGORIES: CategoryInfo[] = [
  { key: 'exercises', label: 'Exercises', abbrev: 'ex', description: 'Custom exercises with name, muscle group, equipment, and color' },
  { key: 'workout_templates', label: 'Workout Templates', abbrev: 'wt', description: 'Saved workout templates and their exercise lists' },
  { key: 'workout_sessions', label: 'Workout Sessions', abbrev: 'ws', description: 'Logged workouts with dates, duration, total weight moved, and recorded sets' },
  { key: 'programs', label: 'Programs', abbrev: 'pg', description: 'Training programs with day schedules and exercise assignments' },
  { key: 'weekly_plans', label: 'Weekly Plans', abbrev: 'wp', description: 'Planned exercises per day with sets, reps, weight, and intensity' },
  { key: 'personal_records', label: 'Personal Records', abbrev: 'pr', description: 'PR entries with exercise, weight, reps, and date achieved' },
  { key: 'body_measurements', label: 'Body Measurements', abbrev: 'bm', description: 'Body weight, body fat, and other measurements over time' },
]

export interface ExportData {
  version: 1
  exported_at: string
  categories: {
    exercises?: Exercise[]
    workout_templates?: WorkoutTemplate[]
    workout_template_exercises?: WorkoutTemplateExercise[]
    workout_sessions?: WorkoutSession[]
    workout_sets?: WorkoutSet[]
    programs?: Program[]
    program_days?: ProgramDay[]
    program_day_exercises?: ProgramDayExercise[]
    weekly_plans?: PlannedEntry[]
    personal_records?: PersonalRecord[]
    body_measurements?: BodyMeasurement[]
  }
}

export async function buildExport(userId: string, selectedCategories: CategoryKey[]): Promise<ExportData> {
  const data: ExportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    categories: {},
  }

  for (const cat of selectedCategories) {
    switch (cat) {
      case 'exercises':
        if (isDev) {
          data.categories.exercises = localDb
            .getAll('exercises')
            .filter((e) => e.user_id === userId)
        } else {
          const { data: rows } = await supabase
            .from('exercises')
            .select('*')
            .eq('user_id', userId)
          data.categories.exercises = (rows ?? []) as Exercise[]
        }
        break

      case 'workout_templates':
        if (isDev) {
          data.categories.workout_templates = localDb
            .getAll('workout_templates')
            .filter((t) => t.user_id === userId)
          data.categories.workout_template_exercises = localDb
            .getAll('workout_template_exercises')
            .filter((te) =>
              data.categories.workout_templates!.some((t) => t.id === te.template_id),
            )
        } else {
          const { data: templates } = await supabase
            .from('workout_templates')
            .select('*')
            .eq('user_id', userId)
          data.categories.workout_templates = (templates ?? []) as WorkoutTemplate[]
          if (data.categories.workout_templates.length > 0) {
            const ids = data.categories.workout_templates.map((t) => t.id)
            const { data: texs } = await supabase
              .from('workout_template_exercises')
              .select('*')
              .in('template_id', ids)
            data.categories.workout_template_exercises = (texs ?? []) as WorkoutTemplateExercise[]
          }
        }
        break

      case 'workout_sessions': {
        if (isDev) {
          data.categories.workout_sessions = localDb
            .getAll('workout_sessions')
            .filter((s) => s.user_id === userId)
          const sessionIds = new Set(data.categories.workout_sessions.map((s) => s.id))
          data.categories.workout_sets = localDb
            .getAll('workout_sets')
            .filter((s) => sessionIds.has(s.session_id))
        } else {
          const { data: sessions } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', userId)
          data.categories.workout_sessions = (sessions ?? []) as WorkoutSession[]
          if (data.categories.workout_sessions.length > 0) {
            const ids = data.categories.workout_sessions.map((s) => s.id)
            const { data: sets } = await supabase
              .from('workout_sets')
              .select('*')
              .in('session_id', ids)
            data.categories.workout_sets = (sets ?? []) as WorkoutSet[]
          }
        }
        break
      }

      case 'programs': {
        if (isDev) {
          data.categories.programs = localDb
            .getAll('programs')
            .filter((p) => p.user_id === userId)
          const programIds = new Set(data.categories.programs.map((p) => p.id))
          data.categories.program_days = localDb
            .getAll('program_days')
            .filter((d) => programIds.has(d.program_id))
          const dayIds = new Set(data.categories.program_days.map((d) => d.id))
          data.categories.program_day_exercises = localDb
            .getAll('program_day_exercises')
            .filter((de) => dayIds.has(de.program_day_id))
        } else {
          const { data: programs } = await supabase
            .from('programs')
            .select('*')
            .eq('user_id', userId)
          data.categories.programs = (programs ?? []) as Program[]
          if (data.categories.programs.length > 0) {
            const pIds = data.categories.programs.map((p) => p.id)
            const { data: days } = await supabase
              .from('program_days')
              .select('*')
              .in('program_id', pIds)
            data.categories.program_days = (days ?? []) as ProgramDay[]
            if (data.categories.program_days.length > 0) {
              const dIds = data.categories.program_days.map((d) => d.id)
              const { data: dexs } = await supabase
                .from('program_day_exercises')
                .select('*')
                .in('program_day_id', dIds)
              data.categories.program_day_exercises = (dexs ?? []) as ProgramDayExercise[]
            }
          }
        }
        break
      }

      case 'weekly_plans': {
        if (isDev) {
          const raw = localStorage.getItem('fittrack:weekly_plan')
          if (raw) {
            const all = JSON.parse(raw) as PlannedEntry[]
            data.categories.weekly_plans = all.filter((e) => e.user_id === userId)
          }
        } else {
          const { data: entries } = await supabase
            .from('planned_entries')
            .select('*')
            .eq('user_id', userId)
          data.categories.weekly_plans = (entries ?? []) as PlannedEntry[]
        }
        break
      }

      case 'personal_records':
        if (isDev) {
          data.categories.personal_records = localDb
            .getAll('personal_records')
            .filter((r) => r.user_id === userId)
        } else {
          const { data: rows } = await supabase
            .from('personal_records')
            .select('*')
            .eq('user_id', userId)
          data.categories.personal_records = (rows ?? []) as PersonalRecord[]
        }
        break

      case 'body_measurements':
        if (isDev) {
          data.categories.body_measurements = localDb
            .getAll('body_measurements')
            .filter((m) => m.user_id === userId)
        } else {
          const { data: rows } = await supabase
            .from('body_measurements')
            .select('*')
            .eq('user_id', userId)
          data.categories.body_measurements = (rows ?? []) as BodyMeasurement[]
        }
        break
    }
  }

  return data
}

export function getExportFilename(selectedCategories: CategoryKey[]): string {
  const date = format(new Date(), 'yyyy-MM-dd')
  const allSelected = selectedCategories.length === CATEGORIES.length
  const suffix = allSelected
    ? 'all'
    : CATEGORIES
        .filter((c) => selectedCategories.includes(c.key))
        .map((c) => c.abbrev)
        .join('-')
  return `fittrack-${date}-${suffix}.json`
}

export function downloadJson(data: ExportData, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface ImportSummary {
  exercises: number
  workout_templates: number
  workout_template_exercises: number
  workout_sessions: number
  workout_sets: number
  programs: number
  program_days: number
  program_day_exercises: number
  weekly_plans: number
  personal_records: number
  body_measurements: number
}

export function parseImportFile(file: File): Promise<ExportData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as ExportData
        if (!data.version || !data.categories) {
          reject(new Error('Invalid export file format'))
          return
        }
        resolve(data)
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export function getImportSummary(data: ExportData): ImportSummary {
  const c = data.categories
  return {
    exercises: c.exercises?.length ?? 0,
    workout_templates: c.workout_templates?.length ?? 0,
    workout_template_exercises: c.workout_template_exercises?.length ?? 0,
    workout_sessions: c.workout_sessions?.length ?? 0,
    workout_sets: c.workout_sets?.length ?? 0,
    programs: c.programs?.length ?? 0,
    program_days: c.program_days?.length ?? 0,
    program_day_exercises: c.program_day_exercises?.length ?? 0,
    weekly_plans: c.weekly_plans?.length ?? 0,
    personal_records: c.personal_records?.length ?? 0,
    body_measurements: c.body_measurements?.length ?? 0,
  }
}

/** Check for exercises in the import file that share a name with existing exercises. */
export async function findDuplicateExerciseNames(
  userId: string,
  data: ExportData,
): Promise<string[]> {
  const incoming = data.categories.exercises
  if (!incoming?.length) return []

  if (isDev) {
    const existing = localDb.getAll('exercises').filter((e) => e.user_id === userId)
    const existingNames = new Set(existing.map((e) => e.name.toLowerCase()))
    return [...new Set(incoming.filter((e) => existingNames.has(e.name.toLowerCase())).map((e) => e.name))]
  }

  const { data: existing } = await supabase
    .from('exercises')
    .select('name')
    .eq('user_id', userId)
  const existingNames = new Set((existing ?? []).map((e) => e.name.toLowerCase()))
  return [...new Set(incoming.filter((e) => existingNames.has(e.name.toLowerCase())).map((e) => e.name))]
}

/** Remove exercises (and their dependents) whose names match the given list. */
export function stripDuplicateExercises(data: ExportData, duplicateNames: string[]): ExportData {
  if (!data.categories.exercises || duplicateNames.length === 0) return data
  const dupeSet = new Set(duplicateNames.map((n) => n.toLowerCase()))
  const removedIds = new Set<string>()
  const keptExercises = data.categories.exercises.filter((e) => {
    if (dupeSet.has(e.name.toLowerCase())) {
      removedIds.add(e.id)
      return false
    }
    return true
  })

  const out: ExportData = { ...data, categories: { ...data.categories, exercises: keptExercises } }

  // Filter child tables that reference removed exercise IDs
  if (out.categories.workout_template_exercises) {
    out.categories.workout_template_exercises = out.categories.workout_template_exercises.filter(
      (te) => !removedIds.has(te.exercise_id),
    )
  }
  if (out.categories.workout_sets) {
    out.categories.workout_sets = out.categories.workout_sets.filter(
      (s) => !removedIds.has(s.exercise_id),
    )
  }
  if (out.categories.program_day_exercises) {
    out.categories.program_day_exercises = out.categories.program_day_exercises.filter(
      (de) => !removedIds.has(de.exercise_id),
    )
  }
  if (out.categories.weekly_plans) {
    out.categories.weekly_plans = out.categories.weekly_plans.filter(
      (e) => !removedIds.has(e.exercise_id),
    )
  }
  if (out.categories.personal_records) {
    out.categories.personal_records = out.categories.personal_records.filter(
      (r) => !removedIds.has(r.exercise_id),
    )
  }

  return out
}

/** Returns the CategoryKeys that have data in the export file */
export function getAvailableImportCategories(data: ExportData): CategoryKey[] {
  const c = data.categories
  const available: CategoryKey[] = []
  if (c.exercises?.length) available.push('exercises')
  if (c.workout_templates?.length) available.push('workout_templates')
  if (c.workout_sessions?.length) available.push('workout_sessions')
  if (c.programs?.length) available.push('programs')
  if (c.weekly_plans?.length) available.push('weekly_plans')
  if (c.personal_records?.length) available.push('personal_records')
  if (c.body_measurements?.length) available.push('body_measurements')
  return available
}

function upsertRows<T extends { id: string }>(
  table: Parameters<typeof localDb.getAll>[0],
  incoming: T[],
  userId: string,
) {
  const existing = localDb.getAll(table) as unknown as T[]
  const existingMap = new Map(existing.map((r) => [r.id, r]))
  let count = 0
  for (const row of incoming) {
    const withUser = { ...row, user_id: userId } as T
    existingMap.set(row.id, withUser)
    count++
  }
  localDb.setAll(table, [...existingMap.values()] as never)
  return count
}

function upsertRowsNoUserId<T extends { id: string }>(
  table: Parameters<typeof localDb.getAll>[0],
  incoming: T[],
) {
  const existing = localDb.getAll(table) as unknown as T[]
  const existingMap = new Map(existing.map((r) => [r.id, r]))
  let count = 0
  for (const row of incoming) {
    existingMap.set(row.id, row)
    count++
  }
  localDb.setAll(table, [...existingMap.values()] as never)
  return count
}

// Columns that exist in each Supabase table (used to strip extra fields from localStorage exports)
const TABLE_COLUMNS: Record<string, string[]> = {
  exercises: ['id', 'user_id', 'name', 'exercise_type', 'exercise_rate', 'primary_muscle', 'equipment', 'notes', 'color', 'is_archived', 'created_at', 'updated_at'],
  workout_templates: ['id', 'user_id', 'name', 'description', 'created_at', 'updated_at'],
  workout_template_exercises: ['id', 'template_id', 'exercise_id', 'sort_order', 'target_sets', 'target_reps', 'target_weight', 'target_duration_sec', 'rest_seconds', 'notes'],
  workout_sessions: ['id', 'user_id', 'template_id', 'name', 'started_at', 'completed_at', 'duration_sec', 'total_weight_moved', 'notes', 'created_at'],
  workout_sets: ['id', 'session_id', 'exercise_id', 'set_number', 'reps', 'weight', 'duration_sec', 'distance_meters', 'rpe', 'is_warmup', 'notes', 'performed_at'],
  programs: ['id', 'user_id', 'name', 'description', 'weeks', 'start_date', 'is_active', 'created_at', 'updated_at'],
  program_days: ['id', 'program_id', 'week_number', 'day_number', 'name', 'sort_order'],
  program_day_exercises: ['id', 'program_day_id', 'exercise_id', 'sort_order', 'target_sets', 'target_reps', 'target_weight', 'target_duration_sec', 'rest_seconds', 'notes'],
  planned_entries: ['id', 'user_id', 'program_id', 'exercise_id', 'date', 'session', 'sort_order', 'sets', 'reps', 'rep_type', 'reps_right', 'weight', 'weight_unit', 'intensity', 'notes', 'created_at'],
  personal_records: ['id', 'user_id', 'exercise_id', 'record_type', 'value', 'achieved_at', 'set_id', 'created_at'],
  body_measurements: ['id', 'user_id', 'measured_at', 'weight', 'body_fat_pct', 'notes', 'created_at'],
}

/** Remove columns not present in the Supabase table schema. */
function stripExtraColumns(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const allowed = TABLE_COLUMNS[table]
  if (!allowed) return rows
  const allowedSet = new Set(allowed)
  return rows.map((r) => {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(r)) {
      if (allowedSet.has(key)) out[key] = r[key]
    }
    return out
  })
}

// Valid UUID v4 regex
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** All fields across import data that hold an ID or FK reference. */
const ID_FIELDS = ['id', 'user_id', 'exercise_id', 'template_id', 'session_id', 'program_id', 'program_day_id', 'set_id']

/**
 * Walk every row in every category of the import data and replace any invalid
 * UUID with a valid v4 UUID. The same bad ID always maps to the same new UUID
 * so FK references are preserved.
 */
function remapIds(data: ExportData): ExportData {
  const map = new Map<string, string>()

  function remap(val: unknown): unknown {
    if (typeof val !== 'string' || !val) return val
    if (UUID_RE.test(val)) return val // already valid
    if (!map.has(val)) map.set(val, crypto.randomUUID())
    return map.get(val)!
  }

  function processRows(rows: Record<string, unknown>[] | undefined): Record<string, unknown>[] | undefined {
    if (!rows) return rows
    return rows.map((row) => {
      const out: Record<string, unknown> = { ...row }
      for (const field of ID_FIELDS) {
        if (field in out && out[field] != null) {
          out[field] = remap(out[field])
        }
      }
      return out
    })
  }

  const c = data.categories
  return {
    ...data,
    categories: {
      exercises: processRows(c.exercises as unknown as Record<string, unknown>[]) as unknown as Exercise[] | undefined,
      workout_templates: processRows(c.workout_templates as unknown as Record<string, unknown>[]) as unknown as WorkoutTemplate[] | undefined,
      workout_template_exercises: processRows(c.workout_template_exercises as unknown as Record<string, unknown>[]) as unknown as WorkoutTemplateExercise[] | undefined,
      workout_sessions: processRows(c.workout_sessions as unknown as Record<string, unknown>[]) as unknown as WorkoutSession[] | undefined,
      workout_sets: processRows(c.workout_sets as unknown as Record<string, unknown>[]) as unknown as WorkoutSet[] | undefined,
      programs: processRows(c.programs as unknown as Record<string, unknown>[]) as unknown as Program[] | undefined,
      program_days: processRows(c.program_days as unknown as Record<string, unknown>[]) as unknown as ProgramDay[] | undefined,
      program_day_exercises: processRows(c.program_day_exercises as unknown as Record<string, unknown>[]) as unknown as ProgramDayExercise[] | undefined,
      weekly_plans: processRows(c.weekly_plans as unknown as Record<string, unknown>[]) as unknown as PlannedEntry[] | undefined,
      personal_records: processRows(c.personal_records as unknown as Record<string, unknown>[]) as unknown as PersonalRecord[] | undefined,
      body_measurements: processRows(c.body_measurements as unknown as Record<string, unknown>[]) as unknown as BodyMeasurement[] | undefined,
    },
  }
}

/** Upsert rows into a Supabase table, stamping user_id on each row. */
async function supabaseUpsert(
  table: TableName,
  incoming: Record<string, unknown>[],
  userId: string,
): Promise<number> {
  if (incoming.length === 0) return 0
  const stripped = stripExtraColumns(table, incoming)
  const rows = stripped.map((r) => ({ ...r, user_id: userId }))
  const { error } = await supabase.from(table).upsert(rows as never, { onConflict: 'id' })
  if (error) throw error
  return rows.length
}

/** Upsert rows into a Supabase table without setting user_id. */
async function supabaseUpsertNoUser(
  table: TableName,
  incoming: Record<string, unknown>[],
): Promise<number> {
  if (incoming.length === 0) return 0
  const stripped = stripExtraColumns(table, incoming)
  const { error } = await supabase.from(table).upsert(stripped as never, { onConflict: 'id' })
  if (error) throw error
  return stripped.length
}

/** Fetch existing IDs from a Supabase table for a given user. */
async function fetchExistingIds(table: TableName, userId: string): Promise<Set<string>> {
  const { data: rows } = await supabase.from(table).select('id').eq('user_id', userId)
  return new Set((rows ?? []).map((r: { id: string }) => r.id))
}

/** Fetch existing IDs from a child table (no user_id filter, by parent FK). */
async function fetchChildIds(table: TableName, fkColumn: string, parentIds: string[]): Promise<Set<string>> {
  if (parentIds.length === 0) return new Set()
  const { data: rows } = await supabase.from(table).select('id').in(fkColumn, parentIds)
  return new Set((rows ?? []).map((r: { id: string }) => r.id))
}

export async function importData(userId: string, rawData: ExportData, selectedCategories?: CategoryKey[]): Promise<ImportSummary> {
  const sel = selectedCategories ? new Set(selectedCategories) : null
  const include = (key: CategoryKey) => !sel || sel.has(key)
  const result: ImportSummary = {
    exercises: 0,
    workout_templates: 0,
    workout_template_exercises: 0,
    workout_sessions: 0,
    workout_sets: 0,
    programs: 0,
    program_days: 0,
    program_day_exercises: 0,
    weekly_plans: 0,
    personal_records: 0,
    body_measurements: 0,
  }

  // Remap any invalid UUIDs across ALL categories (even unchecked ones)
  // so FK references stay consistent
  const data = remapIds(rawData)
  const c = data.categories

  if (isDev) {
    // Local-storage path (unchanged)
    if (include('exercises') && c.exercises) {
      result.exercises = upsertRows('exercises', c.exercises, userId)
    }
    if (include('workout_templates') && c.workout_templates) {
      result.workout_templates = upsertRows('workout_templates', c.workout_templates, userId)
      if (c.workout_template_exercises) {
        result.workout_template_exercises = upsertRowsNoUserId(
          'workout_template_exercises',
          c.workout_template_exercises,
        )
      }
    }
    if (include('workout_sessions') && c.workout_sessions) {
      result.workout_sessions = upsertRows('workout_sessions', c.workout_sessions, userId)
      if (c.workout_sets) {
        result.workout_sets = upsertRowsNoUserId('workout_sets', c.workout_sets)
      }
    }
    if (include('programs') && c.programs) {
      result.programs = upsertRows('programs', c.programs, userId)
      if (c.program_days) {
        result.program_days = upsertRowsNoUserId('program_days', c.program_days)
      }
      if (c.program_day_exercises) {
        result.program_day_exercises = upsertRowsNoUserId(
          'program_day_exercises',
          c.program_day_exercises,
        )
      }
    }
    if (include('weekly_plans') && c.weekly_plans) {
      const raw = localStorage.getItem('fittrack:weekly_plan')
      const existing = raw ? (JSON.parse(raw) as PlannedEntry[]) : []
      const existingMap = new Map(existing.map((e) => [e.id, e]))
      for (const entry of c.weekly_plans) {
        existingMap.set(entry.id, { ...entry, user_id: userId })
      }
      localStorage.setItem(
        'fittrack:weekly_plan',
        JSON.stringify([...existingMap.values()]),
      )
      result.weekly_plans = c.weekly_plans.length
    }
    if (include('personal_records') && c.personal_records) {
      result.personal_records = upsertRows('personal_records', c.personal_records, userId)
    }
    if (include('body_measurements') && c.body_measurements) {
      result.body_measurements = upsertRows('body_measurements', c.body_measurements, userId)
    }
  } else {
    // Supabase path — FK-safe ordering with dangling FK filtering

    // 1. Gather known IDs from DB so we can validate FKs for unchecked categories
    const knownExerciseIds = await fetchExistingIds('exercises', userId)
    const knownTemplateIds = await fetchExistingIds('workout_templates', userId)
    const knownSessionIds = await fetchExistingIds('workout_sessions', userId)
    const knownProgramIds = await fetchExistingIds('programs', userId)
    let knownDayIds: Set<string> = new Set()
    if (knownProgramIds.size > 0) {
      knownDayIds = await fetchChildIds('program_days', 'program_id', [...knownProgramIds])
    }

    // 2. Exercises first (other tables depend on exercise_id)
    //    If exercises category is checked, import all of them.
    //    If unchecked, auto-import any exercises referenced by other selected categories
    //    that don't already exist in the DB.
    if (include('exercises') && c.exercises) {
      result.exercises = await supabaseUpsert('exercises', c.exercises as unknown as Record<string, unknown>[], userId)
      for (const ex of c.exercises) knownExerciseIds.add(ex.id)
    } else if (c.exercises?.length) {
      // Collect exercise IDs needed by other selected categories
      const neededIds = new Set<string>()
      if (include('workout_templates') && c.workout_template_exercises) {
        for (const te of c.workout_template_exercises) neededIds.add(te.exercise_id)
      }
      if (include('workout_sessions') && c.workout_sets) {
        for (const s of c.workout_sets) neededIds.add(s.exercise_id)
      }
      if (include('programs') && c.program_day_exercises) {
        for (const de of c.program_day_exercises) neededIds.add(de.exercise_id)
      }
      if (include('weekly_plans') && c.weekly_plans) {
        for (const e of c.weekly_plans) neededIds.add(e.exercise_id)
      }
      if (include('personal_records') && c.personal_records) {
        for (const r of c.personal_records) neededIds.add(r.exercise_id)
      }
      // Filter to exercises that are in the import file but missing from the DB
      const missingExercises = c.exercises.filter(
        (ex) => neededIds.has(ex.id) && !knownExerciseIds.has(ex.id),
      )
      if (missingExercises.length > 0) {
        const added = await supabaseUpsert('exercises', missingExercises as unknown as Record<string, unknown>[], userId)
        result.exercises = added
        for (const ex of missingExercises) knownExerciseIds.add(ex.id)
      }
    }

    // 3. Templates
    if (include('workout_templates') && c.workout_templates) {
      result.workout_templates = await supabaseUpsert('workout_templates', c.workout_templates as unknown as Record<string, unknown>[], userId)
      for (const t of c.workout_templates) knownTemplateIds.add(t.id)
      if (c.workout_template_exercises) {
        const valid = c.workout_template_exercises.filter(
          (te) => knownTemplateIds.has(te.template_id) && knownExerciseIds.has(te.exercise_id),
        )
        result.workout_template_exercises = await supabaseUpsertNoUser('workout_template_exercises', valid as unknown as Record<string, unknown>[])
      }
    }

    // 4. Sessions
    if (include('workout_sessions') && c.workout_sessions) {
      // Null out template_id if the referenced template doesn't exist
      const sessions = c.workout_sessions.map((s) => ({
        ...s,
        template_id: s.template_id && knownTemplateIds.has(s.template_id) ? s.template_id : null,
      }))
      result.workout_sessions = await supabaseUpsert('workout_sessions', sessions as unknown as Record<string, unknown>[], userId)
      for (const s of c.workout_sessions) knownSessionIds.add(s.id)
      if (c.workout_sets) {
        const valid = c.workout_sets.filter(
          (s) => knownSessionIds.has(s.session_id) && knownExerciseIds.has(s.exercise_id),
        )
        result.workout_sets = await supabaseUpsertNoUser('workout_sets', valid as unknown as Record<string, unknown>[])
      }
    }

    // 5. Programs
    if (include('programs') && c.programs) {
      result.programs = await supabaseUpsert('programs', c.programs as unknown as Record<string, unknown>[], userId)
      for (const p of c.programs) knownProgramIds.add(p.id)
      if (c.program_days) {
        const validDays = c.program_days.filter((d) => knownProgramIds.has(d.program_id))
        result.program_days = await supabaseUpsertNoUser('program_days', validDays as unknown as Record<string, unknown>[])
        for (const d of validDays) knownDayIds.add(d.id)
      }
      if (c.program_day_exercises) {
        const valid = c.program_day_exercises.filter(
          (de) => knownDayIds.has(de.program_day_id) && knownExerciseIds.has(de.exercise_id),
        )
        result.program_day_exercises = await supabaseUpsertNoUser('program_day_exercises', valid as unknown as Record<string, unknown>[])
      }
    }

    // 6. Weekly plans (planned_entries)
    if (include('weekly_plans') && c.weekly_plans) {
      const valid = c.weekly_plans
        .filter((e) => knownExerciseIds.has(e.exercise_id))
        .map((e) => ({
          ...e,
          program_id: e.program_id && knownProgramIds.has(e.program_id) ? e.program_id : null,
        }))
      result.weekly_plans = await supabaseUpsert('planned_entries', valid as unknown as Record<string, unknown>[], userId)
    }

    // 7. Personal records
    if (include('personal_records') && c.personal_records) {
      const valid = c.personal_records
        .filter((r) => knownExerciseIds.has(r.exercise_id))
        .map((r) => ({
          ...r,
          set_id: r.set_id ? null : null, // set_id FK is fragile; null it out
        }))
      result.personal_records = await supabaseUpsert('personal_records', valid as unknown as Record<string, unknown>[], userId)
    }

    // 8. Body measurements (no FKs to worry about)
    if (include('body_measurements') && c.body_measurements) {
      result.body_measurements = await supabaseUpsert('body_measurements', c.body_measurements as unknown as Record<string, unknown>[], userId)
    }
  }

  return result
}
