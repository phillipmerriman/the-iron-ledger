import { useState, useMemo, type DragEvent } from 'react'
import { Search } from 'lucide-react'
import type { Recipe, MacroData } from '@/types/meal-types'
import NutritionBadge from './NutritionBadge'
import { cn } from '@/lib/utils'

interface RecipePickerProps {
  recipes: Recipe[]
  recipeMacros: Map<string, MacroData>
  onDragStart: (e: DragEvent, recipeId: string) => void
  onDragEnd: () => void
}

export default function RecipePicker({ recipes, recipeMacros, onDragStart, onDragEnd }: RecipePickerProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search) return recipes
    const q = search.toLowerCase()
    return recipes.filter((r) => r.name.toLowerCase().includes(q))
  }, [recipes, search])

  return (
    <div className="flex flex-col h-full">
      <h3 className="font-display text-sm font-semibold text-text mb-2">Recipes</h3>

      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="block w-full rounded-lg border border-input-border bg-input-bg pl-8 pr-2 py-1.5 text-xs text-text focus:outline-none focus:ring-1 focus:border-primary-500 focus:ring-primary-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-surface-400 text-center py-4">
            {search ? 'No matches' : 'No recipes yet'}
          </p>
        ) : (
          filtered.map((recipe) => {
            const macros = recipeMacros.get(recipe.id)
            return (
              <div
                key={recipe.id}
                draggable
                onDragStart={(e) => onDragStart(e, recipe.id)}
                onDragEnd={onDragEnd}
                className="cursor-grab rounded-lg border border-border bg-card px-2.5 py-2 transition-colors hover:border-primary-300 hover:bg-surface-50 active:cursor-grabbing"
              >
                <div className="text-xs font-medium text-text truncate">{recipe.name}</div>
                {macros && (
                  <NutritionBadge macros={macros} className="mt-0.5" />
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
