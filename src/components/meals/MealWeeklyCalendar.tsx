import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { format, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Pencil, Check, Undo2 } from 'lucide-react'
import useMealPlan from '@/hooks/useMealPlan'
import useRecipes from '@/hooks/useRecipes'
import { loadRecipeIngredients } from '@/hooks/useRecipes'
import { MEAL_SLOTS, MEAL_SLOT_LABELS, sumMacros, effectiveIngredientMacros } from '@/types/meal-types'
import type { MealSlot, PlannedMeal, MacroData } from '@/types/meal-types'
import Modal from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

const SLOT_COLORS: Record<MealSlot, string> = {
  breakfast: 'bg-amber-400',
  lunch: 'bg-orange-400',
  dinner: 'bg-rose-400',
  snack: 'bg-violet-400',
}

const SLOT_TEXT_COLORS: Record<MealSlot, string> = {
  breakfast: 'text-amber-600',
  lunch: 'text-orange-600',
  dinner: 'text-rose-500',
  snack: 'text-violet-600',
}

const SLOT_BG_COLORS: Record<MealSlot, string> = {
  breakfast: 'bg-amber-50',
  lunch: 'bg-orange-50',
  dinner: 'bg-rose-50',
  snack: 'bg-violet-50',
}

export default function MealWeeklyCalendar() {
  const [searchParams, setSearchParams] = useSearchParams()
  const weekDelta = Number(searchParams.get('mealweek')) || 0
  const [selectedDay, setSelectedDay] = useState<{ date: Date; dateKey: string } | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [recipeMacros, setRecipeMacros] = useState<Record<string, MacroData>>({})

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

  const { days, dateKeys, entries: allEntries, getEntriesForDate, getEntriesForDateSlot, markEaten } = useMealPlan({
    weekOffset: weekDelta,
  })
  const { recipes } = useRecipes()

  function getRecipeName(recipeId: string | null) {
    if (!recipeId) return 'Custom meal'
    return recipes.find((r) => r.id === recipeId)?.name ?? 'Unknown recipe'
  }

  // Load macros for all recipes in the week whenever entries change
  useEffect(() => {
    const recipeIds = [...new Set(allEntries.map((e) => e.recipe_id).filter((id): id is string => !!id))]
    const missing = recipeIds.filter((id) => !recipeMacros[id])
    if (missing.length === 0) return
    Promise.all(
      missing.map(async (id) => {
        try {
          const ings = await loadRecipeIngredients(id)
          return [id, sumMacros(ings.map(effectiveIngredientMacros), 1)] as [string, MacroData]
        } catch {
          return null
        }
      }),
    ).then((results) => {
      const loaded: Record<string, MacroData> = {}
      for (const r of results) {
        if (r) loaded[r[0]] = r[1]
      }
      if (Object.keys(loaded).length > 0) {
        setRecipeMacros((prev) => ({ ...prev, ...loaded }))
      }
    })
  }, [allEntries])

  function handleOpenDay(date: Date, dateKey: string) {
    setSelectedDay({ date, dateKey })
  }

  async function handleToggleEaten(entry: PlannedMeal) {
    setMarkingId(entry.id)
    try {
      await markEaten(entry.id, !entry.eaten_at)
    } catch (err) {
      console.error('[MealWeeklyCalendar] markEaten failed', err)
    } finally {
      setMarkingId(null)
    }
  }

  function getMacrosForEntry(entry: PlannedMeal): MacroData | null {
    if (!entry.recipe_id) return null
    const base = recipeMacros[entry.recipe_id]
    if (!base) return null
    const s = entry.servings
    return {
      calories: Math.round(base.calories * s),
      protein_g: Math.round(base.protein_g * s * 10) / 10,
      carbs_g: Math.round(base.carbs_g * s * 10) / 10,
      fat_g: Math.round(base.fat_g * s * 10) / 10,
      fiber_g: Math.round(base.fiber_g * s * 10) / 10,
    }
  }

  function sumEntryMacros(entries: PlannedMeal[]): MacroData {
    return entries.reduce<MacroData>(
      (acc, e) => {
        const m = getMacrosForEntry(e)
        if (!m) return acc
        return {
          calories: acc.calories + m.calories,
          protein_g: Math.round((acc.protein_g + m.protein_g) * 10) / 10,
          carbs_g: Math.round((acc.carbs_g + m.carbs_g) * 10) / 10,
          fat_g: Math.round((acc.fat_g + m.fat_g) * 10) / 10,
          fiber_g: Math.round((acc.fiber_g + m.fiber_g) * 10) / 10,
        }
      },
      { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 },
    )
  }

  const weekEatenEntries = allEntries.filter((e) => e.eaten_at)
  const weekTotals = sumEntryMacros(weekEatenEntries)
  const hasWeekMacros = weekEatenEntries.length > 0 && weekTotals.calories > 0

  const selectedEntries: PlannedMeal[] = selectedDay ? getEntriesForDate(selectedDay.dateKey) : []
  const eatenEntries = selectedEntries.filter((e) => e.eaten_at)
  const dayTotals = sumEntryMacros(eatenEntries)

  return (
    <>
      <div className="rounded-xl border border-border bg-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <h2 className="font-display text-sm font-semibold text-text">Meal Plan</h2>
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
          <Link
            to={`/plan?mode=meals${weekDelta !== 0 ? `&mealweek=${weekDelta}` : ''}`}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
          >
            <Pencil className="h-3 w-3" />
            Plan
          </Link>
        </div>

        {/* Days */}
        <div className="grid grid-cols-7 divide-x divide-border">
          {days.map((day, i) => {
            const dateKey = dateKeys[i]
            const today = isToday(day)
            const dayEntries = getEntriesForDate(dateKey)
            const eatenDayEntries = dayEntries.filter((e) => e.eaten_at)
            const dayTotals = sumEntryMacros(eatenDayEntries)
            const hasDayMacros = eatenDayEntries.length > 0 && dayTotals.calories > 0

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => handleOpenDay(day, dateKey)}
                className={cn(
                  'px-2 py-2 min-h-[5rem] text-left w-full transition-colors hover:bg-surface-50',
                  today && 'bg-primary-50/50 hover:bg-primary-50',
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
                      const allEaten = slotEntries.every((e) => e.eaten_at)
                      return (
                        <div key={slot} className="flex items-center gap-1">
                          <div className={cn('h-1.5 w-1.5 rounded-full shrink-0', SLOT_COLORS[slot])} />
                          <span className={cn('text-[10px] truncate', allEaten ? 'text-surface-400 line-through' : 'text-surface-500')}>
                            {slotEntries.length} {MEAL_SLOT_LABELS[slot].toLowerCase()}
                          </span>
                        </div>
                      )
                    })}
                    {hasDayMacros && (
                      <div className="mt-1 pt-1 border-t border-border/50 space-y-0.5">
                        <div className="text-[10px] font-semibold text-surface-600">{dayTotals.calories}cal</div>
                        <div className="text-[9px] text-surface-400 leading-tight">
                          <span className="text-blue-400">{dayTotals.protein_g}p</span>
                          {' · '}
                          <span className="text-amber-400">{dayTotals.carbs_g}c</span>
                          {' · '}
                          <span className="text-rose-400">{dayTotals.fat_g}f</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Weekly totals footer */}
        {hasWeekMacros && (
          <div className="border-t border-border px-4 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-surface-400">Week Total</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-surface-700">{weekTotals.calories.toLocaleString()}cal</span>
                <span className="text-blue-400">{weekTotals.protein_g}g protein</span>
                <span className="text-amber-400">{weekTotals.carbs_g}g carbs</span>
                <span className="text-rose-400">{weekTotals.fat_g}g fat</span>
                <span className="text-green-400">{weekTotals.fiber_g}g fiber</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Day detail modal */}
      <Modal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? format(selectedDay.date, 'EEEE, MMM d') : ''}
      >
        {selectedEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <p className="text-center text-sm text-surface-400">No meals planned for this day</p>
            <Link
              to={`/plan?mode=meals${weekDelta !== 0 ? `&mealweek=${weekDelta}` : ''}`}
              onClick={() => setSelectedDay(null)}
              className="text-sm text-primary-600"
            >
              Plan a meal! →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Eaten meals */}
            {eatenEntries.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-500">Eaten Meals</h4>
                {eatenEntries.map((entry) => {
                  const macros = getMacrosForEntry(entry)
                  const isMarking = markingId === entry.id
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between rounded-lg border border-surface-300 bg-surface-100 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-surface-900">{getRecipeName(entry.recipe_id)}</p>
                        <p className="mt-0.5 text-xs text-surface-400">
                          {MEAL_SLOT_LABELS[entry.meal_slot]}
                          {entry.servings !== 1 && ` · ${entry.servings} servings`}
                          {entry.eaten_at && ` — Eaten at ${format(new Date(entry.eaten_at), 'h:mm a')}`}
                        </p>
                        {macros && (
                          <p className="mt-0.5 text-xs font-semibold text-primary-600">
                            {macros.calories}cal · {macros.protein_g}p · {macros.carbs_g}c · {macros.fat_g}f
                          </p>
                        )}
                      </div>
                      <div className="ml-3 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isMarking}
                          onClick={() => handleToggleEaten(entry)}
                          className={cn('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-surface-500 hover:text-surface-700 hover:bg-surface-200 transition-colors', isMarking && 'opacity-50')}
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Undo
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Planned (uneaten) meals grouped by slot */}
            {selectedEntries.some((e) => !e.eaten_at) && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-500">Planned Meals</h4>
                {MEAL_SLOTS.map((slot) => {
                  const slotEntries = (selectedDay ? getEntriesForDateSlot(selectedDay.dateKey, slot) : []).filter((e) => !e.eaten_at)
                  if (slotEntries.length === 0) return null
                  return (
                    <div key={slot}>
                      <div className={cn('mb-1.5 flex items-center gap-1.5 rounded-md px-2 py-1', SLOT_BG_COLORS[slot])}>
                        <div className={cn('h-2 w-2 rounded-full', SLOT_COLORS[slot])} />
                        <span className={cn('text-xs font-semibold uppercase tracking-wide', SLOT_TEXT_COLORS[slot])}>
                          {MEAL_SLOT_LABELS[slot]}
                        </span>
                      </div>
                      <div className="space-y-1.5 pl-1">
                        {slotEntries.map((entry) => {
                          const macros = getMacrosForEntry(entry)
                          const isMarking = markingId === entry.id
                          return (
                            <div key={entry.id} className="rounded-lg border border-border bg-surface-50 p-2">
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-text">{getRecipeName(entry.recipe_id)}</p>
                                  {entry.servings !== 1 && (
                                    <p className="text-xs text-surface-400">{entry.servings} servings</p>
                                  )}
                                  {macros && (
                                    <p className="text-[11px] text-surface-400">{macros.calories}cal · {macros.protein_g}p · {macros.carbs_g}c · {macros.fat_g}f</p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  disabled={isMarking}
                                  onClick={() => handleToggleEaten(entry)}
                                  className={cn('shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 transition-colors', isMarking && 'opacity-50')}
                                >
                                  <Check className="h-3 w-3" /> I ate this
                                </button>
                              </div>
                              {entry.notes && <p className="mt-0.5 text-xs text-surface-500 italic">{entry.notes}</p>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Daily nutrition totals */}
            {eatenEntries.length > 0 && dayTotals.calories > 0 && (
              <div className="rounded-lg bg-surface-100 px-4 py-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-surface-500">Today's Nutrition (eaten)</p>
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div>
                    <p className="text-sm font-bold text-text">{dayTotals.calories}</p>
                    <p className="text-[10px] text-surface-400">Cal</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-400">{dayTotals.protein_g}g</p>
                    <p className="text-[10px] text-surface-400">Protein</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-400">{dayTotals.carbs_g}g</p>
                    <p className="text-[10px] text-surface-400">Carbs</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-rose-400">{dayTotals.fat_g}g</p>
                    <p className="text-[10px] text-surface-400">Fat</p>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-400">{dayTotals.fiber_g}g</p>
                    <p className="text-[10px] text-surface-400">Fiber</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
