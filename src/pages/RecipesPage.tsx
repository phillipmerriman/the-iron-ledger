import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import useRecipes from '@/hooks/useRecipes'
import RecipeCard from '@/components/meals/RecipeCard'
import RecipeForm from '@/components/meals/RecipeForm'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import type { Recipe, RecipeIngredient, RecipeStep } from '@/types/meal-types'

export default function RecipesPage() {
  const navigate = useNavigate()
  const { recipes, loading, create, remove } = useRecipes()

  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return recipes
    const q = search.toLowerCase()
    return recipes.filter((r) => r.name.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q))
  }, [recipes, search])

  async function handleSave(
    recipe: Omit<Recipe, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
    _ingredients: Omit<RecipeIngredient, 'id' | 'recipe_id'>[],
    _steps: Omit<RecipeStep, 'id' | 'recipe_id'>[],
  ) {
    setSaving(true)
    try {
      const created = await create(recipe)
      if (created) {
        // Navigate to detail page where user can manage ingredients/steps
        navigate(`/meals/recipes/${created.id}`)
      }
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold text-text">Recipes</h1>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Add Recipe
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes..."
          className="block w-full rounded-lg border border-input-border bg-input-bg pl-9 pr-3 py-2 text-sm text-text shadow-sm focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
        />
      </div>

      {/* Recipe list */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-surface-500">
            {search ? 'No recipes match your search.' : 'No recipes yet. Create your first one!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => navigate(`/meals/recipes/${recipe.id}`)}
              onDelete={() => remove(recipe.id)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Recipe">
        <RecipeForm
          onSave={handleSave}
          onCancel={() => setModalOpen(false)}
          saving={saving}
        />
      </Modal>
    </div>
  )
}
