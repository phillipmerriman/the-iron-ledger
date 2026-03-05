import { useState, useRef, useEffect } from 'react'
import type { PlannedEntry, PlannedEntryUpdate, Session } from '@/hooks/useWeeklyPlan'
import { SESSIONS, SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import type { Exercise } from '@/types/database'
import type { RepType, WeightUnit } from '@/types/common'
import { REP_TYPE_OPTIONS, WEIGHT_UNIT_OPTIONS } from '@/types/common'

interface EntryDetailEditorProps {
  entry: PlannedEntry
  exerciseName?: string
  exercises?: Exercise[]
  onUpdate: (id: string, values: PlannedEntryUpdate) => void
  onClose: () => void
}

export default function EntryDetailEditor({
  entry,
  exerciseName,
  exercises,
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

  // Time fields (derived from reps stored as total seconds)
  const [timeMin, setTimeMin] = useState(() =>
    repType === 'time' && entry.reps != null ? Math.floor(entry.reps / 60) : 0,
  )
  const [timeSec, setTimeSec] = useState(() =>
    repType === 'time' && entry.reps != null ? entry.reps % 60 : 0,
  )

  const ref = useRef<HTMLDivElement | null>(null)

  function setRef(node: HTMLDivElement | null) {
    ref.current = node
    if (node) {
      const rect = node.getBoundingClientRect()
      if (rect.bottom > window.innerHeight - 8) {
        node.style.top = 'auto'
        node.style.bottom = '100%'
        node.style.marginTop = '0'
        node.style.marginBottom = '4px'
      }
    }
  }

  function handleSave() {
    const resolvedReps =
      repType === 'time'
        ? (Number(timeMin) || 0) * 60 + (Number(timeSec) || 0) || null
        : reps === '' ? null : Number(reps)

    onUpdate(entry.id, {
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
    })
    onClose()
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        handleSave()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  })

  const inputClass =
    'w-full rounded border border-surface-200 px-2 py-1 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

  return (
    <div
      ref={setRef}
      className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-surface-200 bg-white p-2 shadow-lg"
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
            <label className="text-[10px] font-medium text-surface-500">{repType === 'left_right' ? 'Reps (Left)' : 'Reps'}</label>
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

        {/* Reps Right — only for left_right */}
        {repType === 'left_right' && (
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
    </div>
  )
}
