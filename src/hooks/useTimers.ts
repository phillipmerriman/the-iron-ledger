import { useCallback, useEffect, useState } from 'react'
import { supabase, isDev } from '@/lib/supabase'
import { localDb } from '@/lib/local-storage'
import { useAuth } from '@/contexts/AuthContext'
import type { Timer, TimerInterval } from '@/types/database'

export interface TimerWithIntervals extends Timer {
  intervals: TimerInterval[]
}

const sortByName = (a: Timer, b: Timer) => a.name.localeCompare(b.name)
const sortByOrder = (a: TimerInterval, b: TimerInterval) => a.sort_order - b.sort_order

export default function useTimers() {
  const { user } = useAuth()
  const [timers, setTimers] = useState<TimerWithIntervals[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    if (isDev) {
      const allTimers = localDb.getAll('timers').filter((t) => t.user_id === user.id)
      const allIntervals = localDb.getAll('timer_intervals')
      const merged: TimerWithIntervals[] = allTimers.sort(sortByName).map((t) => ({
        ...t,
        intervals: allIntervals.filter((i) => i.timer_id === t.id).sort(sortByOrder),
      }))
      setTimers(merged)
    } else {
      const { data: timerRows } = await supabase
        .from('timers')
        .select('*')
        .eq('user_id', user.id)
        .order('name')
      const ts = timerRows ?? []
      if (ts.length === 0) {
        setTimers([])
      } else {
        const ids = ts.map((t) => t.id)
        const { data: intervalRows } = await supabase
          .from('timer_intervals')
          .select('*')
          .in('timer_id', ids)
          .order('sort_order')
        const intervals = intervalRows ?? []
        const merged: TimerWithIntervals[] = ts.map((t) => ({
          ...t,
          intervals: intervals.filter((i) => i.timer_id === t.id),
        }))
        setTimers(merged)
      }
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function create(name: string, intervals: { name: string; duration_sec: number }[]): Promise<TimerWithIntervals> {
    if (!user) throw new Error('Not authenticated')
    const now = new Date().toISOString()

    if (isDev) {
      const timer: Timer = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name,
        created_at: now,
        updated_at: now,
      }
      localDb.insert('timers', timer)
      const ivs: TimerInterval[] = intervals.map((iv, i) => ({
        id: crypto.randomUUID(),
        timer_id: timer.id,
        name: iv.name,
        duration_sec: iv.duration_sec,
        sort_order: i,
      }))
      for (const iv of ivs) localDb.insert('timer_intervals', iv)
      const merged = { ...timer, intervals: ivs }
      setTimers((prev) => [...prev, merged].sort((a, b) => sortByName(a, b)))
      return merged
    }

    const { data: timer, error } = await supabase
      .from('timers')
      .insert({ user_id: user.id, name })
      .select()
      .single()
    if (error) throw error

    const ivRows = intervals.map((iv, i) => ({
      timer_id: timer.id,
      name: iv.name,
      duration_sec: iv.duration_sec,
      sort_order: i,
    }))
    const { data: ivs, error: ivErr } = await supabase
      .from('timer_intervals')
      .insert(ivRows)
      .select()
    if (ivErr) throw ivErr

    const merged = { ...timer, intervals: ivs ?? [] }
    setTimers((prev) => [...prev, merged].sort((a, b) => sortByName(a, b)))
    return merged
  }

  async function update(
    id: string,
    name: string,
    intervals: { name: string; duration_sec: number }[],
  ): Promise<TimerWithIntervals> {
    if (!user) throw new Error('Not authenticated')

    if (isDev) {
      const updated = localDb.update('timers', id, { name })
      if (!updated) throw new Error('Timer not found')
      // Replace all intervals
      const allIntervals = localDb.getAll('timer_intervals').filter((i) => i.timer_id !== id)
      const newIvs: TimerInterval[] = intervals.map((iv, i) => ({
        id: crypto.randomUUID(),
        timer_id: id,
        name: iv.name,
        duration_sec: iv.duration_sec,
        sort_order: i,
      }))
      localDb.setAll('timer_intervals', [...allIntervals, ...newIvs] as TimerInterval[])
      const merged = { ...(updated as Timer), intervals: newIvs }
      setTimers((prev) => prev.map((t) => (t.id === id ? merged : t)).sort((a, b) => sortByName(a, b)))
      return merged
    }

    const { data: timer, error } = await supabase
      .from('timers')
      .update({ name })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    // Delete old intervals, insert new
    await supabase.from('timer_intervals').delete().eq('timer_id', id)
    const ivRows = intervals.map((iv, i) => ({
      timer_id: id,
      name: iv.name,
      duration_sec: iv.duration_sec,
      sort_order: i,
    }))
    const { data: ivs, error: ivErr } = await supabase
      .from('timer_intervals')
      .insert(ivRows)
      .select()
    if (ivErr) throw ivErr

    const merged = { ...timer, intervals: ivs ?? [] }
    setTimers((prev) => prev.map((t) => (t.id === id ? merged : t)).sort((a, b) => sortByName(a, b)))
    return merged
  }

  async function remove(id: string) {
    if (isDev) {
      localDb.remove('timers', id)
      const allIntervals = localDb.getAll('timer_intervals').filter((i) => i.timer_id !== id)
      localDb.setAll('timer_intervals', allIntervals as TimerInterval[])
    } else {
      await supabase.from('timer_intervals').delete().eq('timer_id', id)
      const { error } = await supabase.from('timers').delete().eq('id', id)
      if (error) throw error
    }
    setTimers((prev) => prev.filter((t) => t.id !== id))
  }

  return { timers, loading, refetch: fetch, create, update, remove }
}
