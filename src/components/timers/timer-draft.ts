/** Draft state and helpers for the timer editor */

export interface IntervalDraft {
  name: string
  minutes: number
  seconds: number
}

/** Editable form state for a timer — saved by the caller */
export interface TimerEditorValue {
  name: string
  pauseBetween: boolean
  intervals: IntervalDraft[]
}

export function emptyInterval(): IntervalDraft {
  return { name: '', minutes: 0, seconds: 0 }
}

export function emptyTimerValue(): TimerEditorValue {
  return { name: '', pauseBetween: false, intervals: [emptyInterval()] }
}

export function timerValueFrom(timer: {
  name: string
  pause_between_intervals?: boolean | null
  intervals: { name: string; duration_sec: number }[]
}): TimerEditorValue {
  return {
    name: timer.name,
    pauseBetween: timer.pause_between_intervals ?? false,
    intervals: timer.intervals.map((iv) => ({
      name: iv.name,
      minutes: Math.floor(iv.duration_sec / 60),
      seconds: iv.duration_sec % 60,
    })),
  }
}

/** Intervals ready for useTimers().create/update — unnamed get a default, empty ones are dropped */
export function intervalsForSave(value: TimerEditorValue): { name: string; duration_sec: number }[] {
  return value.intervals
    .map((iv) => ({
      name: iv.name.trim() || 'Interval',
      duration_sec: (iv.minutes || 0) * 60 + (iv.seconds || 0),
    }))
    .filter((iv) => iv.duration_sec > 0)
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}

export function totalDuration(intervals: { duration_sec: number }[]): number {
  return intervals.reduce((sum, iv) => sum + iv.duration_sec, 0)
}
