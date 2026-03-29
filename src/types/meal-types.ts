// Meal slot types (analogous to workout Sessions)
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

// Ingredient measurement units
export type IngredientUnit =
  | 'oz' | 'g' | 'lbs' | 'kg'
  | 'cups' | 'tbsp' | 'tsp' | 'ml' | 'fl_oz'
  | 'pieces' | 'slices' | 'whole'

export const INGREDIENT_UNIT_OPTIONS: { value: IngredientUnit; label: string }[] = [
  { value: 'oz', label: 'oz' },
  { value: 'g', label: 'g' },
  { value: 'lbs', label: 'lbs' },
  { value: 'kg', label: 'kg' },
  { value: 'cups', label: 'cups' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'tsp', label: 'tsp' },
  { value: 'ml', label: 'ml' },
  { value: 'fl_oz', label: 'fl oz' },
  { value: 'pieces', label: 'pieces' },
  { value: 'slices', label: 'slices' },
  { value: 'whole', label: 'whole' },
]

// Macro nutrition data shared across ingredient types
export interface MacroData {
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

// Recipe types
export interface Recipe {
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

export interface RecipeIngredient {
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

export interface RecipeStep {
  id: string
  recipe_id: string
  step_number: number
  instruction: string
}

// Planned meal types (analogous to PlannedEntry)
export interface PlannedMeal {
  id: string
  user_id: string
  diet_id: string | null
  recipe_id: string | null
  date: string          // YYYY-MM-DD
  meal_slot: MealSlot
  sort_order: number
  servings: number
  rating: number | null
  notes: string | null
  eaten_at: string | null   // set when user marks meal as eaten
  created_at: string
}

// Ad-hoc ingredient on a planned meal (no recipe)
export interface MealIngredient {
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

// Diet types (analogous to Program)
export interface Diet {
  id: string
  user_id: string
  name: string
  description: string | null
  is_active: boolean
  rating: number | null
  created_at: string
  updated_at: string
}

export type PlannedMealUpdate = Partial<Pick<PlannedMeal,
  'recipe_id' | 'meal_slot' | 'servings' | 'rating' | 'notes' | 'eaten_at'
>>

/** Sum macros from an array of ingredients, optionally scaled by servings */
export function sumMacros(ingredients: MacroData[], servings = 1): MacroData {
  const total = ingredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein_g: acc.protein_g + ing.protein_g,
      carbs_g: acc.carbs_g + ing.carbs_g,
      fat_g: acc.fat_g + ing.fat_g,
      fiber_g: acc.fiber_g + ing.fiber_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  )
  if (servings <= 0) return total
  return {
    calories: Math.round(total.calories / servings),
    protein_g: Math.round(total.protein_g / servings * 10) / 10,
    carbs_g: Math.round(total.carbs_g / servings * 10) / 10,
    fat_g: Math.round(total.fat_g / servings * 10) / 10,
    fiber_g: Math.round(total.fiber_g / servings * 10) / 10,
  }
}

/** Format macros as a compact string */
export function formatMacros(macros: MacroData): string {
  return `${Math.round(macros.calories)}cal | ${Math.round(macros.protein_g)}p | ${Math.round(macros.carbs_g)}c | ${Math.round(macros.fat_g)}f`
}
