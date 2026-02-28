import type { ExerciseType, MuscleGroup, Equipment, ExerciseRate } from '@/types/common'

interface SeedExercise {
  name: string
  exercise_type: ExerciseType
  exercise_rate?: ExerciseRate
  primary_muscle: MuscleGroup
  equipment: Equipment
}

export const SEED_EXERCISES: SeedExercise[] = [
  // Lower Body
  { name: 'Swing - 2 Handed', exercise_rate: 'ballistic', exercise_type: 'strength', primary_muscle: 'lower_body', equipment: 'kettlebell' },
  { name: 'Swing - 1 Handed', exercise_rate: 'ballistic', exercise_type: 'strength', primary_muscle: 'lower_body', equipment: 'kettlebell' },
  { name: 'Swing - H2H', exercise_rate: 'ballistic', exercise_type: 'strength', primary_muscle: 'lower_body', equipment: 'kettlebell' },
  { name: 'Barbell Back Squat', exercise_type: 'strength', primary_muscle: 'quads', equipment: 'barbell' },
  { name: 'Front Squat', exercise_type: 'strength', primary_muscle: 'quads', equipment: 'barbell' },
  { name: 'Goblet Squat - Bottoms Up', exercise_rate: 'grind', exercise_type: 'strength', primary_muscle: 'quads', equipment: 'kettlebell' },
  { name: 'Leg Press', exercise_type: 'strength', primary_muscle: 'quads', equipment: 'machine' },
  { name: 'Leg Extension', exercise_type: 'strength', primary_muscle: 'quads', equipment: 'machine' },
  { name: 'Bulgarian Split Squat', exercise_type: 'strength', primary_muscle: 'quads', equipment: 'dumbbell' },
  { name: 'Walking Lunge', exercise_type: 'strength', primary_muscle: 'quads', equipment: 'dumbbell' },
  { name: 'Hack Squat', exercise_type: 'strength', primary_muscle: 'quads', equipment: 'machine' },
  { name: 'Romanian Deadlift', exercise_type: 'strength', primary_muscle: 'hamstrings', equipment: 'barbell' },
  { name: 'Dumbbell Romanian Deadlift', exercise_type: 'strength', primary_muscle: 'hamstrings', equipment: 'dumbbell' },
  { name: 'Lying Leg Curl', exercise_type: 'strength', primary_muscle: 'hamstrings', equipment: 'machine' },
  { name: 'Seated Leg Curl', exercise_type: 'strength', primary_muscle: 'hamstrings', equipment: 'machine' },
  { name: 'Good Morning', exercise_type: 'strength', primary_muscle: 'hamstrings', equipment: 'barbell' },
  { name: 'Nordic Hamstring Curl', exercise_type: 'strength', primary_muscle: 'hamstrings', equipment: 'bodyweight' },
  { name: 'Hip Thrust', exercise_type: 'strength', primary_muscle: 'glutes', equipment: 'barbell' },
  { name: 'Glute Bridge', exercise_type: 'strength', primary_muscle: 'glutes', equipment: 'bodyweight' },
  { name: 'Cable Kickback', exercise_type: 'strength', primary_muscle: 'glutes', equipment: 'cable' },
  { name: 'Step-Up', exercise_type: 'strength', primary_muscle: 'glutes', equipment: 'dumbbell' },
  { name: 'Standing Calf Raise', exercise_type: 'strength', primary_muscle: 'calves', equipment: 'machine' },
  { name: 'Seated Calf Raise', exercise_type: 'strength', primary_muscle: 'calves', equipment: 'machine' },
  { name: 'Bodyweight Calf Raise', exercise_type: 'strength', primary_muscle: 'calves', equipment: 'bodyweight' },

  // Upper Body
  { name: 'Kettlebell Press', exercise_rate: 'grind', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'kettlebell' },
  { name: 'Barbell Bench Press', exercise_type: 'strength', primary_muscle: 'chest', equipment: 'barbell' },
  { name: 'Incline Barbell Bench Press', exercise_type: 'strength', primary_muscle: 'chest', equipment: 'barbell' },
  { name: 'Dumbbell Bench Press', exercise_type: 'strength', primary_muscle: 'chest', equipment: 'dumbbell' },
  { name: 'Incline Dumbbell Bench Press', exercise_type: 'strength', primary_muscle: 'chest', equipment: 'dumbbell' },
  { name: 'Dumbbell Fly', exercise_type: 'strength', primary_muscle: 'chest', equipment: 'dumbbell' },
  { name: 'Cable Fly', exercise_type: 'strength', primary_muscle: 'chest', equipment: 'cable' },
  { name: 'Push-Up', exercise_type: 'strength', primary_muscle: 'chest', equipment: 'bodyweight' },
  { name: 'Chest Dip', exercise_type: 'strength', primary_muscle: 'chest', equipment: 'bodyweight' },
  { name: 'Machine Chest Press', exercise_type: 'strength', primary_muscle: 'chest', equipment: 'machine' },
  { name: 'Pec Deck', exercise_type: 'strength', primary_muscle: 'chest', equipment: 'machine' },
  { name: 'Barbell Row', exercise_type: 'strength', primary_muscle: 'back', equipment: 'barbell' },
  { name: 'Dumbbell Row', exercise_type: 'strength', primary_muscle: 'back', equipment: 'dumbbell' },
  { name: 'Pull-Up', exercise_type: 'strength', primary_muscle: 'back', equipment: 'bodyweight' },
  { name: 'Chin-Up', exercise_type: 'strength', primary_muscle: 'back', equipment: 'bodyweight' },
  { name: 'Lat Pulldown', exercise_type: 'strength', primary_muscle: 'back', equipment: 'cable' },
  { name: 'Seated Cable Row', exercise_type: 'strength', primary_muscle: 'back', equipment: 'cable' },
  { name: 'T-Bar Row', exercise_type: 'strength', primary_muscle: 'back', equipment: 'barbell' },
  { name: 'Face Pull', exercise_type: 'strength', primary_muscle: 'back', equipment: 'cable' },
  { name: 'Deadlift', exercise_type: 'strength', primary_muscle: 'back', equipment: 'barbell' },
  { name: 'Rack Pull', exercise_type: 'strength', primary_muscle: 'back', equipment: 'barbell' },
  { name: 'Overhead Press', exercise_type: 'strength', primary_muscle: 'shoulders', equipment: 'barbell' },
  { name: 'Dumbbell Shoulder Press', exercise_type: 'strength', primary_muscle: 'shoulders', equipment: 'dumbbell' },
  { name: 'Arnold Press', exercise_type: 'strength', primary_muscle: 'shoulders', equipment: 'dumbbell' },
  { name: 'Lateral Raise', exercise_type: 'strength', primary_muscle: 'shoulders', equipment: 'dumbbell' },
  { name: 'Cable Lateral Raise', exercise_type: 'strength', primary_muscle: 'shoulders', equipment: 'cable' },
  { name: 'Front Raise', exercise_type: 'strength', primary_muscle: 'shoulders', equipment: 'dumbbell' },
  { name: 'Reverse Fly', exercise_type: 'strength', primary_muscle: 'shoulders', equipment: 'dumbbell' },
  { name: 'Upright Row', exercise_type: 'strength', primary_muscle: 'shoulders', equipment: 'barbell' },
  { name: 'Machine Shoulder Press', exercise_type: 'strength', primary_muscle: 'shoulders', equipment: 'machine' },
  { name: 'Barbell Curl', exercise_type: 'strength', primary_muscle: 'biceps', equipment: 'barbell' },
  { name: 'Dumbbell Curl', exercise_type: 'strength', primary_muscle: 'biceps', equipment: 'dumbbell' },
  { name: 'Hammer Curl', exercise_type: 'strength', primary_muscle: 'biceps', equipment: 'dumbbell' },
  { name: 'Preacher Curl', exercise_type: 'strength', primary_muscle: 'biceps', equipment: 'dumbbell' },
  { name: 'Cable Curl', exercise_type: 'strength', primary_muscle: 'biceps', equipment: 'cable' },
  { name: 'Incline Dumbbell Curl', exercise_type: 'strength', primary_muscle: 'biceps', equipment: 'dumbbell' },
  { name: 'Concentration Curl', exercise_type: 'strength', primary_muscle: 'biceps', equipment: 'dumbbell' },
  { name: 'Tricep Pushdown', exercise_type: 'strength', primary_muscle: 'triceps', equipment: 'cable' },
  { name: 'Overhead Tricep Extension', exercise_type: 'strength', primary_muscle: 'triceps', equipment: 'dumbbell' },
  { name: 'Skull Crusher', exercise_type: 'strength', primary_muscle: 'triceps', equipment: 'barbell' },
  { name: 'Close-Grip Bench Press', exercise_type: 'strength', primary_muscle: 'triceps', equipment: 'barbell' },
  { name: 'Tricep Dip', exercise_type: 'strength', primary_muscle: 'triceps', equipment: 'bodyweight' },
  { name: 'Cable Overhead Extension', exercise_type: 'strength', primary_muscle: 'triceps', equipment: 'cable' },
  { name: 'Diamond Push-Up', exercise_type: 'strength', primary_muscle: 'triceps', equipment: 'bodyweight' },
  { name: 'Plank', exercise_type: 'strength', primary_muscle: 'core', equipment: 'bodyweight' },
  { name: 'Hanging Leg Raise', exercise_type: 'strength', primary_muscle: 'core', equipment: 'bodyweight' },
  { name: 'Cable Crunch', exercise_type: 'strength', primary_muscle: 'core', equipment: 'cable' },
  { name: 'Ab Wheel Rollout', exercise_type: 'strength', primary_muscle: 'core', equipment: 'other' },
  { name: 'Russian Twist', exercise_type: 'strength', primary_muscle: 'core', equipment: 'bodyweight' },
  { name: 'Dead Bug', exercise_type: 'strength', primary_muscle: 'core', equipment: 'bodyweight' },
  { name: 'Pallof Press', exercise_type: 'strength', primary_muscle: 'core', equipment: 'cable' },
  { name: 'Wrist Curl', exercise_type: 'strength', primary_muscle: 'forearms', equipment: 'dumbbell' },
  { name: 'Reverse Wrist Curl', exercise_type: 'strength', primary_muscle: 'forearms', equipment: 'dumbbell' },
  { name: 'Farmer\'s Walk', exercise_type: 'strength', primary_muscle: 'forearms', equipment: 'dumbbell' },

  // Full Body
  { name: 'C&P | Clean and Press', exercise_rate: 'grind', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'kettlebell' },
  { name: 'Clean', exercise_rate: 'ballistic', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'kettlebell' },
  { name: 'TGU | Turkish Get-Up', exercise_rate: 'grind', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'kettlebell' },
  { name: 'Snatch', exercise_rate: 'ballistic', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'kettlebell' },
  { name: 'Burpee', exercise_rate: 'grind', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'bodyweight' },
  { name: 'Thruster', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'barbell' },

  // Steel Mace
  { name: '360 Shield Cast', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'steel_mace' },
  { name: '10-to-2', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'steel_mace' },
  { name: 'Grave Digger', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'steel_mace' },
  { name: 'Mace Squat', exercise_type: 'strength', primary_muscle: 'lower_body', equipment: 'steel_mace' },

  // Steel Club
  { name: 'Club Mill', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'steel_club' },
  { name: 'Club Swing', exercise_type: 'strength', primary_muscle: 'full_body', equipment: 'steel_club' },

  // Cardio
  { name: 'Running', exercise_type: 'cardio', primary_muscle: 'full_body', equipment: 'bodyweight' },
  { name: 'Cycling', exercise_type: 'cardio', primary_muscle: 'lower_body', equipment: 'machine' },
  { name: 'Rowing Machine', exercise_type: 'cardio', primary_muscle: 'full_body', equipment: 'machine' },
  { name: 'Jump Rope', exercise_type: 'cardio', primary_muscle: 'full_body', equipment: 'other' },
  { name: 'Stair Climber', exercise_type: 'cardio', primary_muscle: 'lower_body', equipment: 'machine' },
  { name: 'Elliptical', exercise_type: 'cardio', primary_muscle: 'full_body', equipment: 'machine' },

  // Flexibility
  { name: 'Foam Rolling', exercise_type: 'flexibility', primary_muscle: 'full_body', equipment: 'other' },
  { name: 'Hamstring Stretch', exercise_type: 'flexibility', primary_muscle: 'hamstrings', equipment: 'bodyweight' },
  { name: 'Hip Flexor Stretch', exercise_type: 'flexibility', primary_muscle: 'quads', equipment: 'bodyweight' },
  { name: 'Shoulder Dislocate', exercise_type: 'flexibility', primary_muscle: 'shoulders', equipment: 'band' },
  { name: 'Cat-Cow Stretch', exercise_type: 'flexibility', primary_muscle: 'back', equipment: 'bodyweight' },
  
  // Other
  { name: 'Warm Up', exercise_type: 'warm_up', primary_muscle: 'full_body', equipment: 'bodyweight' },
  { name: 'Cool Down', exercise_type: 'cool_down', primary_muscle: 'full_body', equipment: 'bodyweight' },
]

