import { useState, useMemo, useEffect } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isFuture,
  addMonths,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Check, Undo2 } from 'lucide-react'
import { loadUserEntries, SESSIONS, SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import useExercises from '@/hooks/useExercises'
import { useAuth } from '@/contexts/AuthContext'
import type { Program, ProgramActivation, WorkoutSession, UpdateDto, InsertDto } from '@/types/database'
import { getExerciseColorClasses, formatReps, formatWeightWithConversion, calcEntryVolume } from '@/types/common'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import WorkoutCompleteModal from './WorkoutCompleteModal'

interface MonthlyCalendarProps {
  sessions: WorkoutSession[]
  activations?: ProgramActivation[]
  programs?: Program[]
  onUpdateSession?: (id: string, values: UpdateDto<'workout_sessions'>) => Promise<unknown>
  onCreateSession?: (values: Omit<InsertDto<'workout_sessions'>, 'user_id'>) => Promise<unknown>
  onDeleteSession?: (id: string) => Promise<unknown>
}

export default function MonthlyCalendar({ sessions, activations = [], programs: _programs = [], onUpdateSession, onCreateSession, onDeleteSession: _onDeleteSession }: MonthlyCalendarProps) {
  const { user } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [completeModal, setCompleteModal] = useState<{ dayLabel: string; entries: PlannedEntry[] } | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const { exercises } = useExercises()
  const { profile } = useAuth()
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'

  const activationIds = useMemo(() => activations.map((a) => a.id), [activations])

  // Load all planned entries (scoped to activations if any exist)
  const [plannedEntries, setPlannedEntries] = useState<PlannedEntry[]>([])
  useEffect(() => {
    if (!user) return
    loadUserEntries(user.id, activationIds.length > 0 ? activationIds : undefined).then(setPlannedEntries)
  }, [activationIds, user])

  const plannedDates = useMemo(() => {
    return new Set(plannedEntries.map((e) => e.date))
  }, [plannedEntries])

  function getSessionSlot(ws: WorkoutSession): string {
    const match = ws.notes?.match(/^session:(.+)$/)
    return match ? match[1] : 'all'
  }

  function isSlotCompleted(day: Date, slot: string) {
    const daySessions = sessions.filter((s) => isSameDay(new Date(s.started_at), day))
    return daySessions.some((s) => {
      if (!s.completed_at) return false
      const wsSlot = getSessionSlot(s)
      return wsSlot === slot || wsSlot === 'all' || slot === 'all'
    })
  }

  function hasWorkout(day: Date) {
    return sessions.some((s) => isSameDay(new Date(s.started_at), day))
  }

  function isCompleted(day: Date) {
    const daySessions = sessions.filter((s) => isSameDay(new Date(s.started_at), day))
    if (daySessions.length === 0 || !daySessions.some((s) => s.completed_at)) return false
    // Check all planned slots are covered by completed sessions
    const planned = getPlannedForDay(day)
    if (planned.length === 0) return daySessions.some((s) => s.completed_at)
    const plannedSlots = new Set(planned.map((e) => e.session))
    const completedSlots = new Set(daySessions.filter((s) => s.completed_at).map(getSessionSlot))
    const hasAllSlot = completedSlots.has('all')
    for (const slot of plannedSlots) {
      if (!completedSlots.has(slot) && !hasAllSlot && slot !== 'all') return false
    }
    return true
  }

  function allCompleted(day: Date) {
    const daySessions = sessions.filter((s) => isSameDay(new Date(s.started_at), day))
    if (daySessions.length === 0 || !daySessions.every((s) => s.completed_at)) return false
    const planned = getPlannedForDay(day)
    if (planned.length === 0) return true
    const plannedSlots = new Set(planned.map((e) => e.session))
    const completedSlots = new Set(daySessions.filter((s) => s.completed_at).map(getSessionSlot))
    const hasAllSlot = completedSlots.has('all')
    for (const slot of plannedSlots) {
      if (!completedSlots.has(slot) && !hasAllSlot && slot !== 'all') return false
    }
    return true
  }

  function isPlanned(day: Date) {
    return plannedDates.has(format(day, 'yyyy-MM-dd'))
  }

  function getSessionsForDay(day: Date) {
    return sessions.filter((s) => isSameDay(new Date(s.started_at), day))
  }

  function getPlannedForDay(day: Date) {
    const dateKey = format(day, 'yyyy-MM-dd')
    const sessionOrder = { all: 0, morning: 1, noon: 2, night: 3 }
    return plannedEntries.filter((e) => e.date === dateKey).sort((a, b) => (sessionOrder[a.session] - sessionOrder[b.session]) || (a.sort_order - b.sort_order))
  }

  function getExerciseName(exerciseId: string) {
    return exercises.find((e) => e.id === exerciseId)?.name ?? 'Unknown'
  }

  function getExercise(exerciseId: string) {
    return exercises.find((e) => e.id === exerciseId)
  }

  async function handleToggleComplete(session: WorkoutSession) {
    if (!onUpdateSession) return
    if (session.completed_at) {
      await onUpdateSession(session.id, { completed_at: null })
    } else {
      await onUpdateSession(session.id, { completed_at: new Date().toISOString() })
      if (selectedDay) {
        const planned = getPlannedForDay(selectedDay)
        if (planned.length > 0) {
          setSelectedDay(null)
          setCompleteModal({ dayLabel: format(selectedDay, 'EEEE, MMM d'), entries: planned })
        }
      }
    }
  }

  async function handleMarkDayComplete(day: Date) {
    const planned = getPlannedForDay(day)

    // Re-complete any undone sessions first
    const undone = getSessionsForDay(day).filter((s) => !s.completed_at)
    if (undone.length > 0 && onUpdateSession) {
      for (const s of undone) {
        await onUpdateSession(s.id, { completed_at: new Date().toISOString() })
      }
    } else if (onCreateSession) {
      const names = planned.map((e) => getExerciseName(e.exercise_id))
      const sessionName = names.length > 0 ? names.join(', ') : 'Workout'
      const dayStr = format(day, 'yyyy-MM-dd')
      const totalWeight = planned.reduce((sum, entry) =>
        sum + calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit), 0)
      const now = new Date().toISOString()
      await onCreateSession({
        name: sessionName,
        started_at: now,
        completed_at: now,
        total_weight_moved: totalWeight > 0 ? `${totalWeight.toLocaleString()} ${preferredUnit}` : null,
        notes: 'session:all',
      })
    }

    setSelectedDay(null)
    setCompleteModal({ dayLabel: format(day, 'EEEE, MMM d'), entries: planned })
  }

  const daySessions = selectedDay ? getSessionsForDay(selectedDay) : []
  const dayPlanned = selectedDay ? getPlannedForDay(selectedDay) : []
  const isFutureDay = selectedDay ? isFuture(selectedDay) : false

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-surface-700">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <div className="flex gap-1">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d} className="text-[11px] font-medium text-surface-400">{d}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-px">
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth)
          const today = isToday(day)
          const worked = hasWorkout(day)
          const completed = isCompleted(day)
          const planned = isPlanned(day)
          const isSelected = selectedDay && isSameDay(day, selectedDay)

          return (
            <div
              key={day.toISOString()}
              className="flex flex-col items-center justify-center py-1"
            >
              <button
                type="button"
                onClick={() => inMonth && setSelectedDay(day)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors',
                  inMonth && 'cursor-pointer hover:bg-surface-100',
                  !inMonth && 'text-surface-300',
                  inMonth && !worked && !planned && 'text-surface-600',
                  today && 'border-2 border-primary-400 font-bold',
                  completed && 'bg-primary-500 text-on-primary hover:bg-primary-600',
                  worked && !completed && today && 'bg-warning-500/20 text-warning-600 hover:bg-warning-500/30',
                  worked && !completed && !today && inMonth && 'bg-primary-100 text-primary-700 hover:bg-primary-200',
                  planned && !worked && inMonth && 'bg-primary-100 text-primary-700 hover:bg-primary-200',
                  isSelected && 'ring-2 ring-primary-500 ring-offset-1',
                )}
                disabled={!inMonth}
              >
                {format(day, 'd')}
              </button>
              {/* Checkmark for completed, dot for planned, Rest for empty days */}
              {completed && inMonth ? (
                <Check className="mt-0.5 h-2.5 w-2.5 text-primary-500" strokeWidth={3} />
              ) : (planned || (worked && !completed && !today)) && inMonth ? (
                <div className="mt-0.5 h-1 w-1 rounded-full bg-primary-400" />
              ) : inMonth && !worked ? (
                <span className="mt-0.5 text-[8px] font-medium text-surface-400">Rest</span>
              ) : null}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-surface-400">
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-full bg-primary-500" />
          Completed
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-full bg-warning-500/40" />
          In Progress
        </div>
        {activations.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="h-2.5 w-2.5 rounded-full bg-primary-200" />
            Planned
          </div>
        )}
      </div>

      {/* Day detail popup */}
      <Modal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={selectedDay ? format(selectedDay, 'EEEE, MMM d') : ''}
      >
        {daySessions.length === 0 && dayPlanned.length === 0 ? (
          <p className="py-4 text-center text-sm text-surface-400">No workouts on this day</p>
        ) : (
          <div className="space-y-4">
            {/* Workout sessions — only show completed ones */}
            {daySessions.some((s) => s.completed_at) && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-500">Workouts</h4>
                {daySessions.filter((s) => s.completed_at).map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between rounded-lg border border-surface-200 p-3"
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
                      {onUpdateSession && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleComplete(session)}
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
                <h4 className="text-xs font-semibold uppercase tracking-wide text-surface-500">Planned</h4>
                <div className="space-y-1">
                  {(() => {
                    const sessionGroups = SESSIONS
                      .map((s) => ({ session: s, entries: dayPlanned.filter((e) => e.session === s) }))
                      .filter((g) => g.entries.length > 0)
                    return sessionGroups.map((group, gi) => (
                      <div key={group.session}>
                        {gi > 0 && (
                          <div className="my-2 flex items-center gap-2">
                            <div className="h-px flex-1 bg-surface-200" />
                            <span className="text-[10px] font-medium text-surface-400">{SESSION_LABELS[group.session]}</span>
                            <div className="h-px flex-1 bg-surface-200" />
                          </div>
                        )}
                        {sessionGroups.length > 1 && gi === 0 && (
                          <div className="mb-1 text-[10px] font-medium text-surface-400">{SESSION_LABELS[group.session]}</div>
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
            {(onCreateSession || onUpdateSession) && selectedDay && !allCompleted(selectedDay) && !isFutureDay && (
              <Button
                size="sm"
                onClick={() => handleMarkDayComplete(selectedDay)}
                className="mt-2 w-full"
              >
                <Check className="h-3.5 w-3.5" /> Mark Day Complete
              </Button>
            )}
          </div>
        )}
      </Modal>

      <WorkoutCompleteModal
        open={!!completeModal}
        onClose={() => setCompleteModal(null)}
        dayLabel={completeModal?.dayLabel ?? ''}
        entries={completeModal?.entries ?? []}
        exercises={exercises}
        preferredUnit={preferredUnit}
      />
    </div>
  )
}
