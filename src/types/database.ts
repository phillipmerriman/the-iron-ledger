export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          avatar_url: string | null
          unit_system: 'imperial' | 'metric'
          preferred_weight_unit: 'lbs' | 'kg' | 'pood'
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          avatar_url?: string | null
          unit_system?: 'imperial' | 'metric'
          preferred_weight_unit?: 'lbs' | 'kg' | 'pood'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          avatar_url?: string | null
          unit_system?: 'imperial' | 'metric'
          preferred_weight_unit?: 'lbs' | 'kg' | 'pood'
          updated_at?: string
        }
      }
      exercises: {
        Row: {
          id: string
          user_id: string
          name: string
          exercise_type: 'strength' | 'cardio' | 'flexibility' | 'warm_up' | 'cool_down' | 'other'
          exercise_rate: 'ballistic' | 'grind' | null
          primary_muscle: string
          equipment: string
          notes: string | null
          color: string | null
          is_archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          exercise_type?: 'strength' | 'cardio' | 'flexibility' | 'warm_up' | 'cool_down' | 'other'
          exercise_rate?: 'ballistic' | 'grind' | null
          primary_muscle?: string
          equipment?: string
          notes?: string | null
          color?: string | null
          is_archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          exercise_type?: 'strength' | 'cardio' | 'flexibility' | 'warm_up' | 'cool_down' | 'other'
          exercise_rate?: 'ballistic' | 'grind' | null
          primary_muscle?: string
          equipment?: string
          notes?: string | null
          color?: string | null
          is_archived?: boolean
          updated_at?: string
        }
      }
      workout_templates: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          updated_at?: string
        }
      }
      workout_template_exercises: {
        Row: {
          id: string
          template_id: string
          exercise_id: string
          sort_order: number
          target_sets: number | null
          target_reps: number | null
          target_weight: number | null
          target_duration_sec: number | null
          rest_seconds: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          template_id: string
          exercise_id: string
          sort_order?: number
          target_sets?: number | null
          target_reps?: number | null
          target_weight?: number | null
          target_duration_sec?: number | null
          rest_seconds?: number | null
          notes?: string | null
        }
        Update: {
          template_id?: string
          exercise_id?: string
          sort_order?: number
          target_sets?: number | null
          target_reps?: number | null
          target_weight?: number | null
          target_duration_sec?: number | null
          rest_seconds?: number | null
          notes?: string | null
        }
      }
      workout_sessions: {
        Row: {
          id: string
          user_id: string
          template_id: string | null
          name: string
          started_at: string
          completed_at: string | null
          duration_sec: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id?: string | null
          name: string
          started_at?: string
          completed_at?: string | null
          duration_sec?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          template_id?: string | null
          name?: string
          started_at?: string
          completed_at?: string | null
          duration_sec?: number | null
          notes?: string | null
        }
      }
      workout_sets: {
        Row: {
          id: string
          session_id: string
          exercise_id: string
          set_number: number
          reps: number | null
          weight: number | null
          duration_sec: number | null
          distance_meters: number | null
          rpe: number | null
          is_warmup: boolean
          notes: string | null
          performed_at: string
        }
        Insert: {
          id?: string
          session_id: string
          exercise_id: string
          set_number: number
          reps?: number | null
          weight?: number | null
          duration_sec?: number | null
          distance_meters?: number | null
          rpe?: number | null
          is_warmup?: boolean
          notes?: string | null
          performed_at?: string
        }
        Update: {
          exercise_id?: string
          set_number?: number
          reps?: number | null
          weight?: number | null
          duration_sec?: number | null
          distance_meters?: number | null
          rpe?: number | null
          is_warmup?: boolean
          notes?: string | null
        }
      }
      programs: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          weeks: number
          start_date: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          weeks?: number
          start_date: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          weeks?: number
          start_date?: string
          is_active?: boolean
          updated_at?: string
        }
      }
      program_days: {
        Row: {
          id: string
          program_id: string
          week_number: number
          day_number: number
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          program_id: string
          week_number?: number
          day_number?: number
          name: string
          sort_order?: number
        }
        Update: {
          program_id?: string
          week_number?: number
          day_number?: number
          name?: string
          sort_order?: number
        }
      }
      program_day_exercises: {
        Row: {
          id: string
          program_day_id: string
          exercise_id: string
          sort_order: number
          target_sets: number | null
          target_reps: number | null
          target_weight: number | null
          target_duration_sec: number | null
          rest_seconds: number | null
          notes: string | null
        }
        Insert: {
          id?: string
          program_day_id: string
          exercise_id: string
          sort_order?: number
          target_sets?: number | null
          target_reps?: number | null
          target_weight?: number | null
          target_duration_sec?: number | null
          rest_seconds?: number | null
          notes?: string | null
        }
        Update: {
          program_day_id?: string
          exercise_id?: string
          sort_order?: number
          target_sets?: number | null
          target_reps?: number | null
          target_weight?: number | null
          target_duration_sec?: number | null
          rest_seconds?: number | null
          notes?: string | null
        }
      }
      personal_records: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          record_type: 'max_weight' | 'max_reps' | 'max_volume' | 'max_duration'
          value: number
          achieved_at: string
          set_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: string
          record_type: 'max_weight' | 'max_reps' | 'max_volume' | 'max_duration'
          value: number
          achieved_at?: string
          set_id?: string | null
          created_at?: string
        }
        Update: {
          exercise_id?: string
          record_type?: 'max_weight' | 'max_reps' | 'max_volume' | 'max_duration'
          value?: number
          achieved_at?: string
          set_id?: string | null
        }
      }
      body_measurements: {
        Row: {
          id: string
          user_id: string
          measured_at: string
          weight: number | null
          body_fat_pct: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          measured_at?: string
          weight?: number | null
          body_fat_pct?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          measured_at?: string
          weight?: number | null
          body_fat_pct?: number | null
          notes?: string | null
        }
      }
    }
  }
}

// Convenience aliases
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type InsertDto<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type UpdateDto<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

export type Profile = Tables<'profiles'>
export type Exercise = Tables<'exercises'>
export type WorkoutTemplate = Tables<'workout_templates'>
export type WorkoutTemplateExercise = Tables<'workout_template_exercises'>
export type WorkoutSession = Tables<'workout_sessions'>
export type WorkoutSet = Tables<'workout_sets'>
export type Program = Tables<'programs'>
export type ProgramDay = Tables<'program_days'>
export type ProgramDayExercise = Tables<'program_day_exercises'>
export type PersonalRecord = Tables<'personal_records'>
export type BodyMeasurement = Tables<'body_measurements'>