// Generate a deterministic UUID v4–shaped ID from a string so seed exercises
// always get the same ID regardless of when they're created.
function deterministicId(input: string): string {
  let h = 0
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(31, h) + input.charCodeAt(i) | 0
  }
  const hex = (v: number, len: number) => (v >>> 0).toString(16).padStart(len, '0')
  const a = Math.abs(h)
  const b = Math.abs(Math.imul(h, 0x5bd1e995))
  const c = Math.abs(Math.imul(h, 0x27d4eb2d))
  const d = Math.abs(Math.imul(h, 0x165667b1))
  return `${hex(a, 8)}-${hex(b, 4)}-4${hex(c, 3)}-a${hex(d, 3)}-${hex(a ^ b, 6)}${hex(c ^ d, 6)}`
}

const SEED_KEY = 'fittrack:exercises_seeded'

export function seedExercisesIfNeeded(userId: string) {
  if (localStorage.getItem(SEED_KEY)) return false

  const PREFIX = 'fittrack:'
  const existing = localStorage.getItem(`${PREFIX}exercises`)
  const rows = existing ? JSON.parse(existing) : []
  const now = new Date().toISOString()

  for (const seed of SEED_EXERCISES) {
    rows.push({
      id: deterministicId(`seed:${seed.name}`),
      user_id: userId,
      name: seed.name,
      exercise_type: seed.exercise_type,
      exercise_rate: seed.exercise_rate ?? null,
      primary_muscle: seed.primary_muscle,
      equipment: seed.equipment,
      notes: null,
      is_archived: false,
      created_at: now,
      updated_at: now,
    })
  }

  localStorage.setItem(`${PREFIX}exercises`, JSON.stringify(rows))
  localStorage.setItem(SEED_KEY, 'true')
  return true
}
