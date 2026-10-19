import type { TimerWithIntervals } from '@/hooks/useTimers'

export interface TimerDraft {
  name: string
  pause_between_intervals: boolean
  intervals: { name: string; duration_sec: number }[]
}

/**
 * Auto timer for a set count: one 1-minute interval per set, pausing between intervals so the
 * user starts each set themselves (the runner opens paused on the first interval).
 */
export function autoTimerDraftForSets(sets: number, intervalSec = 60): TimerDraft {
  return {
    name: `Wildman ${sets} ${sets === 1 ? 'Set' : 'Sets'}`,
    pause_between_intervals: true,
    intervals: Array.from({ length: sets }, (_, i) => ({ name: `Set ${i + 1}`, duration_sec: intervalSec })),
  }
}

/**
 * Saved timers that work the same as the draft: same number of intervals, same durations and
 * the same pause-between setting. Names (timer and interval) are ignored.
 */
export function findMatchingTimers(timers: TimerWithIntervals[], draft: TimerDraft): TimerWithIntervals[] {
  return timers.filter((t) =>
    (t.pause_between_intervals ?? false) === draft.pause_between_intervals &&
    t.intervals.length === draft.intervals.length &&
    t.intervals.every((iv, i) => iv.duration_sec === draft.intervals[i].duration_sec),
  )
}
