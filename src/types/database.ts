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
        Relationships: []
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
          default_sets: number | null
          default_reps: number | null
          default_rep_type: 'single' | 'left_right' | 'time' | 'ladder_up' | 'double_ladder_up' | 'reverse_ladder' | 'double_reverse_ladder' | 'ladder' | 'double_ladder' | 'reps_per_minute' | 'left_right_per_minute' | 'ladder_up_per_minute' | 'double_ladder_up_per_minute' | 'reverse_ladder_per_minute' | 'double_reverse_ladder_per_minute' | 'ladder_per_minute' | 'double_ladder_per_minute'
          default_weight: number | null
          default_weight_unit: 'lbs' | 'kg' | 'pood' | 'bodyweight'
          default_intensity: 'light' | 'heavy' | null
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
          default_sets?: number | null
          default_reps?: number | null
          default_rep_type?: 'single' | 'left_right' | 'time' | 'ladder_up' | 'double_ladder_up' | 'reverse_ladder' | 'double_reverse_ladder' | 'ladder' | 'double_ladder' | 'reps_per_minute' | 'left_right_per_minute' | 'ladder_up_per_minute' | 'double_ladder_up_per_minute' | 'reverse_ladder_per_minute' | 'double_reverse_ladder_per_minute' | 'ladder_per_minute' | 'double_ladder_per_minute'
          default_weight?: number | null
          default_weight_unit?: 'lbs' | 'kg' | 'pood' | 'bodyweight'
          default_intensity?: 'light' | 'heavy' | null
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
          default_sets?: number | null
          default_reps?: number | null
          default_rep_type?: 'single' | 'left_right' | 'time' | 'ladder_up' | 'double_ladder_up' | 'reverse_ladder' | 'double_reverse_ladder' | 'ladder' | 'double_ladder' | 'reps_per_minute' | 'left_right_per_minute' | 'ladder_up_per_minute' | 'double_ladder_up_per_minute' | 'reverse_ladder_per_minute' | 'double_reverse_ladder_per_minute' | 'ladder_per_minute' | 'double_ladder_per_minute'
          default_weight?: number | null
          default_weight_unit?: 'lbs' | 'kg' | 'pood' | 'bodyweight'
          default_intensity?: 'light' | 'heavy' | null
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
          total_weight_moved: string | null
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
          total_weight_moved?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          template_id?: string | null
          name?: string
          started_at?: string
          completed_at?: string | null
          duration_sec?: number | null
          total_weight_moved?: string | null
          notes?: string | null
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      timers: {
        Row: {
          id: string
          user_id: string
          name: string
          pause_between_intervals: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          pause_between_intervals?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          pause_between_intervals?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      timer_intervals: {
        Row: {
          id: string
          timer_id: string
          name: string
          duration_sec: number
          sort_order: number
        }
        Insert: {
          id?: string
          timer_id: string
          name: string
          duration_sec: number
          sort_order?: number
        }
        Update: {
          timer_id?: string
          name?: string
          duration_sec?: number
          sort_order?: number
        }
        Relationships: []
      }
      planned_entries: {
        Row: {
          id: string
          user_id: string
          program_id: string | null
          exercise_id: string
          timer_id: string | null
          date: string
          session: 'all' | 'morning' | 'noon' | 'night'
          sort_order: number
          sets: number | null
          reps: number | null
          rep_type: 'single' | 'left_right' | 'ladder_up' | 'double_ladder_up' | 'reverse_ladder' | 'double_reverse_ladder' | 'ladder' | 'double_ladder' | 'time' | 'reps_per_minute' | 'left_right_per_minute' | 'ladder_up_per_minute' | 'double_ladder_up_per_minute' | 'reverse_ladder_per_minute' | 'double_reverse_ladder_per_minute' | 'ladder_per_minute' | 'double_ladder_per_minute'
          reps_right: number | null
          weight: number | null
          weight_unit: 'lbs' | 'kg' | 'pood' | 'bodyweight'
          intensity: 'light' | 'heavy' | null
          notes: string | null
          set_markers: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          program_id?: string | null
          exercise_id: string
          timer_id?: string | null
          date: string
          session?: 'all' | 'morning' | 'noon' | 'night'
          sort_order?: number
          sets?: number | null
          reps?: number | null
          rep_type?: 'single' | 'left_right' | 'ladder_up' | 'double_ladder_up' | 'reverse_ladder' | 'double_reverse_ladder' | 'ladder' | 'double_ladder' | 'time' | 'reps_per_minute' | 'left_right_per_minute' | 'ladder_up_per_minute' | 'double_ladder_up_per_minute' | 'reverse_ladder_per_minute' | 'double_reverse_ladder_per_minute' | 'ladder_per_minute' | 'double_ladder_per_minute'
          reps_right?: number | null
          weight?: number | null
          weight_unit?: 'lbs' | 'kg' | 'pood' | 'bodyweight'
          intensity?: 'light' | 'heavy' | null
          notes?: string | null
          set_markers?: boolean
          created_at?: string
        }
        Update: {
          program_id?: string | null
          exercise_id?: string
          timer_id?: string | null
          date?: string
          session?: 'all' | 'morning' | 'noon' | 'night'
          sort_order?: number
          sets?: number | null
          reps?: number | null
          rep_type?: 'single' | 'left_right' | 'ladder_up' | 'double_ladder_up' | 'reverse_ladder' | 'double_reverse_ladder' | 'ladder' | 'double_ladder' | 'time' | 'reps_per_minute' | 'left_right_per_minute' | 'ladder_up_per_minute' | 'double_ladder_up_per_minute' | 'reverse_ladder_per_minute' | 'double_reverse_ladder_per_minute' | 'ladder_per_minute' | 'double_ladder_per_minute'
          reps_right?: number | null
          weight?: number | null
          weight_unit?: 'lbs' | 'kg' | 'pood' | 'bodyweight'
          intensity?: 'light' | 'heavy' | null
          notes?: string | null
          set_markers?: boolean
        }
        Relationships: []
      }
      // ── Meal / Nutrition tables ──────────────────────────────
      recipes: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          servings: number
          rating: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          servings?: number
          rating?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          servings?: number
          rating?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recipe_ingredients: {
        Row: {
          id: string
          recipe_id: string
          name: string
          quantity: number
          unit: string
          calories: number
          protein_g: number
          carbs_g: number
          fat_g: number
          fiber_g: number
          rating: number | null
          sort_order: number
        }
        Insert: {
          id?: string
          recipe_id: string
          name: string
          quantity: number
          unit: string
          calories?: number
          protein_g?: number
          carbs_g?: number
          fat_g?: number
          fiber_g?: number
          rating?: number | null
          sort_order?: number
        }
        Update: {
          recipe_id?: string
          name?: string
          quantity?: number
          unit?: string
          calories?: number
          protein_g?: number
          carbs_g?: number
          fat_g?: number
          fiber_g?: number
          rating?: number | null
          sort_order?: number
        }
        Relationships: []
      }
      recipe_steps: {
        Row: {
          id: string
          recipe_id: string
          step_number: number
          instruction: string
        }
        Insert: {
          id?: string
          recipe_id: string
          step_number: number
          instruction: string
        }
        Update: {
          recipe_id?: string
          step_number?: number
          instruction?: string
        }
        Relationships: []
      }
      planned_meals: {
        Row: {
          id: string
          user_id: string
          diet_id: string | null
          recipe_id: string | null
          date: string
          meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          sort_order: number
          servings: number
          rating: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          diet_id?: string | null
          recipe_id?: string | null
          date: string
          meal_slot?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          sort_order?: number
          servings?: number
          rating?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          diet_id?: string | null
          recipe_id?: string | null
          date?: string
          meal_slot?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          sort_order?: number
          servings?: number
          rating?: number | null
          notes?: string | null
        }
        Relationships: []
      }
      meal_ingredients: {
        Row: {
          id: string
          planned_meal_id: string
          name: string
          quantity: number
          unit: string
          calories: number
          protein_g: number
          carbs_g: number
          fat_g: number
          fiber_g: number
          rating: number | null
        }
        Insert: {
          id?: string
          planned_meal_id: string
          name: string
          quantity: number
          unit: string
          calories?: number
          protein_g?: number
          carbs_g?: number
          fat_g?: number
          fiber_g?: number
          rating?: number | null
        }
        Update: {
          planned_meal_id?: string
          name?: string
          quantity?: number
          unit?: string
          calories?: number
          protein_g?: number
          carbs_g?: number
          fat_g?: number
          fiber_g?: number
          rating?: number | null
        }
        Relationships: []
      }
      diets: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          is_active: boolean
          rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          is_active?: boolean
          rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          is_active?: boolean
          rating?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      nutrition_cache: {
        Row: {
          id: string
          query: string
          source: 'usda'
          results: Json
          created_at: string
        }
        Insert: {
          id?: string
          query: string
          source?: 'usda'
          results: Json
          created_at?: string
        }
        Update: {
          query?: string
          source?: 'usda'
          results?: Json
        }
        Relationships: []
      }
      program_activations: {
        Row: {
          id: string
          user_id: string
          program_id: string
          start_date: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          program_id: string
          start_date: string
          created_at?: string
        }
        Update: {
          program_id?: string
          start_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
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
export type PlannedEntryRow = Tables<'planned_entries'>
export type Timer = Tables<'timers'>
export type TimerInterval = Tables<'timer_intervals'>
export type RecipeRow = Tables<'recipes'>
export type RecipeIngredientRow = Tables<'recipe_ingredients'>
export type RecipeStepRow = Tables<'recipe_steps'>
export type PlannedMealRow = Tables<'planned_meals'>
export type MealIngredientRow = Tables<'meal_ingredients'>
export type DietRow = Tables<'diets'>
export type NutritionCacheRow = Tables<'nutrition_cache'>

/** A single activation of a program template with a specific start date */
export interface ProgramActivation {
  id: string
  user_id: string
  program_id: string   // references the template program
  start_date: string   // chosen Sunday (YYYY-MM-DD)
  created_at: string
}
