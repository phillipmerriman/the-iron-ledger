import { supabase, isDev } from '@/lib/supabase'
import type { NutritionResult } from '@/lib/nutrition-api'

const LS_KEY = 'fittrack:nutrition_cache'

interface CacheEntry {
  query: string
  source: 'usda'
  results: NutritionResult[]
  created_at: string
}

function getLocalEntries(): CacheEntry[] {
  const raw = localStorage.getItem(LS_KEY)
  return raw ? JSON.parse(raw) : []
}

function setLocalEntries(entries: CacheEntry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries))
}

/** Look up a cached nutrition result by query string (case-insensitive). */
export async function getCached(query: string): Promise<NutritionResult[] | null> {
  const key = query.trim().toLowerCase()

  if (isDev) {
    const entry = getLocalEntries().find((e) => e.query === key)
    return entry ? entry.results : null
  }

  const { data } = await supabase
    .from('nutrition_cache')
    .select('results')
    .eq('query', key)
    .maybeSingle()

  return data ? (data.results as unknown as NutritionResult[]) : null
}

/** Persist a nutrition lookup result for future reuse. */
export async function setCached(
  query: string,
  source: 'usda',
  results: NutritionResult[],
): Promise<void> {
  const key = query.trim().toLowerCase()

  if (isDev) {
    const entries = getLocalEntries().filter((e) => e.query !== key)
    entries.push({ query: key, source, results, created_at: new Date().toISOString() })
    setLocalEntries(entries)
    return
  }

  await supabase
    .from('nutrition_cache')
    .upsert(
      { query: key, source, results: JSON.stringify(results) },
      { onConflict: 'query' },
    )
}
