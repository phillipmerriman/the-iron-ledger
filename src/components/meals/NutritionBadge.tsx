import { cn } from '@/lib/utils'
import type { MacroData } from '@/types/meal-types'

interface NutritionBadgeProps {
  macros: MacroData
  className?: string
  compact?: boolean
}

export default function NutritionBadge({ macros, className, compact }: NutritionBadgeProps) {
  if (compact) {
    return (
      <span className={cn('text-xs text-surface-500', className)}>
        {Math.round(macros.calories)}cal
      </span>
    )
  }

  return (
    <div className={cn('flex items-center gap-2 text-xs', className)}>
      <span className="font-medium text-surface-700">{Math.round(macros.calories)}cal</span>
      <span className="text-blue-600">{Math.round(macros.protein_g)}p</span>
      <span className="text-amber-600">{Math.round(macros.carbs_g)}c</span>
      <span className="text-rose-600">{Math.round(macros.fat_g)}f</span>
    </div>
  )
}
