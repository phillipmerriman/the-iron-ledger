import { localDb } from '@/lib/local-storage'
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
}

export const CATEGORIES: CategoryInfo[] = [
  { key: 'exercises', label: 'Exercises', abbrev: 'ex' },
  { key: 'workout_templates', label: 'Workout Templates', abbrev: 'wt' },
  { key: 'workout_sessions', label: 'Workout Sessions', abbrev: 'ws' },
  { key: 'programs', label: 'Programs', abbrev: 'pg' },
  { key: 'weekly_plans', label: 'Weekly Plans', abbrev: 'wp' },
  { key: 'personal_records', label: 'Personal Records', abbrev: 'pr' },
  { key: 'body_measurements', label: 'Body Measurements', abbrev: 'bm' },
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

export function buildExport(userId: string, selectedCategories: CategoryKey[]): ExportData {
  const data: ExportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    categories: {},
  }

  for (const cat of selectedCategories) {
    switch (cat) {
      case 'exercises':
        data.categories.exercises = localDb
          .getAll('exercises')
          .filter((e) => e.user_id === userId)
        break

      case 'workout_templates':
        data.categories.workout_templates = localDb
          .getAll('workout_templates')
          .filter((t) => t.user_id === userId)
        // Include template exercises for selected templates
        data.categories.workout_template_exercises = localDb
          .getAll('workout_template_exercises')
          .filter((te) =>
            data.categories.workout_templates!.some((t) => t.id === te.template_id),
          )
        break

      case 'workout_sessions': {
        data.categories.workout_sessions = localDb
          .getAll('workout_sessions')
          .filter((s) => s.user_id === userId)
        // Include sets for selected sessions
        const sessionIds = new Set(data.categories.workout_sessions.map((s) => s.id))
        data.categories.workout_sets = localDb
          .getAll('workout_sets')
          .filter((s) => sessionIds.has(s.session_id))
        break
      }

      case 'programs': {
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
        break
      }

      case 'weekly_plans': {
        const raw = localStorage.getItem('fittrack:weekly_plan')
        if (raw) {
          const all = JSON.parse(raw) as PlannedEntry[]
          data.categories.weekly_plans = all.filter((e) => e.user_id === userId)
        }
        break
      }

      case 'personal_records':
        data.categories.personal_records = localDb
          .getAll('personal_records')
          .filter((r) => r.user_id === userId)
        break

      case 'body_measurements':
        data.categories.body_measurements = localDb
          .getAll('body_measurements')
          .filter((m) => m.user_id === userId)
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

export function importData(userId: string, data: ExportData, selectedCategories?: CategoryKey[]): ImportSummary {
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

  return result
}
