import { Plus, Trash2, GripVertical, Copy } from 'lucide-react'
import { emptyInterval, type IntervalDraft, type TimerEditorValue } from './timer-draft'

interface TimerEditorProps {
  value: TimerEditorValue
  onChange: (value: TimerEditorValue) => void
}

/** Timer name, interval list and pause toggle. Has no save button of its own. */
export default function TimerEditor({ value, onChange }: TimerEditorProps) {
  const { name, pauseBetween, intervals } = value

  function setIntervals(next: IntervalDraft[]) {
    onChange({ ...value, intervals: next })
  }

  function updateInterval(idx: number, field: keyof IntervalDraft, v: string | number) {
    setIntervals(intervals.map((iv, i) => (i === idx ? { ...iv, [field]: v } : iv)))
  }

  function moveInterval(idx: number, dir: -1 | 1) {
    const target = idx + dir
    if (target < 0 || target >= intervals.length) return
    const next = [...intervals]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setIntervals(next)
  }

  function duplicateInterval(idx: number) {
    const next = [...intervals]
    next.splice(idx + 1, 0, { ...intervals[idx] })
    setIntervals(next)
  }

  return (
    <>
      {/* Timer name */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-surface-500">Timer Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
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
                onClick={() => setIntervals(intervals.filter((_, i) => i !== idx))}
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
          onClick={() => setIntervals([...intervals, emptyInterval()])}
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
            onChange={(e) => onChange({ ...value, pauseBetween: e.target.checked })}
            className="h-4 w-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-surface-700">Pause between intervals</span>
        </label>
        <p className="ml-6 mt-0.5 text-xs text-surface-400">
          When enabled, the timer will pause after each interval ends. You must click resume to start the next interval.
        </p>
      </div>
    </>
  )
}
