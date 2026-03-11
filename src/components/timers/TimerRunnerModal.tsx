import { useState, useEffect, useRef, useCallback } from 'react'
import { Play, Pause, RotateCcw, SkipForward, X } from 'lucide-react'
import type { TimerWithIntervals } from '@/hooks/useTimers'

interface TimerRunnerModalProps {
  timer: TimerWithIntervals
  onClose: () => void
}

function formatCountdown(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TimerRunnerModal({ timer, onClose }: TimerRunnerModalProps) {
  const intervals = timer.intervals
  const [currentIdx, setCurrentIdx] = useState(0)
  const [remaining, setRemaining] = useState(intervals[0]?.duration_sec ?? 0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<AudioContext | null>(null)

  const current = intervals[currentIdx]
  const totalIntervals = intervals.length

  const playBeep = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new AudioContext()
      }
      const ctx = audioRef.current
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.value = 0.3
      osc.start()
      osc.stop(ctx.currentTime + 0.15)
    } catch {
      // audio not available
    }
  }, [])

  const advanceInterval = useCallback(() => {
    if (currentIdx < totalIntervals - 1) {
      const nextIdx = currentIdx + 1
      setCurrentIdx(nextIdx)
      setRemaining(intervals[nextIdx].duration_sec)
      playBeep()
    } else {
      // All intervals done
      setRunning(false)
      setFinished(true)
      playBeep()
    }
  }, [currentIdx, totalIntervals, intervals, playBeep])

  // Countdown tick
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          advanceInterval()
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
  }, [running, advanceInterval])

  // Escape key closes
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === ' ') {
        e.preventDefault()
        if (!finished) setRunning((r) => !r)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, finished])

  function handlePlayPause() {
    if (finished) return
    setRunning((r) => !r)
  }

  function handleReset() {
    setRunning(false)
    setFinished(false)
    setCurrentIdx(0)
    setRemaining(intervals[0]?.duration_sec ?? 0)
  }

  function handleSkip() {
    if (finished) return
    advanceInterval()
  }

  // Progress percentage for current interval
  const totalSec = current?.duration_sec ?? 1
  const progress = totalSec > 0 ? ((totalSec - remaining) / totalSec) * 100 : 100

  // Overall progress
  const completedSec = intervals
    .slice(0, currentIdx)
    .reduce((sum, iv) => sum + iv.duration_sec, 0) + (totalSec - remaining)
  const grandTotal = intervals.reduce((sum, iv) => sum + iv.duration_sec, 0)
  const overallProgress = grandTotal > 0 ? (completedSec / grandTotal) * 100 : 100

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

          {/* Timer name */}
          <h2 className="mb-1 text-center font-display text-lg font-bold text-surface-800">
            {timer.name}
          </h2>

          {/* Interval counter */}
          <p className="mb-6 text-center text-xs text-surface-400">
            Interval {currentIdx + 1} of {totalIntervals}
          </p>

          {/* Current interval name */}
          <p className="mb-2 text-center text-sm font-medium text-primary-600">
            {finished ? 'Complete!' : current?.name ?? 'Interval'}
          </p>

          {/* Countdown */}
          <div className="mb-4 text-center">
            <span className="font-mono text-6xl font-bold tabular-nums text-surface-900">
              {finished ? '00:00' : formatCountdown(remaining)}
            </span>
          </div>

          {/* Progress bar for current interval */}
          <div className="mb-6 h-2 overflow-hidden rounded-full bg-surface-100">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-1000 ease-linear"
              style={{ width: `${finished ? 100 : progress}%` }}
            />
          </div>

          {/* Controls */}
          <div className="mb-6 flex items-center justify-center gap-4">
            <button
              onClick={handleReset}
              className="rounded-full p-3 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
              title="Reset"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
            <button
              onClick={handlePlayPause}
              className={`rounded-full p-4 text-white shadow-lg transition-colors ${
                finished
                  ? 'bg-surface-300 cursor-not-allowed'
                  : running
                    ? 'bg-amber-500 hover:bg-amber-600'
                    : 'bg-primary-600 hover:bg-primary-700'
              }`}
              disabled={finished}
            >
              {running ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7" />}
            </button>
            <button
              onClick={handleSkip}
              disabled={finished}
              className="rounded-full p-3 text-surface-400 hover:bg-surface-100 hover:text-surface-600 disabled:opacity-30"
              title="Skip interval"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          </div>

          {/* Overall progress */}
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-100">
            <div
              className="h-full rounded-full bg-surface-400 transition-all duration-1000 ease-linear"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="mt-1 text-center text-[10px] text-surface-400">
            Overall progress
          </p>

          {/* Interval list */}
          <div className="mt-4 max-h-40 space-y-1 overflow-y-auto">
            {intervals.map((iv, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  i === currentIdx && !finished
                    ? 'bg-primary-50 font-medium text-primary-700'
                    : i < currentIdx || finished
                      ? 'text-surface-300 line-through'
                      : 'text-surface-500'
                }`}
              >
                <span>{iv.name}</span>
                <span className="font-mono text-xs">{formatCountdown(iv.duration_sec)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
