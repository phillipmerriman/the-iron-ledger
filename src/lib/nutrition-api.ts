export interface NutritionResult {
  name: string
  brand: string | null
  category: string | null
  calories: number
  protein_g: number
  carbs_total_g: number
  fat_total_g: number
  fiber_g: number
  serving_size_g: number
  sugar_g: number
  sodium_mg: number
  cholesterol_mg: number
  fat_saturated_g: number
  potassium_mg: number
}

// ── Unit conversion ──────────────────────────────────────

/** Approximate grams per unit (for scaling USDA per-100g values) */
const GRAMS_PER_UNIT: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lbs: 453.592,
  ml: 1,        // ~1g for water-density liquids
  fl_oz: 29.574,
  cups: 240,
  tbsp: 15,
  tsp: 5,
}

/**
 * Convert a quantity + unit to grams.
 * Returns null for non-weight units (pieces, slices, whole) where conversion isn't possible.
 */
export function convertToGrams(quantity: number, unit: string): number | null {
  const factor = GRAMS_PER_UNIT[unit]
  if (!factor) return null
  return quantity * factor
}

/** Scale a per-100g NutritionResult to a specific quantity + unit. */
export function scaleNutritionResult(
  result: NutritionResult,
  quantity: number,
  unit: string,
): NutritionResult {
  const grams = convertToGrams(quantity, unit)
  if (!grams) return result // can't scale pieces/slices/whole — return raw

  const factor = grams / 100
  return {
    name: result.name,
    brand: result.brand,
    category: result.category,
    calories: Math.round(result.calories * factor),
    protein_g: Math.round(result.protein_g * factor * 10) / 10,
    carbs_total_g: Math.round(result.carbs_total_g * factor * 10) / 10,
    fat_total_g: Math.round(result.fat_total_g * factor * 10) / 10,
    fiber_g: Math.round(result.fiber_g * factor * 10) / 10,
    serving_size_g: Math.round(grams),
    sugar_g: Math.round(result.sugar_g * factor * 10) / 10,
    sodium_mg: Math.round(result.sodium_mg * factor),
    cholesterol_mg: Math.round(result.cholesterol_mg * factor),
    fat_saturated_g: Math.round(result.fat_saturated_g * factor * 10) / 10,
    potassium_mg: Math.round(result.potassium_mg * factor),
  }
}

// ── USDA FoodData Central ────────────────────────────────

const USDA_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search'

/** USDA nutrient IDs → our NutritionResult fields */
const USDA_NUTRIENT_MAP: Record<number, keyof NutritionResult> = {
  1008: 'calories',
  1003: 'protein_g',
  1005: 'carbs_total_g',
  1004: 'fat_total_g',
  1079: 'fiber_g',
  2000: 'sugar_g',
  1093: 'sodium_mg',
  1253: 'cholesterol_mg',
  1258: 'fat_saturated_g',
  1092: 'potassium_mg',
}

interface USDANutrient {
  nutrientId: number
  value: number
}

interface USDAFood {
  description: string
  brandName?: string
  brandOwner?: string
  foodCategory?: string
  foodNutrients: USDANutrient[]
  servingSize?: number
}

function mapUSDAFood(food: USDAFood): NutritionResult {
  const result: NutritionResult = {
    name: food.description.toLowerCase(),
    brand: food.brandName || food.brandOwner || null,
    category: food.foodCategory || null,
    calories: 0,
    protein_g: 0,
    carbs_total_g: 0,
    fat_total_g: 0,
    fiber_g: 0,
    serving_size_g: 100,
    sugar_g: 0,
    sodium_mg: 0,
    cholesterol_mg: 0,
    fat_saturated_g: 0,
    potassium_mg: 0,
  }

  for (const n of food.foodNutrients) {
    const field = USDA_NUTRIENT_MAP[n.nutrientId]
    if (field && field !== 'name') {
      ;(result as unknown as Record<string, number | string>)[field] = n.value
    }
  }

  return result
}

/**
 * Search USDA FoodData Central. Free and unlimited with DEMO_KEY.
 * Returns per-100g values — use scaleNutritionResult() to adjust for quantity.
 */
export async function searchUSDA(query: string): Promise<NutritionResult[]> {
  const apiKey = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY'

  const res = await fetch(
    `${USDA_URL}?api_key=${apiKey}&query=${encodeURIComponent(query)}&pageSize=10`,
  )

  if (!res.ok) {
    console.error(`USDA API error: ${res.status} ${res.statusText}`)
    return []
  }

  const data = (await res.json()) as { foods?: USDAFood[] }
  return (data.foods ?? []).map(mapUSDAFood)
}
