import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, isDev } from '@/lib/supabase'
import { localDb } from '@/lib/local-storage'
import { useAuth } from '@/contexts/AuthContext'
import type { Json, SkippedDay } from '@/types/database'
import type useProgramProgression from '@/hooks/useProgramProgression'
import type { SkipChanges } from '@/hooks/useProgramProgression'

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

  function otherSkippedDates(date: string) {
    return skippedDays.filter((d) => d.date !== date).map((d) => d.date)
  }

  async function add(date: string, activationIds: string[], reason: string | null, changes: SkipChanges | null) {
    if (!user) return
    if (isDev) {
      const row: SkippedDay = {
        id: crypto.randomUUID(),
        user_id: user.id,
        date,
        activation_ids: activationIds,
        reason,
        changes: changes as unknown as Json,
        created_at: new Date().toISOString(),
      }
      localDb.setAll('skipped_days', [...localDb.getAll('skipped_days').filter((d) => !(d.user_id === user.id && d.date === date)), row])
      setSkippedDays((prev) => [...prev.filter((d) => d.date !== date), row])
      return
    }
    const row = { user_id: user.id, date, activation_ids: activationIds, reason }
    const upsert = (values: typeof row & { changes?: Json }) => supabase
      .from('skipped_days')
      .upsert(values, { onConflict: 'user_id,date' })
      .select()
      .single()
    let { data, error } = await upsert({ ...row, changes: changes as unknown as Json })
    if (error?.message?.includes('changes')) {
      // The changes column (migration 00006) isn't there yet: save the skip without it.
      // Undo then leaves the plan as it is instead of reversing the shift.
      console.error('Saving skipped day without its changes record', error)
      ;({ data, error } = await upsert(row))
    }
    if (error || !data) throw error ?? new Error('No skipped day returned')
    const saved = data
    setSkippedDays((prev) => [...prev.filter((d) => d.date !== date), saved])
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

  /** Mark the day skipped (with an optional reason) and push back the programs that had a workout on it */
  async function skip(date: string, reason: string | null = null) {
    // Save the skip first, so a failure here leaves the schedule untouched
    await add(date, [], reason, null)
    try {
      const { activationIds, changes } = await progression.skipDay(date, otherSkippedDates(date))
      if (activationIds.length > 0) await add(date, activationIds, reason, changes)
    } catch (err) {
      await remove(date).catch((e) => console.error('Failed to roll back skipped day', e))
      throw err
    }
  }

  async function unskip(date: string) {
    const row = byDate.get(date)
    await progression.unskipDay(date, row?.activation_ids ?? [], (row?.changes as unknown as SkipChanges | null) ?? null)
    await remove(date)
  }

  return { skippedDays, byDate, skip, unskip, refetch: fetch }
}
