import { useState } from 'react'
import { Trash2, Search, ChevronDown, ChevronUp, Plus, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INGREDIENT_UNIT_OPTIONS, effectiveIngredientMacros, LABEL_NUTRIENTS, MICRONUTRIENTS } from '@/types/meal-types'
import type { RecipeIngredient } from '@/types/meal-types'
import type { NutritionResult } from '@/lib/nutrition-api'
import IngredientSearch from './IngredientSearch'

interface IngredientRowProps {
  ingredient: RecipeIngredient
  index: number
  onChange: (id: string, field: string, value: string | number | null) => void
  onExtraNutrientChange: (id: string, key: string, value: number | null) => void
  onRemove: (id: string) => void
}

export default function IngredientRow({ ingredient, index, onChange, onExtraNutrientChange, onRemove }: IngredientRowProps) {
  const [showLookup, setShowLookup] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showLabelNutrients, setShowLabelNutrients] = useState(false)
  const [showMicronutrients, setShowMicronutrients] = useState(false)

  function handleNutritionSelect(result: NutritionResult) {
    onChange(ingredient.id, 'calories', Math.round(result.calories))
    onChange(ingredient.id, 'protein_g', Math.round(result.protein_g * 10) / 10)
    onChange(ingredient.id, 'carbs_g', Math.round(result.carbs_total_g * 10) / 10)
    onChange(ingredient.id, 'fat_g', Math.round(result.fat_total_g * 10) / 10)
    onChange(ingredient.id, 'fiber_g', Math.round(result.fiber_g * 10) / 10)
    // API returns macros for the full queried quantity, so treat as total
    onChange(ingredient.id, 'macro_mode', 'total')
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
          initialQuery={ingredient.name || ''}
          quantity={ingredient.quantity || 1}
          unit={ingredient.unit || 'g'}
          placeholder="e.g. &quot;walleye&quot;"
        />
      )}

      {/* Macro summary (always visible) */}
      {(() => {
        const eff = effectiveIngredientMacros(ingredient)
        const isPerUnit = ingredient.macro_mode === 'per_unit'
        return (
          <div className="flex items-center gap-3 text-xs pl-7">
            <span className="text-surface-700 font-medium">{Math.round(eff.calories)}cal</span>
            <span className="text-blue-400">{eff.protein_g}p</span>
            <span className="text-amber-400">{eff.carbs_g}c</span>
            <span className="text-rose-400">{eff.fat_g}f</span>
            <span className="text-green-400">{eff.fiber_g}fib</span>
            {isPerUnit && ingredient.quantity > 1 && (
              <span className="text-surface-400">({ingredient.calories}cal × {ingredient.quantity})</span>
            )}
          </div>
        )
      })()}

      {/* Expanded macro editing */}
      {expanded && (
        <div className="pl-7 space-y-2">
          {/* Macro mode toggle */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-surface-400 uppercase tracking-wide">Macros are</span>
            <div className="flex rounded-md border border-border overflow-hidden text-[11px] font-medium">
              <button
                type="button"
                onClick={() => onChange(ingredient.id, 'macro_mode', 'total')}
                className={cn(
                  'px-2 py-0.5 transition-colors',
                  (!ingredient.macro_mode || ingredient.macro_mode === 'total')
                    ? 'bg-surface-200 text-text'
                    : 'text-surface-400 hover:text-surface-600 hover:bg-surface-50',
                )}
              >
                Total
              </button>
              <button
                type="button"
                onClick={() => onChange(ingredient.id, 'macro_mode', 'per_unit')}
                className={cn(
                  'px-2 py-0.5 border-l border-border transition-colors',
                  ingredient.macro_mode === 'per_unit'
                    ? 'bg-surface-200 text-text'
                    : 'text-surface-400 hover:text-surface-600 hover:bg-surface-50',
                )}
              >
                Per {ingredient.unit || 'unit'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-2">
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

          {/* Label nutrients */}
          <NutrientSection
            title="Label Nutrients"
            nutrients={LABEL_NUTRIENTS}
            values={ingredient.extra_nutrients ?? {}}
            open={showLabelNutrients}
            onToggle={() => setShowLabelNutrients((v) => !v)}
            onChange={(key, val) => onExtraNutrientChange(ingredient.id, key, val)}
          />

          {/* Micronutrients */}
          <NutrientSection
            title="Micronutrients"
            nutrients={MICRONUTRIENTS}
            values={ingredient.extra_nutrients ?? {}}
            open={showMicronutrients}
            onToggle={() => setShowMicronutrients((v) => !v)}
            onChange={(key, val) => onExtraNutrientChange(ingredient.id, key, val)}
          />
        </div>
      )}
    </div>
  )
}

// ── NutrientSection ────────────────────────────────────────────────────────

interface NutrientDef {
  readonly key: string
  readonly label: string
  readonly unit: string
}

interface NutrientSectionProps {
  title: string
  nutrients: readonly NutrientDef[]
  values: Record<string, number>
  open: boolean
  onToggle: () => void
  onChange: (key: string, value: number | null) => void
}

function NutrientSection({ title, nutrients, values, open, onToggle, onChange }: NutrientSectionProps) {
  const filledCount = nutrients.filter((n) => values[n.key] != null && values[n.key] !== 0).length

  return (
    <div className="border-t border-border/60 pt-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 text-[11px] font-medium text-surface-400 hover:text-surface-600 transition-colors"
      >
        {open ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        {title}
        {filledCount > 0 && !open && (
          <span className="ml-0.5 rounded-full bg-surface-200 px-1.5 py-0.5 text-[10px] font-semibold text-surface-600">
            {filledCount}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
          {nutrients.map((n) => (
            <div key={n.key} className="space-y-0.5">
              <label className="text-[10px] font-medium text-surface-500 uppercase leading-tight block">
                {n.label} <span className="normal-case font-normal">({n.unit})</span>
              </label>
              <input
                type="number"
                value={values[n.key] ?? ''}
                onChange={(e) => onChange(n.key, e.target.value ? Number(e.target.value) : null)}
                placeholder="—"
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
