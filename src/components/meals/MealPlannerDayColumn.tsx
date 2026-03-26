import { useState, type DragEvent } from 'react'
import { format, isToday } from 'date-fns'
import { Sunrise, Sun, Sunset, Cookie, X, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MEAL_SLOTS, MEAL_SLOT_LABELS } from '@/types/meal-types'
import type { PlannedMeal, PlannedMealUpdate, MealSlot, Recipe, MacroData } from '@/types/meal-types'
import { sumMacros } from '@/types/meal-types'
import NutritionBadge from './NutritionBadge'

const SLOT_ICONS: Record<MealSlot, typeof Sun> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Sunset,
  snack: Cookie,
}

export interface MealPlannerDayColumnProps {
  day: Date
  dateKey: string
  recipes: Recipe[]
  recipeMacros: Map<string, MacroData>

  getEntriesForDateSlot: (dateKey: string, slot: MealSlot) => PlannedMeal[]

  onUpdateMeal: (id: string, values: PlannedMealUpdate) => void
  onRemoveMeal: (id: string) => void

  // Drag/drop
  onSlotDragOver: (e: DragEvent, dateKey: string, slot: MealSlot) => void
  onSlotDragLeave: () => void
  onSlotDrop: (e: DragEvent, dateKey: string, slot: MealSlot) => void

  dropTarget: { dateKey: string; slot: MealSlot } | null
}

export default function MealPlannerDayColumn({
  day,
  dateKey,
  recipes,
  recipeMacros,
  getEntriesForDateSlot,
  onUpdateMeal,
  onRemoveMeal,
  onSlotDragOver,
  onSlotDragLeave,
  onSlotDrop,
  dropTarget,
}: MealPlannerDayColumnProps) {
  const today = isToday(day)
  const dayName = format(day, 'EEE')
  const dayDate = format(day, 'M/d')

  // Calculate daily totals
  const allEntries = MEAL_SLOTS.flatMap((slot) => getEntriesForDateSlot(dateKey, slot))
  const dailyMacros = allEntries.reduce<MacroData>(
    (acc, entry) => {
      const macros = entry.recipe_id ? recipeMacros.get(entry.recipe_id) : null
      if (!macros) return acc
      const s = entry.servings || 1
      return {
        calories: acc.calories + macros.calories * s,
        protein_g: acc.protein_g + macros.protein_g * s,
        carbs_g: acc.carbs_g + macros.carbs_g * s,
        fat_g: acc.fat_g + macros.fat_g * s,
        fiber_g: acc.fiber_g + macros.fiber_g * s,
      }
    },
    { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
  )

  function getRecipeName(recipeId: string | null) {
    if (!recipeId) return 'Custom meal'
    return recipes.find((r) => r.id === recipeId)?.name ?? 'Unknown recipe'
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border bg-card',
        today ? 'border-primary-300 ring-1 ring-primary-200' : 'border-border',
      )}
    >
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between border-b px-3 py-2',
        today ? 'border-primary-200 bg-primary-50' : 'border-border bg-surface-50',
      )}>
        <div>
          <span className={cn('text-xs font-semibold', today ? 'text-primary-700' : 'text-surface-500')}>
            {dayName}
          </span>
          <span className={cn('ml-1.5 text-xs', today ? 'text-primary-600' : 'text-surface-400')}>
            {dayDate}
          </span>
        </div>
        {dailyMacros.calories > 0 && (
          <NutritionBadge macros={dailyMacros} compact />
        )}
      </div>

      {/* Meal slots */}
      <div className="flex-1 divide-y divide-border">
        {MEAL_SLOTS.map((slot) => {
          const Icon = SLOT_ICONS[slot]
          const slotEntries = getEntriesForDateSlot(dateKey, slot)
          const isDropTarget = dropTarget?.dateKey === dateKey && dropTarget?.slot === slot

          return (
            <div
              key={slot}
              className={cn(
                'px-2 py-1.5 min-h-[3rem] transition-colors',
                isDropTarget && 'bg-primary-50',
              )}
              onDragOver={(e) => onSlotDragOver(e, dateKey, slot)}
              onDragLeave={onSlotDragLeave}
              onDrop={(e) => onSlotDrop(e, dateKey, slot)}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3 w-3 text-surface-400" />
                <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wide">
                  {MEAL_SLOT_LABELS[slot]}
                </span>
              </div>

              {slotEntries.length === 0 ? (
                <div className="py-1 text-center text-[10px] text-surface-300">
                  Drop recipe here
                </div>
              ) : (
                <div className="space-y-1">
                  {slotEntries.map((entry) => {
                    const macros = entry.recipe_id ? recipeMacros.get(entry.recipe_id) : null
                    return (
                      <div
                        key={entry.id}
                        className="group flex items-center justify-between rounded bg-surface-50 px-2 py-1 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-medium text-text truncate block">
                            {getRecipeName(entry.recipe_id)}
                          </span>
                          {macros && (
                            <NutritionBadge
                              macros={{
                                ...macros,
                                calories: macros.calories * (entry.servings || 1),
                                protein_g: macros.protein_g * (entry.servings || 1),
                                carbs_g: macros.carbs_g * (entry.servings || 1),
                                fat_g: macros.fat_g * (entry.servings || 1),
                                fiber_g: macros.fiber_g * (entry.servings || 1),
                              }}
                              className="mt-0.5"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => onRemoveMeal(entry.id)}
                          className="ml-1 rounded p-0.5 text-surface-300 opacity-0 group-hover:opacity-100 hover:text-danger-600 transition-all"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Daily totals footer */}
      {dailyMacros.calories > 0 && (
        <div className="border-t border-border px-3 py-1.5 bg-surface-50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-surface-500 uppercase">Daily Total</span>
            <NutritionBadge macros={dailyMacros} />
          </div>
        </div>
      )}
    </div>
  )
}
