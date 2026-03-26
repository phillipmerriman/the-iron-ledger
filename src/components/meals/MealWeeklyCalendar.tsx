import { useSearchParams } from 'react-router-dom'
import { format, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import useMealPlan from '@/hooks/useMealPlan'
import useRecipes from '@/hooks/useRecipes'
import { MEAL_SLOTS, MEAL_SLOT_LABELS } from '@/types/meal-types'
import type { MealSlot } from '@/types/meal-types'
import { cn } from '@/lib/utils'

const SLOT_COLORS: Record<MealSlot, string> = {
  breakfast: 'bg-amber-400',
  lunch: 'bg-orange-400',
  dinner: 'bg-rose-400',
  snack: 'bg-violet-400',
}

export default function MealWeeklyCalendar() {
  const [searchParams, setSearchParams] = useSearchParams()
  const weekDelta = Number(searchParams.get('mealweek')) || 0
  function setWeekDelta(update: number | ((prev: number) => number)) {
    const next = typeof update === 'function' ? update(weekDelta) : update
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 0) params.delete('mealweek')
      else params.set('mealweek', String(next))
      return params
    }, { replace: true })
  }
  const isCurrentWeek = weekDelta === 0

  const { days, dateKeys, getEntriesForDate, getEntriesForDateSlot } = useMealPlan({
    weekOffset: weekDelta,
  })
  const { recipes } = useRecipes()

  function getRecipeName(recipeId: string | null) {
    if (!recipeId) return 'Custom'
    return recipes.find((r) => r.id === recipeId)?.name ?? 'Unknown'
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="font-display text-sm font-semibold text-text">Meal Plan</h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setWeekDelta((w) => w - 1)}
            className="rounded p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekDelta(0)}
              className="rounded px-2 py-0.5 text-xs font-medium text-primary-600 hover:bg-primary-50"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setWeekDelta((w) => w + 1)}
            className="rounded p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 divide-x divide-border">
        {days.map((day, i) => {
          const dateKey = dateKeys[i]
          const today = isToday(day)
          const dayEntries = getEntriesForDate(dateKey)
          const totalCalories = dayEntries.reduce((sum, _entry) => sum, 0) // simplified for now

          return (
            <div
              key={dateKey}
              className={cn(
                'px-2 py-2 min-h-[5rem]',
                today && 'bg-primary-50/50',
              )}
            >
              <div className="text-center mb-1.5">
                <div className={cn(
                  'text-[10px] font-semibold uppercase',
                  today ? 'text-primary-600' : 'text-surface-400',
                )}>
                  {format(day, 'EEE')}
                </div>
                <div className={cn(
                  'text-xs font-medium',
                  today ? 'text-primary-700' : 'text-surface-600',
                )}>
                  {format(day, 'M/d')}
                </div>
              </div>

              {dayEntries.length === 0 ? (
                <div className="text-center py-2">
                  <div className="text-[10px] text-surface-300">No meals</div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {MEAL_SLOTS.map((slot) => {
                    const slotEntries = getEntriesForDateSlot(dateKey, slot)
                    if (slotEntries.length === 0) return null
                    return (
                      <div key={slot} className="flex items-center gap-1">
                        <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', SLOT_COLORS[slot])} />
                        <span className="text-[10px] text-surface-500 truncate">
                          {slotEntries.length} {MEAL_SLOT_LABELS[slot].toLowerCase()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
