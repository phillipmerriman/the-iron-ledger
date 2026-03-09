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
  planned_entries: ['id', 'user_id', 'program_id', 'exercise_id', 'date', 'session', 'sort_order', 'sets', 'reps', 'rep_type', 'reps_right', 'weight', 'weight_unit', 'intensity', 'notes', 'timer_id', 'created_at'],
  timers: ['id', 'user_id', 'name', 'created_at', 'updated_at'],
  timer_intervals: ['id', 'timer_id', 'name', 'duration_sec', 'sort_order'],
  personal_records: ['id', 'user_id', 'exercise_id', 'record_type', 'value', 'achieved_at', 'set_id', 'created_at'],
  body_measurements: ['id', 'user_id', 'measured_at', 'weight', 'body_fat_pct', 'notes', 'created_at'],
}

function stripExtraColumns(table: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const allowed = TABLE_COLUMNS[table]
  if (!allowed) return rows
  return rows.map((row) => {
    const clean: Record<string, unknown> = {}
    for (const key of Object.keys(row)) {
      if (allowed.has(key)) clean[key] = row[key]
    }
    return clean
  })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Remap any non-standard IDs in the export data to valid v4 UUIDs,
 * preserving all internal foreign-key references between tables.
 */
function remapIds(data: ExportData): ExportData {
  const idMap = new Map<string, string>()

  function remap(id: string | null | undefined): string | null | undefined {
    if (id == null) return id
    if (UUID_RE.test(id)) return id
    if (!idMap.has(id)) idMap.set(id, crypto.randomUUID())
    return idMap.get(id)!
  }

  const c = data.categories
  const out: ExportData = { ...data, categories: {} }

  if (c.exercises) {
    out.categories.exercises = c.exercises.map((r) => ({ ...r, id: remap(r.id)! }))
  }
  if (c.workout_templates) {
    out.categories.workout_templates = c.workout_templates.map((r) => ({ ...r, id: remap(r.id)! }))
  }
  if (c.workout_template_exercises) {
    out.categories.workout_template_exercises = c.workout_template_exercises.map((r) => ({
      ...r,
      id: remap(r.id)!,
      template_id: remap(r.template_id)!,
      exercise_id: remap(r.exercise_id)!,
    }))
  }
  if (c.workout_sessions) {
    const templateIds = new Set(c.workout_templates?.map((t) => t.id) ?? [])
    out.categories.workout_sessions = c.workout_sessions.map((r) => ({
      ...r,
      id: remap(r.id)!,
      template_id: r.template_id && templateIds.has(r.template_id) ? remap(r.template_id)! : null,
    }))
  }
  if (c.workout_sets) {
    out.categories.workout_sets = c.workout_sets.map((r) => ({
      ...r,
      id: remap(r.id)!,
      session_id: remap(r.session_id)!,
      exercise_id: remap(r.exercise_id)!,
    }))
  }
  if (c.programs) {
    out.categories.programs = c.programs.map((r) => ({ ...r, id: remap(r.id)! }))
  }
  if (c.program_days) {
    out.categories.program_days = c.program_days.map((r) => ({
      ...r,
      id: remap(r.id)!,
      program_id: remap(r.program_id)!,
    }))
  }
  if (c.program_day_exercises) {
    out.categories.program_day_exercises = c.program_day_exercises.map((r) => ({
      ...r,
      id: remap(r.id)!,
      program_day_id: remap(r.program_day_id)!,
      exercise_id: remap(r.exercise_id)!,
    }))
  }
  if (c.weekly_plans) {
    const programIds = new Set(c.programs?.map((p) => p.id) ?? [])
    out.categories.weekly_plans = c.weekly_plans.map((r) => ({
      ...r,
      id: remap(r.id)!,
      exercise_id: remap(r.exercise_id)!,
      program_id: r.program_id && programIds.has(r.program_id) ? remap(r.program_id)! : null,
    }))
  }
  if (c.personal_records) {
    const setIds = new Set(c.workout_sets?.map((s) => s.id) ?? [])
    out.categories.personal_records = c.personal_records.map((r) => ({
      ...r,
      id: remap(r.id)!,
      exercise_id: remap(r.exercise_id)!,
      set_id: r.set_id && setIds.has(r.set_id) ? remap(r.set_id)! : null,
    }))
  }
  if (c.body_measurements) {
    out.categories.body_measurements = c.body_measurements.map((r) => ({ ...r, id: remap(r.id)! }))
  }

  return out
}

/** Upsert rows into a Supabase table, stamping user_id on each row. */
async function supabaseUpsert(
  table: TableName,
  incoming: Record<string, unknown>[],
  userId: string,
): Promise<number> {
  if (incoming.length === 0) return 0
  const rows = stripExtraColumns(table, incoming.map((r) => ({ ...r, user_id: userId })))
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
  const rows = stripExtraColumns(table, incoming)
  const { error } = await supabase.from(table).upsert(rows as never, { onConflict: 'id' })
  if (error) throw error
  return incoming.length
}

export async function importData(userId: string, data: ExportData, selectedCategories?: CategoryKey[]): Promise<ImportSummary> {
  // Remap invalid IDs to proper UUIDs for Supabase, preserving cross-references
  if (!isDev) data = remapIds(data)
  const c = data.categories
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
    // Supabase path — insert in FK-safe order.
    // Build a set of known exercise IDs (from import + already in DB).
    const knownExerciseIds = new Set<string>()
    const knownTemplateIds = new Set<string>()
    const knownSessionIds = new Set<string>()
    const knownSetIds = new Set<string>()
    const knownProgramIds = new Set<string>()
    const knownDayIds = new Set<string>()

    // Fetch existing IDs from Supabase so we know what FKs are valid
    const [{ data: existingEx }, { data: existingTpl }, { data: existingSes }, { data: existingPrg }] = await Promise.all([
      supabase.from('exercises').select('id').eq('user_id', userId),
      supabase.from('workout_templates').select('id').eq('user_id', userId),
      supabase.from('workout_sessions').select('id').eq('user_id', userId),
      supabase.from('programs').select('id').eq('user_id', userId),
    ])
    for (const r of existingEx ?? []) knownExerciseIds.add(r.id)
    for (const r of existingTpl ?? []) knownTemplateIds.add(r.id)
    for (const r of existingSes ?? []) knownSessionIds.add(r.id)
    for (const r of existingPrg ?? []) knownProgramIds.add(r.id)

    // 1. Exercises (no FKs)
    if (include('exercises') && c.exercises) {
      result.exercises = await supabaseUpsert('exercises', c.exercises as unknown as Record<string, unknown>[], userId)
      for (const e of c.exercises) knownExerciseIds.add(e.id)
    }

    // 2. Workout templates (no FKs)
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

    // 3. Workout sessions (FK: template_id nullable)
    if (include('workout_sessions') && c.workout_sessions) {
      result.workout_sessions = await supabaseUpsert('workout_sessions', c.workout_sessions as unknown as Record<string, unknown>[], userId)
      for (const s of c.workout_sessions) knownSessionIds.add(s.id)
      if (c.workout_sets) {
        const valid = c.workout_sets.filter(
          (s) => knownSessionIds.has(s.session_id) && knownExerciseIds.has(s.exercise_id),
        )
        result.workout_sets = await supabaseUpsertNoUser('workout_sets', valid as unknown as Record<string, unknown>[])
        for (const s of valid) knownSetIds.add(s.id)
      }
    }

    // 4. Programs (no FKs)
    if (include('programs') && c.programs) {
      result.programs = await supabaseUpsert('programs', c.programs as unknown as Record<string, unknown>[], userId)
      for (const p of c.programs) knownProgramIds.add(p.id)
      if (c.program_days) {
        const valid = c.program_days.filter((d) => knownProgramIds.has(d.program_id))
        result.program_days = await supabaseUpsertNoUser('program_days', valid as unknown as Record<string, unknown>[])
        for (const d of valid) knownDayIds.add(d.id)
      }
      if (c.program_day_exercises) {
        const valid = c.program_day_exercises.filter(
          (de) => knownDayIds.has(de.program_day_id) && knownExerciseIds.has(de.exercise_id),
        )
        result.program_day_exercises = await supabaseUpsertNoUser('program_day_exercises', valid as unknown as Record<string, unknown>[])
      }
    }

    // 5. Weekly plans (FK: exercise_id required, program_id nullable)
    if (include('weekly_plans') && c.weekly_plans) {
      const valid = c.weekly_plans.filter((e) => knownExerciseIds.has(e.exercise_id))
      result.weekly_plans = await supabaseUpsert('planned_entries', valid as unknown as Record<string, unknown>[], userId)
    }

    // 6. Personal records (FK: exercise_id required, set_id nullable)
    if (include('personal_records') && c.personal_records) {
      const valid = c.personal_records.filter((r) => knownExerciseIds.has(r.exercise_id))
      result.personal_records = await supabaseUpsert('personal_records', valid as unknown as Record<string, unknown>[], userId)
    }

    // 7. Body measurements (no FKs beyond user_id)
    if (include('body_measurements') && c.body_measurements) {
      result.body_measurements = await supabaseUpsert('body_measurements', c.body_measurements as unknown as Record<string, unknown>[], userId)
    }
  }

  return result
}
