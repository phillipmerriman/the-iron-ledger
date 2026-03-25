import { format } from 'date-fns'
import { Check, Undo2 } from 'lucide-react'
import { SESSIONS, SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import type { Exercise, WorkoutSession } from '@/types/database'
import type { WeightUnit } from '@/types/common'
import { getExerciseColorClasses, calcEntryVolume, formatReps, formatWeightWithConversion } from '@/types/common'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

interface DayDetailModalProps {
  selectedDay: Date | null
  onClose: () => void
  daySessions: WorkoutSession[]
  dayPlanned: PlannedEntry[]
  exercises: Exercise[]
  preferredUnit: WeightUnit
  isFutureDay: boolean
  allCompleted: boolean
  isSlotCompleted: (day: Date, slot: string) => boolean
  onToggleComplete?: (session: WorkoutSession) => void
  onMarkDayComplete?: (day: Date) => void
}

export default function DayDetailModal({
  selectedDay,
  onClose,
  daySessions,
  dayPlanned,
  exercises,
  preferredUnit,
  isFutureDay,
  allCompleted,
  isSlotCompleted,
  onToggleComplete,
  onMarkDayComplete,
}: DayDetailModalProps) {
  function getExercise(exerciseId: string) {
    return exercises.find((e) => e.id === exerciseId)
  }

  function getExerciseName(exerciseId: string) {
    return exercises.find((e) => e.id === exerciseId)?.name ?? 'Unknown'
  }

  return (
    <Modal
      open={!!selectedDay}
      onClose={onClose}
      title={selectedDay ? format(selectedDay, 'EEEE, MMM d') : ''}
    >
      {daySessions.length === 0 && dayPlanned.length === 0 ? (
        <p className="py-4 text-center text-sm text-surface-400">No workouts on this day</p>
      ) : (
        <div className="space-y-4">
          {/* Workout sessions — only show completed ones */}
          {daySessions.some((s) => s.completed_at) && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-500">Completed Workouts</h4>
              {daySessions.filter((s) => s.completed_at).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border border-surface-300 bg-surface-100 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-surface-900">{session.name}</p>
                    <p className="mt-0.5 text-xs text-surface-400">
                      Started {format(new Date(session.started_at), 'h:mm a')}
                      — Completed {format(new Date(session.completed_at!), 'h:mm a')}
                    </p>
                    {session.total_weight_moved && (
                      <p className="mt-0.5 text-xs font-semibold text-primary-600">
                        {session.total_weight_moved} moved
                      </p>
                    )}
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <Badge variant="primary">Completed</Badge>
                    {onToggleComplete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onToggleComplete(session)}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Planned exercises */}
          {dayPlanned.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-500">Planned Workouts</h4>
              <div className="space-y-1">
                {(() => {
                  const sessionGroups = SESSIONS
                    .map((s) => ({ session: s, entries: dayPlanned.filter((e) => e.session === s) }))
                    .filter((g) => g.entries.length > 0)
                  return sessionGroups.map((group, gi) => (
                    <div key={group.session}>
                      {sessionGroups.length > 1 && (
                        <div className={cn('flex items-center gap-2', gi > 0 ? 'my-2' : 'mb-1')}>
                          <div className="h-px flex-1 bg-surface-200" />
                          <span className="text-[10px] font-medium text-surface-400">{SESSION_LABELS[group.session]}</span>
                          <div className="h-px flex-1 bg-surface-200" />
                        </div>
                      )}
                      {group.entries.map((entry) => {
                        const ex = getExercise(entry.exercise_id)
                        const color = getExerciseColorClasses(ex?.color ?? null)
                        const repsDisplay = formatReps(entry.rep_type, entry.reps, entry.reps_right)
                        const entrySlotDone = selectedDay ? isSlotCompleted(selectedDay, entry.session) : false
                        const vol = entrySlotDone
                          ? calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit)
                          : 0
                        return (
                          <div
                            key={entry.id}
                            className={cn(
                              'rounded-lg border p-2 text-sm',
                              ex?.color ? `${color.bg} ${color.border} force-light` : 'border-surface-200 bg-surface-50',
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              <p className={cn('font-medium', ex?.color ? color.text : 'text-surface-800')}>
                                {getExerciseName(entry.exercise_id)}
                              </p>
                              {entry.intensity && (
                                <span className={cn(
                                  'rounded-full px-1.5 py-0 text-[9px] font-semibold uppercase',
                                  entry.intensity === 'light'
                                    ? 'bg-info-500/10 text-info-600'
                                    : 'bg-danger-500/10 text-danger-600',
                                )}>
                                  {entry.intensity}
                                </span>
                              )}
                              {vol > 0 && (
                                <span className="ml-auto text-xs font-semibold text-primary-600">
                                  {vol.toLocaleString()} {preferredUnit}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-surface-500">
                              {[
                                entry.sets != null && `${entry.sets} ${entry.sets === 1 ? 'set' : 'sets'}`,
                                repsDisplay && `${repsDisplay}`,
                                entry.weight_unit === 'bodyweight'
                                  ? 'BW'
                                  : entry.weight != null
                                    ? formatWeightWithConversion(entry.weight, entry.weight_unit, preferredUnit)
                                    : null,
                              ].filter(Boolean).join(' × ')}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  ))
                })()}
              </div>
              {selectedDay && (() => {
                const dayTotal = dayPlanned.reduce((sum, entry) =>
                  isSlotCompleted(selectedDay, entry.session)
                    ? sum + calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit)
                    : sum, 0)
                return dayTotal > 0 ? (
                  <div className="mt-2 rounded-lg bg-primary-50 px-3 py-2 text-center">
                    <span className="font-display text-sm font-bold text-primary-700">
                      Total Weight Moved: {dayTotal.toLocaleString()} {preferredUnit}
                    </span>
                  </div>
                ) : null
              })()}
            </div>
          )}

          {/* Mark Day Complete button */}
          {onMarkDayComplete && selectedDay && !allCompleted && !isFutureDay && (
            <Button
              size="sm"
              onClick={() => onMarkDayComplete(selectedDay)}
              className="mt-2 w-full"
            >
              <Check className="h-3.5 w-3.5" /> Mark Day Complete
            </Button>
          )}
        </div>
      )}
    </Modal>
  )
}
