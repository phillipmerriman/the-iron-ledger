import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { PlannedEntry, PlannedEntryUpdate, Session } from '@/hooks/useWeeklyPlan'
import { SESSIONS, SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import type { Exercise } from '@/types/database'
import type { TimerWithIntervals } from '@/hooks/useTimers'
import type { RepType, WeightUnit } from '@/types/common'
import { REP_TYPE_OPTIONS, WEIGHT_UNIT_OPTIONS } from '@/types/common'

interface EntryDetailEditorProps {
  entry: PlannedEntry
  exerciseName?: string
  exercises?: Exercise[]
  timers?: TimerWithIntervals[]
  onUpdate: (id: string, values: PlannedEntryUpdate) => void
  onClose: () => void
}

export default function EntryDetailEditor({
  entry,
  exerciseName,
  exercises,
  timers,
  onUpdate,
  onClose,
}: EntryDetailEditorProps) {
  const [exerciseId, setExerciseId] = useState(entry.exercise_id)
  const [session, setSession] = useState<Session>(entry.session)
  const [sets, setSets] = useState(entry.sets ?? '')
  const [repType, setRepType] = useState<RepType>(entry.rep_type)
  const [reps, setReps] = useState(entry.reps ?? '')
  const [repsRight, setRepsRight] = useState(entry.reps_right ?? '')
  const [weight, setWeight] = useState(entry.weight ?? '')
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(entry.weight_unit)
  const [intensity, setIntensity] = useState<'light' | 'heavy' | null>(entry.intensity ?? null)
  const [notes, setNotes] = useState(entry.notes ?? '')
  const [timerId, setTimerId] = useState<string | null>(entry.timer_id ?? null)
  const [setMarkers, setSetMarkers] = useState(entry.set_markers ?? false)

  // Time fields (derived from reps stored as total seconds)
  const [timeMin, setTimeMin] = useState(() =>
    repType === 'time' && entry.reps != null ? Math.floor(entry.reps / 60) : 0,
  )
  const [timeSec, setTimeSec] = useState(() =>
    repType === 'time' && entry.reps != null ? entry.reps % 60 : 0,
  )

  const ref = useRef<HTMLDivElement | null>(null)
  const anchorRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const reposition = useCallback(() => {
    const anchor = anchorRef.current
    const popup = ref.current
    if (!anchor || !popup) return
    const rect = anchor.getBoundingClientRect()
    const popupH = popup.scrollHeight
    const popupW = popup.offsetWidth || 208
    const vh = window.innerHeight
    const vw = window.innerWidth
    const pad = 8

    let top = rect.bottom + 4
    let left = rect.left

    // Flip above if it would overflow below and there's more room above
    if (top + popupH > vh - pad && rect.top - popupH > pad) {
      top = rect.top - popupH - 4
    }

    // Clamp within viewport
    top = Math.max(pad, Math.min(top, vh - pad - popupH))
    left = Math.max(pad, Math.min(left, vw - pad - popupW))

    setPos({ top, left })
  }, [])

  // Reposition on mount and whenever content changes (repType toggles fields)
  useEffect(() => {
    requestAnimationFrame(() => {
      reposition()
      requestAnimationFrame(reposition)
    })
  }, [reposition, repType])

  function handleSave() {
    const resolvedReps =
      repType === 'time'
        ? (Number(timeMin) || 0) * 60 + (Number(timeSec) || 0) || null
        : reps === '' ? null : Number(reps)

    const values = {
      exercise_id: exerciseId,
      session,
      sets: sets === '' ? null : Number(sets),
      reps: resolvedReps,
      rep_type: repType,
      reps_right: repsRight === '' ? null : Number(repsRight),
      weight: weightUnit === 'bodyweight' ? null : (weight === '' ? null : Number(weight)),
      weight_unit: weightUnit,
      intensity,
      notes: notes.trim() || null,
      timer_id: timerId,
      set_markers: setMarkers,
    }
    onUpdate(entry.id, values)
    onClose()
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleSave()
      }
    }
    // Use mouseup so native <select> onChange fires before we save & close
    document.addEventListener('mouseup', handleClickOutside)
    return () => document.removeEventListener('mouseup', handleClickOutside)
  })

  const inputClass =
    'w-full rounded border border-surface-200 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

  return (
    <>
    <div ref={anchorRef} className="h-0 w-0" />
    {createPortal(
    <div
      ref={ref}
      className="fixed z-50 w-52 max-h-[calc(100vh-16px)] overflow-y-auto rounded-lg border border-surface-200 bg-white p-2 shadow-lg"
      style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="space-y-2">
        {exercises && exercises.length > 0 ? (
          <div className="border-b border-surface-100 pb-1.5">
            <label className="text-[10px] font-medium text-surface-500">Exercise</label>
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className={inputClass}
            >
              {exercises.filter((ex) => !ex.is_archived).map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
        ) : exerciseName ? (
          <p className="truncate border-b border-surface-100 pb-1.5 text-xs font-semibold text-surface-800">{exerciseName}</p>
        ) : null}
        {/* Exercise notes (from exercise definition) */}
        {exercises?.find((ex) => ex.id === exerciseId)?.notes && (
          <p className="whitespace-pre-wrap rounded bg-surface-50 px-2 py-1 text-[10px] text-surface-500">
            {exercises.find((ex) => ex.id === exerciseId)!.notes}
          </p>
        )}
        {/* Time of Day */}
        <div>
          <label className="text-[10px] font-medium text-surface-500">Time of Day</label>
          <select
            value={session}
            onChange={(e) => setSession(e.target.value as Session)}
            className={inputClass}
          >
            {SESSIONS.map((s) => (
              <option key={s} value={s}>{SESSION_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Sets */}
        <div>
          <label className="text-[10px] font-medium text-surface-500">Sets</label>
          <input
            type="number"
            min={1}
            value={sets}
            onChange={(e) => setSets(e.target.value === '' ? '' : Number(e.target.value))}
            className={inputClass}
            placeholder="3"
          />
        </div>

        {/* Set Markers */}
        <label className="flex items-center gap-2 text-[10px]">
          <input
            type="checkbox"
            checked={setMarkers}
            onChange={(e) => setSetMarkers(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-surface-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="font-medium text-surface-500">Set Markers</span>
        </label>

        {/* Rep Type */}
        <div>
          <label className="text-[10px] font-medium text-surface-500">Rep Type</label>
          <select
            value={repType}
            onChange={(e) => setRepType(e.target.value as RepType)}
            className={inputClass}
          >
            {REP_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reps — show time inputs for 'time', reps+minutes for 'reps_per_minute', number input otherwise */}
        {repType === 'time' ? (
          <div>
            <label className="text-[10px] font-medium text-surface-500">Duration</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                value={timeMin}
                onChange={(e) => setTimeMin(e.target.value === '' ? 0 : Number(e.target.value))}
                className="w-14 rounded border border-surface-200 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="0"
              />
              <span className="text-[10px] text-surface-400">min</span>
              <input
                type="number"
                min={0}
                max={59}
                value={timeSec}
                onChange={(e) => setTimeSec(e.target.value === '' ? 0 : Math.min(59, Number(e.target.value)))}
                className="w-14 rounded border border-surface-200 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="0"
              />
              <span className="text-[10px] text-surface-400">sec</span>
            </div>
          </div>
        ) : repType === 'reps_per_minute' ? (
          <>
            <div>
              <label className="text-[10px] font-medium text-surface-500">Reps / Min</label>
              <input
                type="number"
                min={1}
                value={reps}
                onChange={(e) => setReps(e.target.value === '' ? '' : Number(e.target.value))}
                className={inputClass}
                placeholder="10"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-surface-500">Minutes / Set</label>
              <input
                type="number"
                min={1}
                value={repsRight}
                onChange={(e) => setRepsRight(e.target.value === '' ? '' : Number(e.target.value))}
                className={inputClass}
                placeholder="5"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="text-[10px] font-medium text-surface-500">{repType === 'left_right' || repType === 'left_right_per_minute' ? 'Reps (Left)' : 'Reps'}</label>
            <input
              type="number"
              min={1}
              value={reps}
              onChange={(e) => setReps(e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClass}
              placeholder="10"
            />
          </div>
        )}

        {/* Reps Right — only for left_right variants */}
        {(repType === 'left_right' || repType === 'left_right_per_minute') && (
          <div>
            <label className="text-[10px] font-medium text-surface-500">Reps (Right)</label>
            <input
              type="number"
              min={1}
              value={repsRight}
              onChange={(e) => setRepsRight(e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClass}
              placeholder="Same as left"
            />
          </div>
        )}

        {/* Timer */}
        {timers && timers.length > 0 && (
          <div>
            <label className="text-[10px] font-medium text-surface-500">Timer</label>
            <select
              value={timerId ?? ''}
              onChange={(e) => setTimerId(e.target.value || null)}
              className={inputClass}
            >
              <option value="">None</option>
              {timers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Weight */}
        <div>
          <label className="text-[10px] font-medium text-surface-500">Weight</label>
          <div className="flex gap-1">
            <input
              type="number"
              min={0}
              step="any"
              value={weightUnit === 'bodyweight' ? '' : weight}
              onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={weightUnit === 'bodyweight'}
              className="min-w-0 flex-1 rounded border border-surface-200 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-surface-50 disabled:text-surface-400"
              placeholder={weightUnit === 'bodyweight' ? 'Bodyweight' : '0'}
            />
            <select
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value as WeightUnit)}
              className="w-16 rounded border border-surface-200 px-1 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {WEIGHT_UNIT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Intensity */}
        <div>
          <label className="text-[10px] font-medium text-surface-500">Intensity</label>
          <div className="flex gap-1">
            {(['light', 'heavy'] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setIntensity(intensity === opt ? null : opt)}
                className={`flex-1 rounded border px-2 py-1 text-xs font-medium capitalize transition-colors ${
                  intensity === opt
                    ? opt === 'light'
                      ? 'border-info-500 bg-info-500/10 text-info-600'
                      : 'border-danger-500 bg-danger-500/10 text-danger-600'
                    : 'border-surface-200 text-surface-400 hover:border-surface-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-[10px] font-medium text-surface-500">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-none`}
            rows={2}
            placeholder="Optional notes..."
          />
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full rounded bg-primary-600 px-2 py-1 text-xs font-medium text-white hover:bg-primary-700"
        >
          Done
        </button>
      </div>
    </div>,
    document.body,
    )}
    </>
  )
}
