import { Star, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Recipe, MacroData } from '@/types/meal-types'
import NutritionBadge from './NutritionBadge'

interface RecipeCardProps {
  recipe: Recipe
  macros?: MacroData
  onClick?: () => void
  onDelete?: () => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}

export default function RecipeCard({ recipe, macros, onClick, onDelete, draggable, onDragStart }: RecipeCardProps) {
  return (
    <div
      className={cn(
        'group rounded-lg border border-border bg-card p-3 transition-colors',
        onClick && 'cursor-pointer hover:border-primary-300 hover:bg-surface-50',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold text-text truncate">{recipe.name}</h3>
          {recipe.description && (
            <p className="mt-0.5 text-xs text-surface-500 line-clamp-2">{recipe.description}</p>
          )}
          <div className="mt-1.5 flex items-center gap-3">
            <span className="text-xs text-surface-500">{recipe.servings} serving{recipe.servings !== 1 ? 's' : ''}</span>
            {recipe.rating != null && (
              <span className="flex items-center gap-0.5 text-xs text-amber-500">
                <Star className="h-3 w-3 fill-current" />
                {recipe.rating}
              </span>
            )}
          </div>
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="rounded p-1 text-surface-400 opacity-0 group-hover:opacity-100 hover:text-danger-600 hover:bg-danger-50 transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {macros && (
        <div className="mt-2 pt-2 border-t border-border">
          <NutritionBadge macros={macros} />
        </div>
      )}
    </div>
  )
}
