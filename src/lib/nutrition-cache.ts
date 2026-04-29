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

/** Safely parse results that may be a JSON string or already an array. */
function parseResults(raw: unknown): NutritionResult[] | null {
  let arr: NutritionResult[] | null = null
  if (Array.isArray(raw)) arr = raw as NutritionResult[]
  else if (typeof raw === 'string') {
    try { arr = JSON.parse(raw) as NutritionResult[] } catch { return null }
  }
  // Evict stale entries that are missing newer fields (e.g. brand/category)
  if (arr && arr.length > 0 && !('brand' in arr[0])) return null
  return arr
}

/** Look up a cached nutrition result by query string (case-insensitive). */
export async function getCached(query: string): Promise<NutritionResult[] | null> {
  const key = query.trim().toLowerCase()

  if (isDev) {
    const entry = getLocalEntries().find((e) => e.query === key)
    return entry ? parseResults(entry.results) : null
  }

  try {
    const { data } = await supabase
      .from('nutrition_cache')
      .select('results')
      .eq('query', key)
      .maybeSingle()

    return data ? parseResults(data.results) : null
  } catch {
    // Table may not exist yet — degrade gracefully
    return null
  }
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

  try {
    await supabase
      .from('nutrition_cache')
      .upsert(
        { query: key, source, results: JSON.stringify(results) },
        { onConflict: 'query' },
      )
  } catch {
    // Table may not exist yet — silently skip
  }
}
