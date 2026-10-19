import { useState } from 'react'
import { Plus, Trash2, Pencil, X, Clock, CirclePlay } from 'lucide-react'
import useTimers, { type TimerWithIntervals } from '@/hooks/useTimers'
import TimerRunnerModal from '@/components/timers/TimerRunnerModal'
import TimerEditor from '@/components/timers/TimerEditor'
import {
  emptyTimerValue,
  formatDuration,
  intervalsForSave,
  timerValueFrom,
  totalDuration,
  type TimerEditorValue,
} from '@/components/timers/timer-draft'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

export default function TimersPage() {
  const { timers, loading, create, update, remove } = useTimers()

  // Runner state
  const [runningTimer, setRunningTimer] = useState<TimerWithIntervals | null>(null)

  // Editor state
  const [editing, setEditing] = useState<string | null>(null) // timer id or 'new'
  const [draft, setDraft] = useState<TimerEditorValue>(emptyTimerValue)
  const [saving, setSaving] = useState(false)

  function startCreate() {
    setEditing('new')
    setDraft(emptyTimerValue())
  }

  function startEdit(timer: TimerWithIntervals) {
    setEditing(timer.id)
    setDraft(timerValueFrom(timer))
  }

  function cancelEdit() {
    setEditing(null)
  }

  async function handleSave() {
    const name = draft.name.trim()
    if (!name || draft.intervals.length === 0) return
    setSaving(true)
    try {
      const ivs = intervalsForSave(draft)
      if (ivs.length === 0) return

      if (editing === 'new') {
        await create(name, ivs, draft.pauseBetween)
      } else if (editing) {
        await update(editing, name, ivs, draft.pauseBetween)
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
        <div className="rounded-xl border border-surface-200 bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editing === 'new' ? 'New Timer' : 'Edit Timer'}
            </h2>
            <button onClick={cancelEdit} className="rounded p-1 text-surface-400 hover:text-surface-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <TimerEditor value={draft} onChange={setDraft} />

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !draft.name.trim()}>
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
            className="group rounded-xl border border-surface-200 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
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
                className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-on-primary hover:bg-primary-700"
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
