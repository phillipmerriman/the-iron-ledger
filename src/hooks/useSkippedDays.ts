import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, isDev } from '@/lib/supabase'
import { localDb } from '@/lib/local-storage'
import { useAuth } from '@/contexts/AuthContext'
import type { SkippedDay } from '@/types/database'
import type useProgramProgression from '@/hooks/useProgramProgression'

type ProgramScheduler = Pick<ReturnType<typeof useProgramProgression>, 'skipDay' | 'unskipDay'>

/**
 * Days the user marked as skipped, keyed by yyyy-MM-dd.
 * Pass the page's useProgramProgression() result so skipping pushes active programs back.
 */
export default function useSkippedDays(progression: ProgramScheduler) {
  const { user } = useAuth()
  const [skippedDays, setSkippedDays] = useState<SkippedDay[]>([])

  const fetch = useCallback(async () => {
    if (!user) return
    if (isDev) {
      setSkippedDays(localDb.getAll('skipped_days').filter((d) => d.user_id === user.id))
      return
    }
    const { data, error } = await supabase.from('skipped_days').select('*').eq('user_id', user.id)
    if (error) {
      console.error('Failed to load skipped days', error)
      return
    }
    setSkippedDays(data ?? [])
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  const byDate = useMemo(() => new Map(skippedDays.map((d) => [d.date, d])), [skippedDays])

  async function add(date: string, activationIds: string[]) {
    if (!user) return
    if (isDev) {
      const row: SkippedDay = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date,
        activation_ids: activationIds,
        created_at: new Date().toISOString(),
      }
      localDb.setAll('skipped_days', [...localDb.getAll('skipped_days').filter((d) => !(d.user_id === user.id && d.date === date)), row])
      setSkippedDays((prev) => [...prev.filter((d) => d.date !== date), row])
      return
    }
    const { data, error } = await supabase
      .from('skipped_days')
      .upsert({ user_id: user.id, date, activation_ids: activationIds }, { onConflict: 'user_id,date' })
      .select()
      .single()
    if (error) throw error
    setSkippedDays((prev) => [...prev.filter((d) => d.date !== date), data])
  }

  async function remove(date: string) {
    if (!user) return
    if (isDev) {
      localDb.setAll('skipped_days', localDb.getAll('skipped_days').filter((d) => !(d.user_id === user.id && d.date === date)))
    } else {
      const { error } = await supabase.from('skipped_days').delete().eq('user_id', user.id).eq('date', date)
      if (error) throw error
    }
    setSkippedDays((prev) => prev.filter((d) => d.date !== date))
  }

  /** Mark the day skipped and push back the programs that had a workout on it */
  async function skip(date: string) {
    // Save the skip first, so a failure here leaves the schedule untouched
    await add(date, [])
    try {
      const activationIds = await progression.skipDay(date)
      if (activationIds.length > 0) await add(date, activationIds)
    } catch (err) {
      await remove(date).catch((e) => console.error('Failed to roll back skipped day', e))
      throw err
    }
  }

  async function unskip(date: string) {
    await progression.unskipDay(date, byDate.get(date)?.activation_ids ?? [])
    await remove(date)
  }

  return { skippedDays, byDate, skip, unskip, refetch: fetch }
}
