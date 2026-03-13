import { Trophy } from 'lucide-react'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import { SESSIONS, SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import type { Exercise } from '@/types/database'
import type { WeightUnit } from '@/types/common'
import { getExerciseColorClasses, formatReps, formatWeightWithConversion, calcEntryVolume } from '@/types/common'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface WorkoutCompleteModalProps {
  open: boolean
  onClose: () => void
  dayLabel: string
  entries: PlannedEntry[]
  exercises: Exercise[]
  preferredUnit: WeightUnit
}

export default function WorkoutCompleteModal({
  open,
  onClose,
  dayLabel,
  entries,
  exercises,
  preferredUnit,
}: WorkoutCompleteModalProps) {
  function getExercise(id: string) {
    return exercises.find((e) => e.id === id)
  }

  const sessionGroups = SESSIONS
    .map((s) => ({ session: s, entries: entries.filter((e) => e.session === s) }))
    .filter((g) => g.entries.length > 0)

  const totalVolume = entries.reduce(
    (sum, e) => sum + calcEntryVolume(e.sets, e.reps, e.rep_type, e.reps_right, e.weight, e.weight_unit, preferredUnit),
    0,
  )

  // Derive session label from entries (e.g. "Morning Workout Complete!")
  const distinctSessions = [...new Set(entries.map((e) => e.session))]
  const sessionPrefix = distinctSessions.length === 1 && distinctSessions[0] !== 'all'
    ? `${SESSION_LABELS[distinctSessions[0]]} `
    : ''

  return (
    <Modal open={open} onClose={onClose} title="">
      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100">
          <Trophy className="h-7 w-7 text-primary-600" />
        </div>
        <h2 className="mt-3 text-xl font-bold text-surface-900">{sessionPrefix}Workout Complete!</h2>
        <p className="mt-1 text-sm text-surface-500">{dayLabel}</p>
      </div>

      {entries.length > 0 && (
        <div className="mt-5 space-y-1">
          {sessionGroups.map((group, gi) => (
            <div key={group.session}>
              {sessionGroups.length > 1 && (
                <div className={cn('flex items-center gap-2', gi > 0 ? 'my-2' : 'mb-2')}>
                  <div className="h-px flex-1 bg-surface-200" />
                  <span className="text-[10px] font-medium text-surface-400">{SESSION_LABELS[group.session]}</span>
                  <div className="h-px flex-1 bg-surface-200" />
                </div>
              )}
              {group.entries.map((entry) => {
                const ex = getExercise(entry.exercise_id)
                const color = getExerciseColorClasses(ex?.color ?? null)
                const repsDisplay = formatReps(entry.rep_type, entry.reps, entry.reps_right)
                const vol = calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit)

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border p-2.5',
                      ex?.color ? `${color.bg} ${color.border}` : 'border-surface-200 bg-surface-50',
                    )}
                  >
                    <div className="min-w-0">
                      <p className={cn('font-medium text-sm', ex?.color ? color.text : 'text-surface-800')}>
                        {ex?.name ?? 'Unknown'}
                      </p>
                      <p className="mt-0.5 text-xs text-surface-500">
                        {[
                          entry.sets != null && `${entry.sets} ${entry.sets === 1 ? 'set' : 'sets'}`,
                          repsDisplay,
                          entry.weight_unit === 'bodyweight'
                            ? 'BW'
                            : entry.weight != null
                              ? formatWeightWithConversion(entry.weight, entry.weight_unit, preferredUnit)
                              : null,
                        ].filter(Boolean).join(' × ')}
                      </p>
                    </div>
                    {vol > 0 && (
                      <span className="ml-3 shrink-0 text-xs font-semibold text-primary-600">
                        {vol.toLocaleString()} {preferredUnit}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {totalVolume > 0 && (
        <div className="mt-4 rounded-lg bg-primary-50 px-4 py-2.5 text-center">
          <span className="font-display text-sm font-bold text-primary-700">
            Total Weight Moved: {totalVolume.toLocaleString()} {preferredUnit}
          </span>
        </div>
      )}

      <Button onClick={onClose} className="mt-4 w-full">
        Done
      </Button>
    </Modal>
  )
}
