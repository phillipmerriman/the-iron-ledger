import { useCallback, useEffect, useState } from 'react'
import { supabase, isDev } from '@/lib/supabase'
import { localDb } from '@/lib/local-storage'
import { useAuth } from '@/contexts/AuthContext'
import type { Recipe, RecipeIngredient, RecipeStep } from '@/types/meal-types'
import type { InsertDto, UpdateDto } from '@/types/database'

const sortByName = (a: Recipe, b: Recipe) => a.name.localeCompare(b.name)

export default function useRecipes() {
  const { user } = useAuth()
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    if (isDev) {
      const all = localDb.getAll('recipes').filter((r) => r.user_id === user.id) as unknown as Recipe[]
      setRecipes(all.sort(sortByName))
    } else {
      const { data } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
      setRecipes((data ?? []) as unknown as Recipe[])
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function create(values: Omit<InsertDto<'recipes'>, 'user_id'>) {
    if (!user) return
    if (isDev) {
      const now = new Date().toISOString()
      const row: Recipe = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: values.name,
        description: values.description ?? null,
        servings: values.servings ?? 1,
        rating: values.rating ?? null,
        notes: values.notes ?? null,
        created_at: now,
        updated_at: now,
      }
      localDb.insert('recipes', row as never)
      setRecipes((prev) => [...prev, row].sort(sortByName))
      return row
    }
    const { data, error } = await supabase
      .from('recipes')
      .insert({ ...values, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    const recipe = data as unknown as Recipe
    setRecipes((prev) => [...prev, recipe].sort(sortByName))
    return recipe
  }

  async function update(id: string, values: UpdateDto<'recipes'>) {
    if (isDev) {
      const updated = localDb.update('recipes', id, values as never)
      if (!updated) throw new Error('Recipe not found')
      setRecipes((prev) =>
        prev.map((r) => (r.id === id ? (updated as unknown as Recipe) : r)).sort(sortByName),
      )
      return updated as unknown as Recipe
    }
    const { data, error } = await supabase
      .from('recipes')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const recipe = data as unknown as Recipe
    setRecipes((prev) =>
      prev.map((r) => (r.id === id ? recipe : r)).sort(sortByName),
    )
    return recipe
  }

  async function remove(id: string) {
    if (isDev) {
      // Cascade delete ingredients and steps
      const ingredients = localDb.getAll('recipe_ingredients').filter((i) => (i as unknown as RecipeIngredient).recipe_id === id)
      for (const ing of ingredients) localDb.remove('recipe_ingredients', (ing as { id: string }).id)
      const steps = localDb.getAll('recipe_steps').filter((s) => (s as unknown as RecipeStep).recipe_id === id)
      for (const step of steps) localDb.remove('recipe_steps', (step as { id: string }).id)
      localDb.remove('recipes', id)
    } else {
      const { error } = await supabase.from('recipes').delete().eq('id', id)
      if (error) throw error
    }
    setRecipes((prev) => prev.filter((r) => r.id !== id))
  }

  return { recipes, loading, refetch: fetch, create, update, remove }
}

// ---- Recipe Ingredients ----

export function useRecipeIngredients(recipeId: string) {
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    if (isDev) {
      const all = localDb.getAll('recipe_ingredients')
        .filter((i) => (i as unknown as RecipeIngredient).recipe_id === recipeId) as unknown as RecipeIngredient[]
      setIngredients(all.sort((a, b) => a.sort_order - b.sort_order))
    } else {
      const { data } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('sort_order')
      setIngredients((data ?? []) as unknown as RecipeIngredient[])
    }
    setLoading(false)
  }, [recipeId])

  useEffect(() => { fetch() }, [fetch])

  async function add(values: Omit<InsertDto<'recipe_ingredients'>, 'recipe_id'>) {
    if (isDev) {
      const row: RecipeIngredient = {
        id: crypto.randomUUID(),
        recipe_id: recipeId,
        name: values.name,
        quantity: values.quantity,
        unit: values.unit,
        calories: values.calories ?? 0,
        protein_g: values.protein_g ?? 0,
        carbs_g: values.carbs_g ?? 0,
        fat_g: values.fat_g ?? 0,
        fiber_g: values.fiber_g ?? 0,
        rating: values.rating ?? null,
        sort_order: values.sort_order ?? ingredients.length,
      }
      localDb.insert('recipe_ingredients', row as never)
      setIngredients((prev) => [...prev, row].sort((a, b) => a.sort_order - b.sort_order))
      return row
    }
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .insert({ ...values, recipe_id: recipeId })
      .select()
      .single()
    if (error) throw error
    const ing = data as unknown as RecipeIngredient
    setIngredients((prev) => [...prev, ing].sort((a, b) => a.sort_order - b.sort_order))
    return ing
  }

  async function update(id: string, values: UpdateDto<'recipe_ingredients'>) {
    if (isDev) {
      const updated = localDb.update('recipe_ingredients', id, values as never)
      if (!updated) throw new Error('Ingredient not found')
      setIngredients((prev) =>
        prev.map((i) => (i.id === id ? (updated as unknown as RecipeIngredient) : i))
          .sort((a, b) => a.sort_order - b.sort_order),
      )
      return updated as unknown as RecipeIngredient
    }
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const ing = data as unknown as RecipeIngredient
    setIngredients((prev) =>
      prev.map((i) => (i.id === id ? ing : i))
        .sort((a, b) => a.sort_order - b.sort_order),
    )
    return ing
  }

  async function remove(id: string) {
    if (isDev) {
      localDb.remove('recipe_ingredients', id)
    } else {
      const { error } = await supabase.from('recipe_ingredients').delete().eq('id', id)
      if (error) throw error
    }
    setIngredients((prev) => prev.filter((i) => i.id !== id))
  }

  return { ingredients, loading, refetch: fetch, add, update, remove }
}

