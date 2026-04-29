import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import IngredientRow from './IngredientRow'
import NutritionBadge from './NutritionBadge'
import { sumMacros, effectiveIngredientMacros } from '@/types/meal-types'
import type { Recipe, RecipeIngredient, RecipeStep } from '@/types/meal-types'

interface RecipeFormProps {
  initial?: Recipe
  initialIngredients?: RecipeIngredient[]
  initialSteps?: RecipeStep[]
  onSave: (
    recipe: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
    ingredients: Omit<RecipeIngredient, 'id' | 'recipe_id'>[],
    steps: Omit<RecipeStep, 'id' | 'recipe_id'>[],
  ) => void
  onCancel?: () => void
  cancelLabel?: string
  saving?: boolean
}

// ── Draft auto-save ─────────────────────────────────────

interface DraftData {
  name: string
  description: string
  servings: number
  rating: number | null
  notes: string
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  savedAt: string
}

function draftKey(recipeId?: string) {
  return `fittrack:recipe_draft:${recipeId ?? 'new'}`
}

function loadDraft(recipeId?: string): DraftData | null {
  try {
    const raw = localStorage.getItem(draftKey(recipeId))
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveDraft(recipeId: string | undefined, data: DraftData) {
  localStorage.setItem(draftKey(recipeId), JSON.stringify(data))
}

function clearDraft(recipeId?: string) {
  localStorage.removeItem(draftKey(recipeId))
}

function emptyIngredient(sortOrder: number): RecipeIngredient {
  return {
    id: crypto.randomUUID(),
    recipe_id: '',
    name: '',
    quantity: 1,
    unit: 'oz',
    calories: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    fiber_g: 0,
    rating: null,
    sort_order: sortOrder,
    macro_mode: 'per_unit',
    extra_nutrients: {},
  }
}

export default function RecipeForm({ initial, initialIngredients, initialSteps, onSave, onCancel, cancelLabel = 'Cancel', saving }: RecipeFormProps) {
  const recipeId = initial?.id
  const draft = useRef(loadDraft(recipeId)).current
  const [restoredDraft, setRestoredDraft] = useState(false)

  const [name, setName] = useState(draft?.name ?? initial?.name ?? '')
  const [description, setDescription] = useState(draft?.description ?? initial?.description ?? '')
  const [servings, setServings] = useState(draft?.servings ?? initial?.servings ?? 1)
  const [rating, setRating] = useState<number | null>(draft?.rating ?? initial?.rating ?? null)
  const [notes, setNotes] = useState(draft?.notes ?? initial?.notes ?? '')
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    draft?.ingredients?.length ? draft.ingredients
    : initialIngredients?.length ? initialIngredients
    : [emptyIngredient(0)],
  )
  const [steps, setSteps] = useState<RecipeStep[]>(
    draft?.steps?.length ? draft.steps
    : initialSteps?.length ? initialSteps
    : [],
  )

  // Show restore banner if draft was loaded
  useEffect(() => {
    if (draft) setRestoredDraft(true)
  }, [])

  function handleDiscardDraft() {
    clearDraft(recipeId)
    setRestoredDraft(false)
    // Reset to initial/empty state
    setName(initial?.name ?? '')
    setDescription(initial?.description ?? '')
    setServings(initial?.servings ?? 1)
    setRating(initial?.rating ?? null)
    setNotes(initial?.notes ?? '')
    setIngredients(initialIngredients?.length ? initialIngredients : [emptyIngredient(0)])
    setSteps(initialSteps?.length ? initialSteps : [])
  }

  // Auto-save draft on changes (debounced)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      // Only save if there's meaningful content
      const hasContent = name.trim() || ingredients.some((i) => i.name.trim()) || steps.some((s) => s.instruction.trim())
      if (hasContent) {
        saveDraft(recipeId, { name, description, servings, rating, notes, ingredients, steps, savedAt: new Date().toISOString() })
      }
    }, 800)
    return () => clearTimeout(timerRef.current)
  }, [name, description, servings, rating, notes, ingredients, steps, recipeId])

  // Sync when initial props change (e.g. navigating between recipes)
  useEffect(() => {
    if (initial) {
      const d = loadDraft(initial.id)
      if (!d) {
        setName(initial.name)
        setDescription(initial.description ?? '')
        setServings(initial.servings)
        setRating(initial.rating)
        setNotes(initial.notes ?? '')
      }
    }
  }, [initial?.id])

  useEffect(() => {
    if (initialIngredients?.length && !loadDraft(recipeId)) setIngredients(initialIngredients)
  }, [initialIngredients])

  useEffect(() => {
    if (initialSteps?.length && !loadDraft(recipeId)) setSteps(initialSteps)
  }, [initialSteps])

  const totalMacros = sumMacros(ingredients.map(effectiveIngredientMacros), 1)
  const perServing = sumMacros(ingredients.map(effectiveIngredientMacros), servings)

  function handleIngredientChange(id: string, field: string, value: string | number | null) {
    setIngredients((prev) =>
      prev.map((ing) => (ing.id === id ? { ...ing, [field]: value } : ing)),
    )
  }

  function handleExtraNutrientChange(id: string, key: string, value: number | null) {
    setIngredients((prev) =>
      prev.map((ing) => {
        if (ing.id !== id) return ing
        const next = { ...ing.extra_nutrients }
        if (value == null) delete next[key]
        else next[key] = value
        return { ...ing, extra_nutrients: next }
      }),
    )
  }

  function handleRemoveIngredient(id: string) {
    setIngredients((prev) => prev.filter((ing) => ing.id !== id))
  }

  function handleAddIngredient() {
    setIngredients((prev) => [...prev, emptyIngredient(prev.length)])
  }

  function handleAddStep() {
    setSteps((prev) => [
      ...prev,
      { id: crypto.randomUUID(), recipe_id: '', step_number: prev.length + 1, instruction: '' },
    ])
  }

  function handleStepChange(id: string, instruction: string) {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, instruction } : s)),
    )
  }

  function handleRemoveStep(id: string) {
    setSteps((prev) =>
      prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, step_number: i + 1 })),
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    clearDraft(recipeId)
    setRestoredDraft(false)
    onSave(
      { name: name.trim(), description: description.trim() || null, servings, rating, notes: notes.trim() || null },
      ingredients
        .filter((i) => i.name.trim())
        .map((i, idx) => ({
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          calories: i.calories,
          protein_g: i.protein_g,
          carbs_g: i.carbs_g,
          fat_g: i.fat_g,
          fiber_g: i.fiber_g,
          rating: i.rating,
          sort_order: idx,
          macro_mode: i.macro_mode ?? 'total',
          extra_nutrients: i.extra_nutrients ?? {},
        })),
      steps
        .filter((s) => s.instruction.trim())
        .map((s, idx) => ({
          step_number: idx + 1,
          instruction: s.instruction.trim(),
        })),
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {restoredDraft && (
        <div className="flex items-center justify-between rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700">
          <span>Unsaved draft restored.</span>
          <button type="button" onClick={handleDiscardDraft} className="font-medium underline hover:text-primary-900">
            Discard draft
          </button>
        </div>
      )}

      {/* Basic info */}
      <div className="space-y-3">
        <Input
          label="Recipe Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pan-Fried Walleye Pike"
          required
        />
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the dish..."
            rows={2}
            className="block w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-text shadow-sm transition-colors focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-3">
          <div className="w-24">
            <Input
              label="Servings"
              type="number"
              value={servings}
              onChange={(e) => setServings(Math.max(1, Number(e.target.value)))}
              min={1}
            />
          </div>
          <div className="w-24">
            <label className="block text-sm font-medium text-surface-700 mb-1">Rating</label>
            <select
              value={rating ?? ''}
              onChange={(e) => setRating(e.target.value ? Number(e.target.value) : null)}
              className="block w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-text shadow-sm focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
            >
              <option value="">-</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <h3 className="text-sm font-semibold text-text mb-2">Ingredients</h3>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <IngredientRow
              key={ing.id}
              ingredient={ing}
              index={i}
              onChange={handleIngredientChange}
              onExtraNutrientChange={handleExtraNutrientChange}
              onRemove={handleRemoveIngredient}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddIngredient}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          <Plus className="h-3.5 w-3.5" /> Add Ingredient
        </button>

        {/* Macro totals */}
        {ingredients.some((i) => i.calories > 0) && (
          <div className="mt-3 rounded-lg bg-surface-50 p-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-surface-600">Total</span>
              <NutritionBadge macros={totalMacros} />
            </div>
            {servings > 1 && (
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-surface-600">Per Serving</span>
                <NutritionBadge macros={perServing} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-text">Steps</h3>
          <button
            type="button"
            onClick={handleAddStep}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            <Plus className="h-3.5 w-3.5" /> Add Step
          </button>
        </div>
        <div className="space-y-2">
          {steps.map((step) => (
            <div key={step.id} className="flex items-start gap-2">
              <span className="mt-2.5 text-xs font-medium text-surface-400 w-5 shrink-0">{step.step_number}.</span>
              <textarea
                value={step.instruction}
                onChange={(e) => handleStepChange(step.id, e.target.value)}
                placeholder={`Step ${step.step_number}...`}
                rows={2}
                className="block flex-1 rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-text shadow-sm focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => handleRemoveStep(step.id)}
                className="mt-2 rounded p-1 text-surface-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Tips, variations, etc..."
          rows={3}
          className="block w-full rounded-lg border border-input-border bg-input-bg px-3 py-2 text-sm text-text shadow-sm transition-colors focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        )}
        <Button type="submit" disabled={!name.trim() || saving}>
          {saving ? 'Saving...' : initial ? 'Update Recipe' : 'Save Recipe'}
        </Button>
      </div>
    </form>
  )
}
