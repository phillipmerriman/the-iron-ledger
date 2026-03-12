import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw, SkipForward, X, ChevronRight } from 'lucide-react'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import type { Exercise } from '@/types/database'
import type { TimerWithIntervals } from '@/hooks/useTimers'
import type { WeightUnit } from '@/types/common'
import { getExerciseColorClasses, formatReps, formatWeightWithConversion } from '@/types/common'
import { cn } from '@/lib/utils'

interface WorkoutRunnerModalProps {
  entries: PlannedEntry[]
  exercises: Exercise[]
  timers: TimerWithIntervals[]
  preferredUnit: WeightUnit
  onComplete: () => void
  onClose: () => void
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function WorkoutRunnerModal({
  entries,
  exercises,
  timers,
  preferredUnit,
  onComplete,
  onClose,
}: WorkoutRunnerModalProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [finished, setFinished] = useState(false)

  // Timer state (for entries with timers)
  const [timerIntervalIdx, setTimerIntervalIdx] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerWaiting, setTimerWaiting] = useState(false)
  const [timerFinished, setTimerFinished] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<AudioContext | null>(null)

  const entry = entries[currentIdx]
  const exercise = entry ? exercises.find((e) => e.id === entry.exercise_id) : undefined
  const timer = entry?.timer_id ? timers.find((t) => t.id === entry.timer_id) : undefined
  const timerIntervals = timer?.intervals ?? []
  const currentTimerInterval = timerIntervals[timerIntervalIdx]

  const playBeep = useCallback(() => {
    try {
      if (!audioRef.current) audioRef.current = new AudioContext()
      const ctx = audioRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.value = 0.3
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } catch { /* audio not available */ }
  }, [])

  // Reset timer state when exercise changes
  useEffect(() => {
    setTimerIntervalIdx(0)
    setTimerRunning(false)
    setTimerWaiting(false)
    setTimerFinished(false)
    if (timer && timer.intervals.length > 0) {
      setRemaining(timer.intervals[0].duration_sec)
    } else {
      setRemaining(0)
    }
  }, [currentIdx, timer])

  const advanceTimerInterval = useCallback(() => {
    if (timerIntervalIdx < timerIntervals.length - 1) {
      const nextIdx = timerIntervalIdx + 1
      playBeep()
      if (timer?.pause_between_intervals) {
        setTimerRunning(false)
        setTimerWaiting(true)
        setTimerIntervalIdx(nextIdx)
        setRemaining(timerIntervals[nextIdx].duration_sec)
      } else {
        setTimerIntervalIdx(nextIdx)
        setRemaining(timerIntervals[nextIdx].duration_sec)
      }
    } else {
      setTimerRunning(false)
      setTimerFinished(true)
      playBeep()
    }
  }, [timerIntervalIdx, timerIntervals, playBeep, timer])

  // Timer countdown tick
  useEffect(() => {
    if (!timerRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          advanceTimerInterval()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timerRunning, advanceTimerInterval])

  function handleNext() {
    if (currentIdx < entries.length - 1) {
      setCurrentIdx(currentIdx + 1)
    } else {
      setFinished(true)
    }
  }

  function handleTimerResume() {
    setTimerWaiting(false)
    setTimerRunning(true)
  }

  function handleTimerPlayPause() {
    if (timerFinished || timerWaiting) return
    setTimerRunning((r) => !r)
  }

  function handleTimerSkip() {
    if (timerFinished) return
    advanceTimerInterval()
  }

  function handleTimerReset() {
    setTimerRunning(false)
    setTimerFinished(false)
    setTimerWaiting(false)
    setTimerIntervalIdx(0)
    if (timerIntervals.length > 0) {
      setRemaining(timerIntervals[0].duration_sec)
    }
  }

  // Keyboard: space to continue/play/pause, escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === ' ') {
        e.preventDefault()
        if (finished) {
          onComplete()
        } else if (timer) {
          if (timerWaiting) handleTimerResume()
          else if (timerFinished) handleNext()
          else handleTimerPlayPause()
        } else {
          handleNext()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  })

  const colorClasses = exercise ? getExerciseColorClasses(exercise.color) : getExerciseColorClasses(null)
  const overallProgress = entries.length > 0 ? (currentIdx / entries.length) * 100 : 0

  // Timer progress
  const timerTotalSec = currentTimerInterval?.duration_sec ?? 1
  const timerProgress = timerTotalSec > 0 ? ((timerTotalSec - remaining) / timerTotalSec) * 100 : 100

