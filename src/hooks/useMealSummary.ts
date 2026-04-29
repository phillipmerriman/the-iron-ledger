import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns'
import { supabase, isDev } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { loadRecipeIngredients } from '@/hooks/useRecipes'
import { MEAL_SLOTS, sumMacros, effectiveIngredientMacros } from '@/types/meal-types'
import type { MacroData, MealSlot, PlannedMeal } from '@/types/meal-types'

const STORAGE_KEY = 'fittrack:meal_plan'

function loadAll(): PlannedMeal[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  const parsed = JSON.parse(raw) as Partial<PlannedMeal>[]
  return parsed.map((e): PlannedMeal => ({
    id: e.id!,
    user_id: e.user_id!,
    diet_id: e.diet_id ?? null,
    recipe_id: e.recipe_id ?? null,
    date: e.date!,
    meal_slot: e.meal_slot ?? 'lunch',
    sort_order: e.sort_order ?? 0,
    servings: e.servings ?? 1,
    rating: e.rating ?? null,
    notes: e.notes ?? null,
    eaten_at: e.eaten_at ?? null,
    created_at: e.created_at ?? new Date().toISOString(),
  }))
}

export interface NextMeal {
  slot: MealSlot
  recipeName: string | null
  recipeId: string | null
  date: string // YYYY-MM-DD
}

export interface MealSummary {
  todayMacros: MacroData | null
  weekMacros: MacroData | null
  nextMeal: NextMeal | null
  loading: boolean
}

const ZERO: MacroData = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 }

function addMacros(a: MacroData, b: MacroData): MacroData {
  return {
    calories: a.calories + b.calories,
    protein_g: Math.round((a.protein_g + b.protein_g) * 10) / 10,
    carbs_g: Math.round((a.carbs_g + b.carbs_g) * 10) / 10,
    fat_g: Math.round((a.fat_g + b.fat_g) * 10) / 10,
    fiber_g: Math.round((a.fiber_g + b.fiber_g) * 10) / 10,
  }
}

export default function useMealSummary(recipeNames: Record<string, string>): MealSummary {
  const { user } = useAuth()
  const [summary, setSummary] = useState<MealSummary>({ todayMacros: null, weekMacros: null, nextMeal: null, loading: true })

  useEffect(() => {
    if (!user) return
    const userId = user.id
    let cancelled = false

    async function compute() {
      const todayKey = format(new Date(), 'yyyy-MM-dd')
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')
      const futureEnd = format(addDays(new Date(), 30), 'yyyy-MM-dd')

      let todayMeals: PlannedMeal[] = []
      let weekMeals: PlannedMeal[] = []
      let futureMeals: PlannedMeal[] = []

      if (isDev) {
        const all = loadAll().filter((e) => e.user_id === userId)
        todayMeals = all.filter((e) => e.date === todayKey)
        weekMeals = all.filter((e) => e.date >= weekStart && e.date <= weekEnd)
        futureMeals = all.filter((e) => e.date > todayKey && e.date <= futureEnd)
      } else {
        const [todayRes, weekRes, futureRes] = await Promise.all([
          supabase.from('planned_meals').select('*').eq('user_id', userId).eq('date', todayKey),
          supabase.from('planned_meals').select('*').eq('user_id', userId).gte('date', weekStart).lte('date', weekEnd),
          supabase.from('planned_meals').select('*').eq('user_id', userId).gt('date', todayKey).lte('date', futureEnd).order('date').order('sort_order'),
        ])
        todayMeals = (todayRes.data ?? []) as unknown as PlannedMeal[]
        weekMeals = (weekRes.data ?? []) as unknown as PlannedMeal[]
        futureMeals = (futureRes.data ?? []) as unknown as PlannedMeal[]
      }

      if (cancelled) return

      // Load ingredients for all unique recipes
      const allMeals = [...todayMeals, ...weekMeals, ...futureMeals]
      const recipeIds = [...new Set(allMeals.map((e) => e.recipe_id).filter((id): id is string => !!id))]
      const ingredientCache: Record<string, MacroData> = {}

      await Promise.all(recipeIds.map(async (id) => {
        try {
          const ings = await loadRecipeIngredients(id)
          ingredientCache[id] = sumMacros(ings.map(effectiveIngredientMacros), 1)
        } catch { /* skip */ }
      }))

      if (cancelled) return

      function entryMacros(e: PlannedMeal): MacroData | null {
        if (!e.recipe_id) return null
        const base = ingredientCache[e.recipe_id]
        if (!base) return null
        const s = e.servings
        return {
          calories: Math.round(base.calories * s),
          protein_g: Math.round(base.protein_g * s * 10) / 10,
          carbs_g: Math.round(base.carbs_g * s * 10) / 10,
          fat_g: Math.round(base.fat_g * s * 10) / 10,
          fiber_g: Math.round(base.fiber_g * s * 10) / 10,
        }
      }

      // Today macros — eaten only
      const todayEaten = todayMeals.filter((e) => e.eaten_at)
      const todayMacros = todayEaten.length > 0
        ? todayEaten.reduce((acc, e) => { const m = entryMacros(e); return m ? addMacros(acc, m) : acc }, ZERO)
        : null

      // Week macros — eaten only
      const weekEaten = weekMeals.filter((e) => e.eaten_at)
      const weekMacros = weekEaten.length > 0
        ? weekEaten.reduce((acc, e) => { const m = entryMacros(e); return m ? addMacros(acc, m) : acc }, ZERO)
        : null

      // Next meal — first uneaten slot today after the last eaten slot, or first future meal
      const slotOrder = Object.fromEntries(MEAL_SLOTS.map((s, i) => [s, i])) as Record<MealSlot, number>
      const todaySorted = [...todayMeals].sort((a, b) => slotOrder[a.meal_slot] - slotOrder[b.meal_slot] || a.sort_order - b.sort_order)
      const lastEatenSlotIdx = todaySorted.reduce((max, e) => e.eaten_at ? Math.max(max, slotOrder[e.meal_slot]) : max, -1)
      const nextTodayEntry = todaySorted.find((e) => !e.eaten_at && slotOrder[e.meal_slot] > lastEatenSlotIdx)
        ?? todaySorted.find((e) => !e.eaten_at)

      // If nothing left today, find the earliest future meal
      const nextFutureEntry = nextTodayEntry == null
        ? [...futureMeals].sort((a, b) => a.date.localeCompare(b.date) || slotOrder[a.meal_slot] - slotOrder[b.meal_slot] || a.sort_order - b.sort_order)[0] ?? null
        : null

      const nextEntry = nextTodayEntry ?? nextFutureEntry

      const nextMeal: NextMeal | null = nextEntry
        ? {
            slot: nextEntry.meal_slot,
            recipeId: nextEntry.recipe_id,
            recipeName: nextEntry.recipe_id ? (recipeNames[nextEntry.recipe_id] ?? null) : null,
            date: nextEntry.date,
          }
        : null

      if (!cancelled) {
        setSummary({ todayMacros, weekMacros, nextMeal, loading: false })
      }
    }

    compute().catch(console.error)
    return () => { cancelled = true }
  }, [user, JSON.stringify(recipeNames)])

  return summary
}
