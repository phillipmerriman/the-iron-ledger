import { useCallback, useEffect, useState } from 'react'
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  eachDayOfInterval,
  format,
} from 'date-fns'
import { supabase, isDev } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { PlannedMeal, PlannedMealUpdate, MealSlot } from '@/types/meal-types'
import { MEAL_SLOTS } from '@/types/meal-types'

export { MEAL_SLOTS }
export type { MealSlot }

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

function saveAll(entries: PlannedMeal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

function asEntry(row: Record<string, unknown>): PlannedMeal {
  return row as unknown as PlannedMeal
}

function asEntries(rows: Record<string, unknown>[]): PlannedMeal[] {
  return rows.map(asEntry)
}

interface UseMealPlanOptions {
  startDate?: Date
  weekOffset?: number
  dietId?: string | null
}

export default function useMealPlan(options: UseMealPlanOptions = {}) {
  const { user } = useAuth()
  const {
    startDate = new Date(),
    weekOffset = 0,
    dietId = null,
  } = options

  const [entries, setEntries] = useState<PlannedMeal[]>([])

  const weekStart = startOfWeek(addWeeks(startDate, weekOffset), { weekStartsOn: 0 })
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
  const dateKeys = days.map((d) => format(d, 'yyyy-MM-dd'))

  const fetch = useCallback(async () => {
    if (!user) return

    if (isDev) {
      const all = loadAll().filter(
        (e) =>
          e.user_id === user.id &&
          dateKeys.includes(e.date) &&
          (dietId ? e.diet_id === dietId : e.diet_id == null),
      )
      setEntries(all)
    } else {
      let query = supabase
        .from('planned_meals')
        .select('*')
        .eq('user_id', user.id)
        .in('date', dateKeys)

      if (dietId) {
        query = query.eq('diet_id', dietId)
      } else {
        query = query.is('diet_id', null)
      }

      const { data, error } = await query.order('sort_order')
      if (error) throw error
      setEntries(asEntries(data ?? []))
    }
  }, [user, dateKeys.join(','), dietId])

  useEffect(() => { fetch() }, [fetch])

  const slotOrder: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 }

  function getEntriesForDate(dateKey: string) {
    return entries
      .filter((e) => e.date === dateKey)
      .sort((a, b) => (slotOrder[a.meal_slot] - slotOrder[b.meal_slot]) || (a.sort_order - b.sort_order))
  }

  function getEntriesForDateSlot(dateKey: string, slot: MealSlot) {
    return entries
      .filter((e) => e.date === dateKey && e.meal_slot === slot)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  async function addMeal(dateKey: string, recipeId: string | null, slot: MealSlot = 'lunch', servings = 1) {
    if (!user) return
    const slotEntries = entries.filter((e) => e.date === dateKey && e.meal_slot === slot)
    const entry: PlannedMeal = {
      id: crypto.randomUUID(),
      user_id: user.id,
      diet_id: dietId,
      recipe_id: recipeId,
      date: dateKey,
      meal_slot: slot,
      sort_order: slotEntries.length,
      servings,
      rating: null,
      notes: null,
      eaten_at: null,
      created_at: new Date().toISOString(),
    }

    if (isDev) {
      const all = loadAll()
      all.push(entry)
      saveAll(all)
    } else {
      const { error } = await supabase.from('planned_meals').insert({
        id: entry.id,
        user_id: entry.user_id,
        diet_id: entry.diet_id,
        recipe_id: entry.recipe_id,
        date: entry.date,
        meal_slot: entry.meal_slot,
        sort_order: entry.sort_order,
        servings: entry.servings,
        rating: entry.rating,
        notes: entry.notes,
      })
      if (error) throw error
    }
    setEntries((prev) => [...prev, entry])
  }

  async function updateMeal(id: string, values: PlannedMealUpdate) {
    if (isDev) {
      const all = loadAll()
      const idx = all.findIndex((e) => e.id === id)
      if (idx === -1) return
      Object.assign(all[idx], values)
      saveAll(all)
    } else {
      const { error } = await supabase.from('planned_meals').update(values).eq('id', id)
      if (error) throw error
    }
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...values } : e)),
    )
  }

  async function removeMeal(id: string) {
    if (isDev) {
      const all = loadAll().filter((e) => e.id !== id)
      saveAll(all)
    } else {
      const { error } = await supabase.from('planned_meals').delete().eq('id', id)
      if (error) throw error
    }
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function moveMeal(entryId: string, toDateKey: string, toIndex: number, toSlot?: MealSlot) {
    if (isDev) {
      const all = loadAll()
      const idx = all.findIndex((e) => e.id === entryId)
      if (idx === -1) return

      all[idx].date = toDateKey
      if (toSlot) all[idx].meal_slot = toSlot

      const targetSlot = all[idx].meal_slot
      const slotEntries = all
        .filter((e) => e.date === toDateKey && e.meal_slot === targetSlot && e.user_id === user?.id)
        .sort((a, b) => a.sort_order - b.sort_order)

      const withoutMoved = slotEntries.filter((e) => e.id !== entryId)
      withoutMoved.splice(toIndex, 0, all[idx])
      withoutMoved.forEach((e, i) => {
        const globalIdx = all.findIndex((a) => a.id === e.id)
        if (globalIdx !== -1) all[globalIdx].sort_order = i
      })

      saveAll(all)
      setEntries(
        all.filter((e) => e.user_id === user?.id && dateKeys.includes(e.date) && (dietId ? e.diet_id === dietId : true)),
      )
    } else {
      const entry = entries.find((e) => e.id === entryId)
      if (!entry) return

      const targetSlot = toSlot ?? entry.meal_slot

      await supabase.from('planned_meals').update({
        date: toDateKey,
        meal_slot: targetSlot,
      }).eq('id', entryId)

      const updatedEntry = { ...entry, date: toDateKey, meal_slot: targetSlot }
      const targetEntries = entries
        .filter((e) => e.date === toDateKey && e.meal_slot === targetSlot && e.id !== entryId)
        .sort((a, b) => a.sort_order - b.sort_order)

      targetEntries.splice(toIndex, 0, updatedEntry)

      for (let i = 0; i < targetEntries.length; i++) {
        await supabase.from('planned_meals').update({ sort_order: i }).eq('id', targetEntries[i].id)
      }

      await fetch()
    }
  }

  async function clearDate(dateKey: string) {
    if (!user) return
    if (isDev) {
      const all = loadAll().filter(
        (e) => !(e.date === dateKey && e.user_id === user.id && (dietId ? e.diet_id === dietId : true)),
      )
      saveAll(all)
    } else {
      let query = supabase.from('planned_meals').delete()
        .eq('user_id', user.id)
        .eq('date', dateKey)
      if (dietId) {
        query = query.eq('diet_id', dietId)
      }
      const { error } = await query
      if (error) throw error
    }
    setEntries((prev) => prev.filter((e) => e.date !== dateKey))
  }

  async function markEaten(id: string, eaten: boolean) {
    const eaten_at = eaten ? new Date().toISOString() : null
    if (isDev) {
      const all = loadAll()
      const idx = all.findIndex((e) => e.id === id)
      if (idx === -1) return
      all[idx].eaten_at = eaten_at
      saveAll(all)
    } else {
      const { error } = await supabase
        .from('planned_meals')
        .update({ eaten_at })
        .eq('id', id)
      if (error) throw error
    }
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, eaten_at } : e)))
  }

  async function clearSlot(dateKey: string, slot: MealSlot) {
    if (!user) return
    if (isDev) {
      const all = loadAll().filter(
        (e) => !(e.date === dateKey && e.meal_slot === slot && e.user_id === user.id && (dietId ? e.diet_id === dietId : true)),
      )
      saveAll(all)
    } else {
      let query = supabase.from('planned_meals').delete()
        .eq('user_id', user.id)
        .eq('date', dateKey)
        .eq('meal_slot', slot)
      if (dietId) {
        query = query.eq('diet_id', dietId)
      }
      const { error } = await query
      if (error) throw error
    }
    setEntries((prev) => prev.filter((e) => !(e.date === dateKey && e.meal_slot === slot)))
  }

  return {
    entries,
    days,
    dateKeys,
    weekStart,
    weekEnd,
    getEntriesForDate,
    getEntriesForDateSlot,
    addMeal,
    updateMeal,
    removeMeal,
    markEaten,
    moveMeal,
    clearDate,
    clearSlot,
    refetch: fetch,
  }
}

/** Load all meal entries for a user (for dashboard) */
export async function loadUserMealEntries(userId: string): Promise<PlannedMeal[]> {
  if (isDev) {
    return loadAll().filter((e) => e.user_id === userId)
  }

  const { data, error } = await supabase
    .from('planned_meals')
    .select('*')
    .eq('user_id', userId)
    .order('date')
    .order('sort_order')
  if (error) throw error
  return asEntries(data ?? [])
}