// ---- Recipe Steps ----

export function useRecipeSteps(recipeId: string) {
  const [steps, setSteps] = useState<RecipeStep[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    if (isDev) {
      const all = localDb.getAll('recipe_steps')
        .filter((s) => (s as unknown as RecipeStep).recipe_id === recipeId) as unknown as RecipeStep[]
      setSteps(all.sort((a, b) => a.step_number - b.step_number))
    } else {
      const { data } = await supabase
        .from('recipe_steps')
        .select('*')
        .eq('recipe_id', recipeId)
        .order('step_number')
      setSteps((data ?? []) as unknown as RecipeStep[])
    }
    setLoading(false)
  }, [recipeId])

  useEffect(() => { fetch() }, [fetch])

  async function add(values: Omit<InsertDto<'recipe_steps'>, 'recipe_id'>) {
    if (isDev) {
      const row: RecipeStep = {
        id: crypto.randomUUID(),
        recipe_id: recipeId,
        step_number: values.step_number,
        instruction: values.instruction,
      }
      localDb.insert('recipe_steps', row as never)
      setSteps((prev) => [...prev, row].sort((a, b) => a.step_number - b.step_number))
      return row
    }
    const { data, error } = await supabase
      .from('recipe_steps')
      .insert({ ...values, recipe_id: recipeId })
      .select()
      .single()
    if (error) throw error
    const step = data as unknown as RecipeStep
    setSteps((prev) => [...prev, step].sort((a, b) => a.step_number - b.step_number))
    return step
  }

  async function update(id: string, values: UpdateDto<'recipe_steps'>) {
    if (isDev) {
      const updated = localDb.update('recipe_steps', id, values as never)
      if (!updated) throw new Error('Step not found')
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? (updated as unknown as RecipeStep) : s))
          .sort((a, b) => a.step_number - b.step_number),
      )
      return updated as unknown as RecipeStep
    }
    const { data, error } = await supabase
      .from('recipe_steps')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const step = data as unknown as RecipeStep
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? step : s))
        .sort((a, b) => a.step_number - b.step_number),
    )
    return step
  }

  async function remove(id: string) {
    if (isDev) {
      localDb.remove('recipe_steps', id)
    } else {
      const { error } = await supabase.from('recipe_steps').delete().eq('id', id)
      if (error) throw error
    }
    setSteps((prev) => prev.filter((s) => s.id !== id))
  }

  return { steps, loading, refetch: fetch, add, update, remove }
}

/** Insert a single ingredient for a recipe (non-hook, for imperative use) */
export async function addRecipeIngredient(
  recipeId: string,
  values: Omit<InsertDto<'recipe_ingredients'>, 'recipe_id'>,
): Promise<void> {
  if (isDev) {
    const row: RecipeIngredient = {
      id: crypto.randomUUID(),
      recipe_id: recipeId,
      name: values.name,
      quantity: values.quantity,
      unit: values.unit,
      calories: values.calories ?? 0,
      protein_g: values.protein_g ?? 0,
      carbs_g: values.carbs_g ?? 0,
      fat_g: values.fat_g ?? 0,
      fiber_g: values.fiber_g ?? 0,
      rating: values.rating ?? null,
      sort_order: values.sort_order ?? 0,
    }
    localDb.insert('recipe_ingredients', row as never)
    return
  }
  const { error } = await supabase.from('recipe_ingredients').insert({ ...values, recipe_id: recipeId })
  if (error) throw error
}

/** Insert a single step for a recipe (non-hook, for imperative use) */
export async function addRecipeStep(
  recipeId: string,
  values: Omit<InsertDto<'recipe_steps'>, 'recipe_id'>,
): Promise<void> {
  if (isDev) {
    const row: RecipeStep = {
      id: crypto.randomUUID(),
      recipe_id: recipeId,
      step_number: values.step_number,
      instruction: values.instruction,
    }
    localDb.insert('recipe_steps', row as never)
    return
  }
  const { error } = await supabase.from('recipe_steps').insert({ ...values, recipe_id: recipeId })
  if (error) throw error
}

/** Load recipe ingredients for a single recipe (non-hook, for imperative use) */
export async function loadRecipeIngredients(recipeId: string): Promise<RecipeIngredient[]> {
  if (isDev) {
    return localDb.getAll('recipe_ingredients')
      .filter((i) => (i as unknown as RecipeIngredient).recipe_id === recipeId)
      .sort((a, b) => (a as unknown as RecipeIngredient).sort_order - (b as unknown as RecipeIngredient).sort_order) as unknown as RecipeIngredient[]
  }
  const { data, error } = await supabase
    .from('recipe_ingredients')
    .select('*')
    .eq('recipe_id', recipeId)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as unknown as RecipeIngredient[]
}
