import { useState } from 'react'
import { Trash2, Search, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INGREDIENT_UNIT_OPTIONS } from '@/types/meal-types'
import type { RecipeIngredient } from '@/types/meal-types'
import type { NutritionResult } from '@/lib/nutrition-api'
import IngredientSearch from './IngredientSearch'

interface IngredientRowProps {
  ingredient: RecipeIngredient
  index: number
  onChange: (id: string, field: string, value: string | number | null) => void
  onRemove: (id: string) => void
}

export default function IngredientRow({ ingredient, index, onChange, onRemove }: IngredientRowProps) {
  const [showLookup, setShowLookup] = useState(false)
  const [expanded, setExpanded] = useState(false)

  function handleNutritionSelect(result: NutritionResult) {
    onChange(ingredient.id, 'calories', Math.round(result.calories))
    onChange(ingredient.id, 'protein_g', Math.round(result.protein_g * 10) / 10)
    onChange(ingredient.id, 'carbs_g', Math.round(result.carbs_total_g * 10) / 10)
    onChange(ingredient.id, 'fat_g', Math.round(result.fat_total_g * 10) / 10)
    onChange(ingredient.id, 'fiber_g', Math.round(result.fiber_g * 10) / 10)
    if (!ingredient.name) {
      onChange(ingredient.id, 'name', result.name)
    }
    setShowLookup(false)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      {/* Main row: name, qty, unit, actions */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-surface-400 w-5 shrink-0">{index + 1}</span>

        <input
          type="text"
          value={ingredient.name}
          onChange={(e) => onChange(ingredient.id, 'name', e.target.value)}
          placeholder="Ingredient name"
          className="block flex-1 rounded-lg border border-input-border bg-input-bg px-2 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
        />

        <input
          type="number"
          value={ingredient.quantity || ''}
          onChange={(e) => onChange(ingredient.id, 'quantity', e.target.value ? Number(e.target.value) : 0)}
          placeholder="Qty"
          className="block w-16 rounded-lg border border-input-border bg-input-bg px-2 py-1.5 text-sm text-text text-center focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
          min={0}
          step="any"
        />

        <select
          value={ingredient.unit}
          onChange={(e) => onChange(ingredient.id, 'unit', e.target.value)}
          className="block w-20 rounded-lg border border-input-border bg-input-bg px-1 py-1.5 text-sm text-text focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
        >
          {INGREDIENT_UNIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setShowLookup(!showLookup)}
          className={cn(
            'rounded p-1.5 transition-colors',
            showLookup ? 'bg-primary-50 text-primary-600' : 'text-surface-400 hover:text-surface-600 hover:bg-surface-50',
          )}
          title="Nutrition lookup"
        >
          <Search className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="rounded p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-50 transition-colors"
          title="Edit macros"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => onRemove(ingredient.id)}
          className="rounded p-1.5 text-surface-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Nutrition lookup */}
      {showLookup && (
        <IngredientSearch
          onSelect={handleNutritionSelect}
          placeholder={`e.g. "${ingredient.quantity || 1} ${ingredient.unit} ${ingredient.name || 'chicken breast'}"`}
        />
      )}

      {/* Macro summary (always visible) */}
      <div className="flex items-center gap-3 text-xs pl-7">
        <span className="text-surface-700 font-medium">{Math.round(ingredient.calories)}cal</span>
        <span className="text-blue-600">{ingredient.protein_g}p</span>
        <span className="text-amber-600">{ingredient.carbs_g}c</span>
        <span className="text-rose-600">{ingredient.fat_g}f</span>
        <span className="text-green-600">{ingredient.fiber_g}fib</span>
      </div>

      {/* Expanded macro editing */}
      {expanded && (
        <div className="grid grid-cols-5 gap-2 pl-7">
          {(['calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g'] as const).map((field) => (
            <div key={field} className="space-y-0.5">
              <label className="text-[10px] font-medium text-surface-500 uppercase">
                {field === 'calories' ? 'Cal' : field.replace('_g', '')}
              </label>
              <input
                type="number"
                value={ingredient[field] || ''}
                onChange={(e) => onChange(ingredient.id, field, e.target.value ? Number(e.target.value) : 0)}
                className="block w-full rounded border border-input-border bg-input-bg px-1.5 py-1 text-xs text-text text-center focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
                min={0}
                step="any"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
