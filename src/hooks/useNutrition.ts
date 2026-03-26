import { useCallback, useRef, useState } from 'react'
import { lookupNutrition, type NutritionResult } from '@/lib/nutrition-api'

/** In-memory cache keyed by query string to avoid duplicate API calls */
const cache = new Map<string, NutritionResult[]>()

export default function useNutrition() {
  const [results, setResults] = useState<NutritionResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const lookup = useCallback(async (query: string) => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      return []
    }

    // Check cache first
    const key = trimmed.toLowerCase()
    if (cache.has(key)) {
      const cached = cache.get(key)!
      setResults(cached)
      return cached
    }

    // Cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const items = await lookupNutrition(trimmed)
      cache.set(key, items)
      setResults(items)
      return items
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
  }, [])

  return { results, loading, error, lookup, clear }
}
