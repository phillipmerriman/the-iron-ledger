import { useState, useRef } from 'react'
import { Search, Loader2 } from 'lucide-react'
import useNutrition from '@/hooks/useNutrition'
import type { NutritionResult } from '@/lib/nutrition-api'
import { cn } from '@/lib/utils'

interface IngredientSearchProps {
  onSelect: (result: NutritionResult) => void
  quantity?: number
  unit?: string
  initialQuery?: string
  placeholder?: string
  className?: string
}

export default function IngredientSearch({ onSelect, quantity, unit, initialQuery = '', placeholder = 'e.g. "walleye"', className }: IngredientSearchProps) {
  const [query, setQuery] = useState(initialQuery)
  const [showDropdown, setShowDropdown] = useState(false)
  const { results, loading, error, source, lookup, clear } = useNutrition()
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleLookup() {
    if (!query.trim()) return
    const items = await lookup(query, quantity, unit)
    setShowDropdown(true)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleLookup()
    }
    if (e.key === 'Escape') {
      setShowDropdown(false)
    }
  }

  function handleSelect(result: NutritionResult) {
    onSelect(result)
    setQuery('')
    setShowDropdown(false)
    clear()
  }

  return (
    <div className={cn('relative', className)}>
      <div className="flex gap-1.5">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="block w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-text shadow-sm transition-colors focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={loading || !query.trim()}
          className="flex items-center gap-1.5 rounded-lg border border-input-border bg-surface-50 px-3 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-100 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Lookup
        </button>
      </div>

      {error && (
        <p className="mt-1 text-xs text-danger-400">
          {error}{' '}
          <button type="button" onClick={() => { clear(); setShowDropdown(false) }} className="underline hover:text-danger-300">Dismiss</button>
        </p>
      )}

      {showDropdown && results.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
          <div className="max-h-60 overflow-y-auto py-1">
            {results.map((r, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelect(r)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-surface-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-text capitalize">{r.name}</span>
                  {(r.brand || r.category) && (
                    <span className="ml-1.5 text-[10px] text-surface-400">
                      {r.brand || r.category}
                    </span>
                  )}
                </div>
                <span className="text-xs text-surface-500 shrink-0">
                  {Math.round(r.calories)}cal | {Math.round(r.protein_g)}p | {Math.round(r.carbs_total_g)}c | {Math.round(r.fat_total_g)}f
                </span>
              </button>
            ))}
          </div>
          {source === 'usda' && (
            <div className="border-t border-border px-3 py-1 text-[10px] text-surface-400 uppercase tracking-wide">
              USDA {quantity && unit ? `· scaled to ${quantity} ${unit}` : '· per 100g'}
            </div>
          )}
        </div>
      )}

      {showDropdown && results.length === 0 && !loading && !error && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card p-3 text-sm text-surface-500 shadow-lg">
          No results found. Try a simpler food name (e.g. "chicken breast").
        </div>
      )}
    </div>
  )
}