  return (
    <div className="fixed inset-0 z-50 bg-black/60">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {finished ? (
            /* Finished state */
            <div className="py-8 text-center">
              <p className="text-4xl">&#127881;</p>
              <h2 className="mt-4 font-display text-xl font-bold text-surface-800">Workout Complete!</h2>
              <p className="mt-2 text-sm text-surface-500">{entries.length} {entries.length === 1 ? 'exercise' : 'exercises'} done</p>
              <button
                onClick={onComplete}
                className="mt-6 w-full rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Exercise counter */}
              <p className="mb-1 text-center text-xs text-surface-400">
                Exercise {currentIdx + 1} of {entries.length}
              </p>

              {/* Exercise name */}
              <h2 className="mb-4 text-center font-display text-lg font-bold text-surface-800">
                {exercise?.name ?? 'Unknown'}
              </h2>

              {/* Exercise details card */}
              <div className={cn(
                'mb-5 rounded-xl border p-4',
                exercise?.color ? `${colorClasses.bg} ${colorClasses.border}` : 'border-surface-200 bg-surface-50',
              )}>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {entry.sets != null && (
                    <div>
                      <span className="text-surface-400">Sets</span>
                      <p className="font-semibold text-surface-800">{entry.sets}</p>
                    </div>
                  )}
                  {entry.reps != null && (
                    <div>
                      <span className="text-surface-400">{entry.rep_type === 'time' ? 'Duration' : 'Reps'}</span>
                      <p className="font-semibold text-surface-800">{formatReps(entry.rep_type, entry.reps, entry.reps_right)}</p>
                    </div>
                  )}
                  {(entry.weight != null || entry.weight_unit === 'bodyweight') && (
                    <div>
                      <span className="text-surface-400">Weight</span>
                      <p className="font-semibold text-surface-800">{formatWeightWithConversion(entry.weight, entry.weight_unit, preferredUnit)}</p>
                    </div>
                  )}
                  {entry.intensity && (
                    <div>
                      <span className="text-surface-400">Intensity</span>
                      <p className={cn('font-semibold capitalize', entry.intensity === 'light' ? 'text-info-600' : 'text-danger-600')}>
                        {entry.intensity}
                      </p>
                    </div>
                  )}
                </div>
                {entry.notes && (
                  <p className="mt-2 text-xs italic text-surface-500">{entry.notes}</p>
                )}
              </div>

              {/* Timer section (if exercise has a timer) */}
              {timer ? (
                <div className="mb-5">
                  <p className="mb-1 text-center text-xs text-surface-400">{timer.name}</p>

                  {/* Current interval name */}
                  <p className="mb-2 text-center text-sm font-medium text-primary-600">
                    {timerFinished
                      ? 'Timer Complete!'
                      : timerWaiting
                        ? `Up next: ${currentTimerInterval?.name ?? 'Interval'}`
                        : currentTimerInterval?.name ?? 'Interval'}
                  </p>

                  {/* Countdown */}
                  <div className="mb-3 text-center">
                    <span className="font-mono text-5xl font-bold tabular-nums text-surface-900">
                      {timerFinished ? '00:00' : formatCountdown(remaining)}
                    </span>
                  </div>

                  {/* Timer progress bar */}
                  <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-100">
                    <div
                      className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear"
                      style={{ width: `${timerFinished ? 100 : timerProgress}%` }}
                    />
                  </div>

                  {/* Timer controls */}
                  {timerWaiting ? (
                    <div className="flex flex-col items-center gap-2">
                      <p className="text-sm font-medium text-amber-600">Ready for next interval?</p>
                      <div className="flex items-center gap-4">
                        <button onClick={handleTimerReset} className="rounded-full p-2 text-surface-400 hover:bg-surface-100" title="Reset">
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button onClick={handleTimerResume} className="rounded-full bg-primary-600 p-3 text-white shadow-lg hover:bg-primary-700">
                          <Play className="h-5 w-5" />
                        </button>
                        <button onClick={handleTimerSkip} className="rounded-full p-2 text-surface-400 hover:bg-surface-100" title="Skip">
                          <SkipForward className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : timerFinished ? (
                    <button
                      onClick={handleNext}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
                    >
                      {currentIdx < entries.length - 1 ? (
                        <>Next Exercise <ChevronRight className="h-4 w-4" /></>
                      ) : 'Finish Workout'}
                    </button>
                  ) : (
                    <div className="flex items-center justify-center gap-4">
                      <button onClick={handleTimerReset} className="rounded-full p-2 text-surface-400 hover:bg-surface-100" title="Reset">
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleTimerPlayPause}
                        className={cn(
                          'rounded-full p-3 text-white shadow-lg transition-colors',
                          timerRunning ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary-600 hover:bg-primary-700',
                        )}
                      >
                        {timerRunning ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </button>
                      <button onClick={handleTimerSkip} className="rounded-full p-2 text-surface-400 hover:bg-surface-100" title="Skip">
                        <SkipForward className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {/* Interval list */}
                  {timerIntervals.length > 1 && (
                    <div className="mt-3 max-h-24 space-y-0.5 overflow-y-auto">
                      {timerIntervals.map((iv, i) => (
                        <div
                          key={i}
                          className={cn(
                            'flex items-center justify-between rounded px-2 py-1 text-xs transition-colors',
                            i === timerIntervalIdx && !timerFinished
                              ? 'bg-primary-50 font-medium text-primary-700'
                              : i < timerIntervalIdx || timerFinished
                                ? 'text-surface-300 line-through'
                                : 'text-surface-500',
                          )}
                        >
                          <span>{iv.name}</span>
                          <span className="font-mono">{formatCountdown(iv.duration_sec)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* No timer — simple continue button */
                <button
                  onClick={handleNext}
                  className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
                >
                  {currentIdx < entries.length - 1 ? (
                    <>Next Exercise <ChevronRight className="h-4 w-4" /></>
                  ) : 'Finish Workout'}
                </button>
              )}

              {/* Overall progress */}
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-100">
                <div
                  className="h-full rounded-full bg-surface-400 transition-all duration-300"
                  style={{ width: `${finished ? 100 : overallProgress}%` }}
                />
              </div>
              <p className="mt-1 text-center text-[10px] text-surface-400">
                Overall progress
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
