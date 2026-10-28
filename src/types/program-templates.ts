import type { ProgramTemplateType } from './database'
import type { RepType, WeightUnit } from './common'
import type { Session } from '@/hooks/useWeeklyPlan'

export type { ProgramTemplateType }

export type IncrementMode = 'auto' | 'manual'

/** Settings chosen in the Wildman wizard — stored in programs.template_config */
export interface WildmanConfig {
  exercise_id: string
  rep_type: RepType
  min_reps: number
  max_reps: number
  min_sets: number
  max_sets: number
  weight: number | null
  weight_unit: WeightUnit
  /** Optional approximate body weight, used only for guidance */
  body_weight: number | null
  body_weight_unit: WeightUnit
  /** Stage key ("sets x topReps") → timer id */
  stage_timers: Record<string, string | null>
  session: Exclude<Session, 'all'>
  /** 0 = Sunday … 6 = Saturday */
  days_of_week: number[]
  increment_mode: IncrementMode
  /** Sessions every stage lasts; null = based on the stage's rep count × sessions_rep_factor */
  sessions_per_stage: number | null
  /** Fraction of the rep count used when sessions_per_stage is null (1, 0.5 or 0.25) */
  sessions_rep_factor: number
  /** Stage key → sessions for that stage, overriding the rule above */
  stage_sessions: Record<string, number>
  /** Minutes per set for 'reps_per_minute' (Single / Min); null = 1 */
  minutes: number | null
  /** Notes copied onto every scheduled workout */
  notes: string | null
}

/** A one-off move of a single scheduled workout */
export interface ScheduleOverride {
  from: string // yyyy-MM-dd the generator would have used
  to: string   // yyyy-MM-dd the workout was moved to
}

/** Progression state — stored in program_activations.progress */
export interface WildmanProgress {
  stage_index: number
  /** Completions on/after this date count toward the current stage */
  stage_started_on: string
  /** Sessions added (+) or removed (−) from the current stage's default length (auto mode) */
  extra_sessions: number
  weight: number | null
  weight_unit: WeightUnit
  cycle: number
  /** First day of the current cycle (missing = the activation's start date) */
  cycle_started_on?: string
  overrides: ScheduleOverride[]
  /** Last date the schedule was regenerated — used to reschedule missed days */
  synced_on: string
}

export interface WildmanStage {
  sets: number
  topReps: number
}
