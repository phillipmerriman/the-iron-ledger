export interface NutritionResult {
  name: string
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

const API_URL = 'https://api.calorieninjas.com/v1/nutrition'

/**
 * Query CalorieNinjas natural-language nutrition API.
 * Returns an empty array when no API key is configured (graceful degradation).
 */
export async function lookupNutrition(query: string): Promise<NutritionResult[]> {
  const apiKey = import.meta.env.VITE_NUTRITION_API_KEY
  if (!apiKey) return []

  const res = await fetch(`${API_URL}?query=${encodeURIComponent(query)}`, {
    headers: { 'X-Api-Key': apiKey },
  })

  if (!res.ok) {
    console.error(`Nutrition API error: ${res.status} ${res.statusText}`)
    return []
  }

  const data = (await res.json()) as { items: NutritionResult[] }
  return data.items ?? []
}
