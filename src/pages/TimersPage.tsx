import { useState } from 'react'
import { Plus, Trash2, GripVertical, Pencil, X, Clock, Copy, CirclePlay } from 'lucide-react'
import useTimers, { type TimerWithIntervals } from '@/hooks/useTimers'
import TimerRunnerModal from '@/components/timers/TimerRunnerModal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

interface IntervalDraft {
  name: string
  minutes: number
  seconds: number
}

function emptyInterval(): IntervalDraft {
  return { name: '', minutes: 0, seconds: 0 }
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s}s`
  if (s === 0) return `${m}m`
  return `${m}m ${s}s`
}

function totalDuration(intervals: { duration_sec: number }[]): number {
  return intervals.reduce((sum, iv) => sum + iv.duration_sec, 0)
}

export default function TimersPage() {
  const { timers, loading, create, update, remove } = useTimers()

  // Runner state
  const [runningTimer, setRunningTimer] = useState<TimerWithIntervals | null>(null)

  // Editor state
  const [editing, setEditing] = useState<string | null>(null) // timer id or 'new'
  const [name, setName] = useState('')
  const [pauseBetween, setPauseBetween] = useState(false)
  const [intervals, setIntervals] = useState<IntervalDraft[]>([emptyInterval()])
  const [saving, setSaving] = useState(false)

  function startCreate() {
    setEditing('new')
    setName('')
    setPauseBetween(false)
    setIntervals([emptyInterval()])
  }

  function startEdit(timer: TimerWithIntervals) {
    setEditing(timer.id)
    setName(timer.name)
    setPauseBetween(timer.pause_between_intervals ?? false)
    setIntervals(
      timer.intervals.map((iv) => ({
        name: iv.name,
        minutes: Math.floor(iv.duration_sec / 60),
        seconds: iv.duration_sec % 60,
      })),
    )
  }

  function cancelEdit() {
    setEditing(null)
  }

  function addInterval() {
    setIntervals((prev) => [...prev, emptyInterval()])
  }

  function removeInterval(idx: number) {
    setIntervals((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateInterval(idx: number, field: keyof IntervalDraft, value: string | number) {
    setIntervals((prev) =>
      prev.map((iv, i) => (i === idx ? { ...iv, [field]: value } : iv)),
    )
  }

  function moveInterval(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= intervals.length) return
    setIntervals((prev) => {
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function duplicateInterval(idx: number) {
    setIntervals((prev) => {
      const clone = { ...prev[idx] }
      const next = [...prev]
      next.splice(idx + 1, 0, clone)
      return next
    })
  }

  async function handleSave() {
    if (!name.trim() || intervals.length === 0) return
    setSaving(true)
    try {
      const ivs = intervals.map((iv) => ({
        name: iv.name.trim() || 'Interval',
        duration_sec: (iv.minutes || 0) * 60 + (iv.seconds || 0),
      })).filter((iv) => iv.duration_sec > 0)

      if (ivs.length === 0) return

      if (editing === 'new') {
        await create(name.trim(), ivs, pauseBetween)
      } else if (editing) {
        await update(editing, name.trim(), ivs, pauseBetween)
      }
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this timer?')) return
    await remove(id)
    if (editing === id) setEditing(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timers</h1>
          <p className="text-sm text-surface-500">Create interval timers for your workouts.</p>
        </div>
        <Button onClick={startCreate} disabled={editing !== null}>
          <Plus className="mr-1 h-4 w-4" /> New Timer
        </Button>
      </div>

      {/* Editor */}
      {editing !== null && (
        <div className="rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editing === 'new' ? 'New Timer' : 'Edit Timer'}
            </h2>
            <button onClick={cancelEdit} className="rounded p-1 text-surface-400 hover:text-surface-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Timer name */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-surface-500">Timer Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full max-w-sm rounded border border-surface-200 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              placeholder="e.g. EMOM 10min, Tabata, Rest Intervals"
            />
          </div>

          {/* Intervals */}
          <div className="mb-4">
            <label className="mb-2 block text-xs font-medium text-surface-500">Intervals</label>
            <div className="space-y-2">
              {intervals.map((iv, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-lg border border-surface-100 bg-surface-50 p-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveInterval(idx, -1)}
                      disabled={idx === 0}
                      className="text-surface-300 hover:text-surface-500 disabled:opacity-30"
                    >
                      <GripVertical className="h-3 w-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={iv.name}
                    onChange={(e) => updateInterval(idx, 'name', e.target.value)}
                    className="min-w-0 flex-1 rounded border border-surface-200 px-2 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    placeholder="Interval name (e.g. Work, Rest)"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      value={iv.minutes}
                      onChange={(e) => updateInterval(idx, 'minutes', Number(e.target.value))}
                      className="w-14 rounded border border-surface-200 px-2 py-1.5 text-center text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <span className="text-xs text-surface-400">min</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={iv.seconds}
                      onChange={(e) => updateInterval(idx, 'seconds', Math.min(59, Number(e.target.value)))}
                      className="w-14 rounded border border-surface-200 px-2 py-1.5 text-center text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <span className="text-xs text-surface-400">sec</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => duplicateInterval(idx)}
                    className="rounded p-1 text-surface-300 hover:text-primary-500"
                    title="Duplicate interval"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeInterval(idx)}
                    disabled={intervals.length <= 1}
                    className="rounded p-1 text-surface-300 hover:text-danger-500 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addInterval}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-surface-300 px-3 py-1.5 text-xs font-medium text-surface-500 hover:border-primary-400 hover:text-primary-600"
            >
              <Plus className="h-3 w-3" /> Add Interval
            </button>
          </div>

          {/* Pause between intervals toggle */}
          <div className="mb-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={pauseBetween}
                onChange={(e) => setPauseBetween(e.target.checked)}
                className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-surface-700">Pause between intervals</span>
            </label>
            <p className="ml-6 mt-0.5 text-xs text-surface-400">
              When enabled, the timer will pause after each interval ends. You must click resume to start the next interval.
            </p>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? 'Saving...' : 'Save Timer'}
            </Button>
            <button onClick={cancelEdit} className="text-sm text-surface-500 hover:text-surface-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Timer list */}
      {timers.length === 0 && editing === null && (
        <div className="rounded-xl border-2 border-dashed border-surface-200 py-12 text-center">
          <Clock className="mx-auto h-10 w-10 text-surface-300" />
          <p className="mt-2 text-sm text-surface-500">No timers yet. Create your first one!</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {timers.map((timer) => (
          <div
            key={timer.id}
            className="group rounded-xl border border-surface-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="mb-2 flex items-start justify-between">
              <h3 className="font-display font-semibold text-surface-800">{timer.name}</h3>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => startEdit(timer)}
                  disabled={editing !== null}
                  className="rounded p-1 text-surface-400 hover:text-primary-600 disabled:opacity-30"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(timer.id)}
                  className="rounded p-1 text-surface-400 hover:text-danger-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {timer.intervals.map((iv, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-surface-600">{iv.name}</span>
                  <span className="font-mono text-xs text-surface-400">{formatDuration(iv.duration_sec)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-surface-100 pt-2">
              <span className="text-xs text-surface-400">
                {timer.intervals.length} interval{timer.intervals.length !== 1 ? 's' : ''} &middot; {formatDuration(totalDuration(timer.intervals))} total
                {timer.pause_between_intervals && ' \u00b7 Pause'}
              </span>
              <button
                onClick={() => setRunningTimer(timer)}
                className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
              >
                <CirclePlay className="h-3 w-3" /> Start
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Timer runner modal */}
      {runningTimer && (
        <TimerRunnerModal
          timer={runningTimer}
          onClose={() => setRunningTimer(null)}
        />
      )}
    </div>
  )
}
