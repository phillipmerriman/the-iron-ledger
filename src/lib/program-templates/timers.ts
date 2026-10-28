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
    name: `Program ${sets} ${sets === 1 ? 'Set' : 'Sets'}`,
    pause_between_intervals: true,
    intervals: Array.from({ length: sets }, (_, i) => ({ name: `Set ${i + 1}`, duration_sec: intervalSec })),
  }
}

/**
 * Auto timer for Single / Min, where each minute is a set: one 1-minute interval per minute,
 * running straight through without pausing.
 */
export function autoTimerDraftForMinutes(minutes: number): TimerDraft {
  return {
    name: `Program ${minutes} min EMOM`,
    pause_between_intervals: false,
    intervals: Array.from({ length: minutes }, (_, i) => ({ name: `Minute ${i + 1}`, duration_sec: 60 })),
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
