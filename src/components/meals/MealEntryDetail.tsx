import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import NutritionBadge from '@/components/meals/NutritionBadge'
import type { PlannedMeal, PlannedMealUpdate, MealSlot, Recipe, MacroData, RecipeIngredient } from '@/types/meal-types'
import { MEAL_SLOT_LABELS, MEAL_SLOTS, effectiveIngredientMacros, sumMacros } from '@/types/meal-types'
import { loadRecipeIngredients } from '@/hooks/useRecipes'

interface MealEntryDetailProps {
  entry: PlannedMeal
  recipe: Recipe | null
  onUpdate: (id: string, values: PlannedMealUpdate) => void
  onClose: () => void
}

export default function MealEntryDetail({ entry, recipe, onUpdate, onClose }: MealEntryDetailProps) {
  const [slot, setSlot] = useState<MealSlot>(entry.meal_slot)
  const [servings, setServings] = useState<number | ''>(entry.servings ?? 1)
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!recipe) return
    loadRecipeIngredients(recipe.id).then(setIngredients).catch(() => {})
  }, [recipe?.id])

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [saved])

  function handleSave() {
    onUpdate(entry.id, {
      meal_slot: slot,
      servings: servings === '' ? 1 : Number(servings),
      notes: notes.trim() || null,
    })
    setSaved(true)
  }

  const resolvedServings = servings === '' ? 1 : Number(servings)

  // Compute total from loaded ingredients (always available once loaded)
  const totalMacros: MacroData | null = ingredients.length > 0
    ? sumMacros(ingredients.map(effectiveIngredientMacros), 1)
    : null

  const scaledMacros: MacroData | null = totalMacros
    ? {
        calories: Math.round(totalMacros.calories * resolvedServings),
        protein_g: Math.round(totalMacros.protein_g * resolvedServings * 10) / 10,
        carbs_g: Math.round(totalMacros.carbs_g * resolvedServings * 10) / 10,
        fat_g: Math.round(totalMacros.fat_g * resolvedServings * 10) / 10,
        fiber_g: Math.round(totalMacros.fiber_g * resolvedServings * 10) / 10,
      }
    : null

  const inputClass =
    'w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-text focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate">{recipe?.name ?? 'Custom meal'}</span>
          {recipe && (
            <Link
              to={`/meals/recipes/${recipe.id}`}
              onClick={onClose}
              className="shrink-0 rounded p-0.5 text-surface-400 hover:text-primary-600 transition-colors"
              title="Open recipe page"
            >
              <ExternalLink className="h-4 w-4" />
            </Link>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {recipe?.description && (
          <p className="text-sm text-surface-500">{recipe.description}</p>
        )}

        {/* Macros */}
        {scaledMacros && (
          <div className="rounded-lg border border-border bg-surface-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-surface-400">
              Macros{resolvedServings !== 1 ? ` · ${resolvedServings} servings` : ''}
            </p>
            <div className="grid grid-cols-5 gap-4 text-center">
              {[
                { val: scaledMacros.calories, label: 'Calories', color: 'text-surface-800' },
                { val: `${scaledMacros.protein_g}g`, label: 'Protein', color: 'text-blue-400' },
                { val: `${scaledMacros.carbs_g}g`, label: 'Carbs', color: 'text-amber-400' },
                { val: `${scaledMacros.fat_g}g`, label: 'Fat', color: 'text-rose-400' },
                { val: `${scaledMacros.fiber_g}g`, label: 'Fiber', color: 'text-green-400' },
              ].map(({ val, label, color }) => (
                <div key={label}>
                  <p className={`text-xl font-bold ${color}`}>{val}</p>
                  <p className="text-xs text-surface-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-surface-400">Ingredients</p>
            <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
              {ingredients.map((ing) => {
                const base = effectiveIngredientMacros(ing)
                const macros: MacroData = {
                  calories: Math.round(base.calories * resolvedServings),
                  protein_g: Math.round(base.protein_g * resolvedServings * 10) / 10,
                  carbs_g: Math.round(base.carbs_g * resolvedServings * 10) / 10,
                  fat_g: Math.round(base.fat_g * resolvedServings * 10) / 10,
                  fiber_g: Math.round(base.fiber_g * resolvedServings * 10) / 10,
                }
                return (
                  <div key={ing.id} className="flex items-center justify-between px-3 py-2 bg-card">
                    <span className="text-sm text-surface-700">
                      <span className="font-medium">{ing.quantity * resolvedServings} {ing.unit}</span> {ing.name}
                    </span>
                    <NutritionBadge macros={macros} />
                  </div>
                )
              })}
              {scaledMacros && (
                <div className="flex items-center justify-between px-3 py-2 bg-surface-50">
                  <span className="text-xs font-semibold text-surface-500">Total</span>
                  <NutritionBadge macros={scaledMacros} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Meal settings */}
        <div className="rounded-lg border border-border bg-surface-50 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">This Meal</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600">Meal slot</label>
              <select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)} className={inputClass}>
                {MEAL_SLOTS.map((s) => (
                  <option key={s} value={s}>{MEAL_SLOT_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-surface-600">Servings</label>
              <input
                type="number"
                value={servings}
                min={0.5}
                step={0.5}
                onChange={(e) => setServings(e.target.value === '' ? '' : Math.max(0.5, Number(e.target.value)))}
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-surface-600">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              rows={2}
              className={`${inputClass} resize-none`}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={handleSave}>Save</Button>
          {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
        </div>
      </div>
    </Modal>
  )
}
