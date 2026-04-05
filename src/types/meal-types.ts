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
  /** Whether the entered macros represent totals for all qty, or macros per single unit */
  macro_mode?: 'total' | 'per_unit'
  /** Additional label nutrients and micronutrients, keyed by nutrient id */
  extra_nutrients?: Record<string, number>
}

export const LABEL_NUTRIENTS = [
  { key: 'saturated_fat_g',       label: 'Saturated Fat',    unit: 'g'   },
  { key: 'trans_fat_g',           label: 'Trans Fat',        unit: 'g'   },
  { key: 'polyunsaturated_fat_g', label: 'Polyunsat. Fat',   unit: 'g'   },
  { key: 'monounsaturated_fat_g', label: 'Monounsat. Fat',   unit: 'g'   },
  { key: 'cholesterol_mg',        label: 'Cholesterol',      unit: 'mg'  },
  { key: 'sodium_mg',             label: 'Sodium',           unit: 'mg'  },
  { key: 'sugars_g',              label: 'Total Sugars',     unit: 'g'   },
  { key: 'added_sugars_g',        label: 'Added Sugars',     unit: 'g'   },
  { key: 'sugar_alcohols_g',      label: 'Sugar Alcohols',   unit: 'g'   },
] as const

export const MICRONUTRIENTS = [
  { key: 'vitamin_d_mcg',   label: 'Vitamin D',   unit: 'mcg' },
  { key: 'calcium_mg',      label: 'Calcium',     unit: 'mg'  },
  { key: 'iron_mg',         label: 'Iron',        unit: 'mg'  },
  { key: 'potassium_mg',    label: 'Potassium',   unit: 'mg'  },
  { key: 'vitamin_a_mcg',   label: 'Vitamin A',   unit: 'mcg' },
  { key: 'vitamin_c_mg',    label: 'Vitamin C',   unit: 'mg'  },
  { key: 'vitamin_b12_mcg', label: 'Vitamin B12', unit: 'mcg' },
  { key: 'vitamin_b6_mg',   label: 'Vitamin B6',  unit: 'mg'  },
  { key: 'magnesium_mg',    label: 'Magnesium',   unit: 'mg'  },
  { key: 'zinc_mg',         label: 'Zinc',        unit: 'mg'  },
  { key: 'phosphorus_mg',   label: 'Phosphorus',  unit: 'mg'  },
  { key: 'folate_mcg',      label: 'Folate',      unit: 'mcg' },
  { key: 'thiamin_mg',      label: 'Thiamin',     unit: 'mg'  },
  { key: 'riboflavin_mg',   label: 'Riboflavin',  unit: 'mg'  },
  { key: 'niacin_mg',       label: 'Niacin',      unit: 'mg'  },
  { key: 'selenium_mcg',    label: 'Selenium',    unit: 'mcg' },
] as const

/** Returns the effective total macros for an ingredient, accounting for macro_mode */
export function effectiveIngredientMacros(ing: RecipeIngredient): MacroData {
  const multiplier = ing.macro_mode === 'per_unit' ? (ing.quantity || 1) : 1
  return {
    calories: ing.calories * multiplier,
    protein_g: ing.protein_g * multiplier,
    carbs_g: ing.carbs_g * multiplier,
    fat_g: ing.fat_g * multiplier,
    fiber_g: ing.fiber_g * multiplier,
  }
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
