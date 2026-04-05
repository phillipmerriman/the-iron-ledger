import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Pencil, Trash2, Star } from 'lucide-react'
import useRecipes, { useRecipeIngredients, useRecipeSteps } from '@/hooks/useRecipes'
import RecipeForm from '@/components/meals/RecipeForm'
import NutritionBadge from '@/components/meals/NutritionBadge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { sumMacros, effectiveIngredientMacros } from '@/types/meal-types'
import type { Recipe, RecipeIngredient, RecipeStep } from '@/types/meal-types'

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { recipes, loading: recipesLoading, update: updateRecipe, remove: removeRecipe } = useRecipes()
  const recipe = recipes.find((r) => r.id === id)

  const { ingredients, loading: ingredientsLoading, add: addIngredient, update: updateIngredient, remove: removeIngredient } = useRecipeIngredients(id!)
  const { steps, loading: stepsLoading, add: addStep, update: updateStep, remove: removeStep } = useRecipeSteps(id!)

  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const loading = recipesLoading || ingredientsLoading || stepsLoading

  const perServing = sumMacros(ingredients.map(effectiveIngredientMacros), recipe?.servings ?? 1)
  const totalMacros = sumMacros(ingredients.map(effectiveIngredientMacros), 1)

  async function handleSave(
    recipeData: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
    newIngredients: Omit<RecipeIngredient, 'id' | 'recipe_id'>[],
    newSteps: Omit<RecipeStep, 'id' | 'recipe_id'>[],
  ) {
    if (!id) return
    setSaving(true)
    try {
      await updateRecipe(id, recipeData)

      // Remove old ingredients and steps, then re-add
      for (const ing of ingredients) await removeIngredient(ing.id)
      for (const step of steps) await removeStep(step.id)

      for (const ing of newIngredients) await addIngredient(ing)
      for (const step of newSteps) await addStep(step)

      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!id) return
    if (!confirm('Delete this recipe?')) return
    await removeRecipe(id)
    navigate('/meals/recipes')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-surface-500">Recipe not found.</p>
        <Link to="/meals/recipes" className="mt-2 text-sm text-primary-600 hover:text-primary-700">
          Back to recipes
        </Link>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setEditing(false)}
          className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700"
        >
          <ArrowLeft className="h-4 w-4" /> Cancel editing
        </button>
        <RecipeForm
          initial={recipe}
          initialIngredients={ingredients}
          initialSteps={steps}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          saving={saving}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            to="/meals/recipes"
            className="mb-2 flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700"
          >
            <ArrowLeft className="h-4 w-4" /> Recipes
          </Link>
          <h1 className="font-display text-xl font-bold text-text">{recipe.name}</h1>
          {recipe.description && (
            <p className="mt-1 text-sm text-surface-600">{recipe.description}</p>
          )}
          <div className="mt-2 flex items-center gap-4 text-sm text-surface-500">
            <span>{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
            {recipe.rating != null && (
              <span className="flex items-center gap-0.5 text-amber-500">
                <Star className="h-3.5 w-3.5 fill-current" /> {recipe.rating}/5
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg p-1.5 text-surface-400 hover:text-danger-500 hover:bg-danger-50 transition-colors"
            aria-label="Delete recipe"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Nutrition summary */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-text mb-3">Nutrition per Serving</h2>
        <div className="grid grid-cols-5 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-surface-800">{Math.round(perServing.calories)}</div>
            <div className="text-xs text-surface-500">Calories</div>
          </div>
          <div>
            <div className="text-lg font-bold text-blue-400">{Math.round(perServing.protein_g)}g</div>
            <div className="text-xs text-surface-500">Protein</div>
          </div>
          <div>
            <div className="text-lg font-bold text-amber-400">{Math.round(perServing.carbs_g)}g</div>
            <div className="text-xs text-surface-500">Carbs</div>
          </div>
          <div>
            <div className="text-lg font-bold text-rose-400">{Math.round(perServing.fat_g)}g</div>
            <div className="text-xs text-surface-500">Fat</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-400">{Math.round(perServing.fiber_g)}g</div>
            <div className="text-xs text-surface-500">Fiber</div>
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <h2 className="text-sm font-semibold text-text mb-2">
          Ingredients ({ingredients.length})
        </h2>
        {ingredients.length === 0 ? (
          <p className="text-sm text-surface-500">No ingredients yet. Click Edit to add them.</p>
        ) : (
          <div className="space-y-1">
            {ingredients.map((ing) => (
              <div key={ing.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text">{ing.quantity} {ing.unit}</span>
                  <span className="text-sm text-surface-600">{ing.name}</span>
                </div>
                <NutritionBadge macros={ing} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text mb-2">Steps</h2>
          <ol className="space-y-3">
            {steps.map((step) => (
              <li key={step.id} className="flex gap-3">
                <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                  {step.step_number}
                </span>
                <p className="text-sm text-surface-700 pt-0.5">{step.instruction}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Notes */}
      {recipe.notes && (
        <div>
          <h2 className="text-sm font-semibold text-text mb-1">Notes</h2>
          <p className="text-sm text-surface-600 whitespace-pre-wrap">{recipe.notes}</p>
        </div>
      )}
    </div>
  )
}
