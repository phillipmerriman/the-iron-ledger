import { useCallback, useRef, useState } from 'react'
import { searchUSDA, scaleNutritionResult, type NutritionResult } from '@/lib/nutrition-api'
import { getCached, setCached } from '@/lib/nutrition-cache'

export type NutritionSource = 'cache' | 'usda' | null

/** In-memory cache for instant repeat lookups within the same session */
const memoryCache = new Map<string, NutritionResult[]>()

export default function useNutrition() {
  const [results, setResults] = useState<NutritionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<NutritionSource>(null)
  const abortRef = useRef<AbortController | null>(null)

  /**
   * Look up nutrition data for a food query.
   * Pass quantity + unit to auto-scale USDA per-100g values to the actual amount.
   */
  const lookup = useCallback(async (query: string, quantity?: number, unit?: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSource(null)
      return []
    }

    const key = trimmed.toLowerCase()

    // 1. In-memory cache (instant, no async)
    if (memoryCache.has(key)) {
      const cached = memoryCache.get(key)!
      const scaled = quantity && unit
        ? cached.map((r) => scaleNutritionResult(r, quantity, unit))
        : cached
      setResults(scaled)
      setSource('cache')
      return scaled
    }

    // Cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      // 2. Persistent cache (localStorage or Supabase)
      const persisted = await getCached(key)
      if (persisted && persisted.length > 0) {
        memoryCache.set(key, persisted)
        const scaled = quantity && unit
          ? persisted.map((r) => scaleNutritionResult(r, quantity, unit))
          : persisted
        setResults(scaled)
        setSource('cache')
        return scaled
      }

      // 3. USDA FoodData Central
      const usdaResults = await searchUSDA(trimmed)
      if (usdaResults.length > 0) {
        // Cache raw per-100g values
        memoryCache.set(key, usdaResults)
        await setCached(key, 'usda', usdaResults)
        // Return scaled values to caller
        const scaled = quantity && unit
          ? usdaResults.map((r) => scaleNutritionResult(r, quantity, unit))
          : usdaResults
        setResults(scaled)
        setSource('usda')
        return scaled
      }

      // 4. Nothing found
      setResults([])
      setSource(null)
      return []
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Nutrition lookup failed')
        console.error(err)
      }
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setResults([])
    setError(null)
    setSource(null)
  }, [])

  return { results, loading, error, source, lookup, clear }
}
