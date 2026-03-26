import { useCallback, useEffect, useState } from 'react'
import { supabase, isDev } from '@/lib/supabase'
import { localDb } from '@/lib/local-storage'
import { useAuth } from '@/contexts/AuthContext'
import type { Diet } from '@/types/meal-types'
import type { InsertDto, UpdateDto } from '@/types/database'

const sortByName = (a: Diet, b: Diet) => a.name.localeCompare(b.name)

export default function useDiets() {
  const { user } = useAuth()
  const [diets, setDiets] = useState<Diet[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    if (isDev) {
      const all = localDb.getAll('diets').filter((d) => (d as unknown as Diet).user_id === user.id) as unknown as Diet[]
      setDiets(all.sort(sortByName))
    } else {
      const { data } = await supabase
        .from('diets')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
      setDiets((data ?? []) as unknown as Diet[])
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function create(values: Omit<InsertDto<'diets'>, 'user_id'>) {
    if (!user) return
    if (isDev) {
      const now = new Date().toISOString()
      const row: Diet = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: values.name,
        description: values.description ?? null,
        is_active: values.is_active ?? false,
        rating: values.rating ?? null,
        created_at: now,
        updated_at: now,
      }
      localDb.insert('diets', row as never)
      setDiets((prev) => [...prev, row].sort(sortByName))
      return row
    }
    const { data, error } = await supabase
      .from('diets')
      .insert({ ...values, user_id: user.id })
      .select()
      .single()
    if (error) throw error
    const diet = data as unknown as Diet
    setDiets((prev) => [...prev, diet].sort(sortByName))
    return diet
  }

  async function update(id: string, values: UpdateDto<'diets'>) {
    if (isDev) {
      const updated = localDb.update('diets', id, values as never)
      if (!updated) throw new Error('Diet not found')
      setDiets((prev) =>
        prev.map((d) => (d.id === id ? (updated as unknown as Diet) : d)).sort(sortByName),
      )
      return updated as unknown as Diet
    }
    const { data, error } = await supabase
      .from('diets')
      .update(values)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const diet = data as unknown as Diet
    setDiets((prev) =>
      prev.map((d) => (d.id === id ? diet : d)).sort(sortByName),
    )
    return diet
  }

  async function remove(id: string) {
    if (isDev) {
      localDb.remove('diets', id)
    } else {
      const { error } = await supabase.from('diets').delete().eq('id', id)
      if (error) throw error
    }
    setDiets((prev) => prev.filter((d) => d.id !== id))
  }

  async function setActive(id: string) {
    // Deactivate all others, activate this one
    for (const diet of diets) {
      if (diet.id === id) {
        await update(id, { is_active: true })
      } else if (diet.is_active) {
        await update(diet.id, { is_active: false })
      }
    }
  }

  return { diets, loading, refetch: fetch, create, update, remove, setActive }
}
