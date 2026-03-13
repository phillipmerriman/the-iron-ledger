import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format, isToday, isSameDay, isFuture, differenceInWeeks, parseISO, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight, Pencil, Check, Undo2 } from 'lucide-react'
import useWeeklyPlan, { SESSIONS, SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import useExercises from '@/hooks/useExercises'
import type { Program, WorkoutSession, UpdateDto, InsertDto } from '@/types/database'
import { cn } from '@/lib/utils'
import { getExerciseColorClasses, calcEntryVolume, formatReps, formatWeightWithConversion } from '@/types/common'
import { useAuth } from '@/contexts/AuthContext'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import WorkoutCompleteModal from './WorkoutCompleteModal'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'

interface WeeklyCalendarProps {
  sessions: WorkoutSession[]
  activeProgram?: Program | null
  onUpdateSession?: (id: string, values: UpdateDto<'workout_sessions'>) => Promise<unknown>
  onCreateSession?: (values: Omit<InsertDto<'workout_sessions'>, 'user_id'>) => Promise<unknown>
  onDeleteSession?: (id: string) => Promise<unknown>
}

export default function WeeklyCalendar({ sessions, activeProgram, onUpdateSession, onCreateSession, onDeleteSession: _onDeleteSession }: WeeklyCalendarProps) {
  const { profile } = useAuth()
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [completeModal, setCompleteModal] = useState<{ dayLabel: string; entries: PlannedEntry[] } | null>(null)
  const programStart = activeProgram?.start_date ? parseISO(activeProgram.start_date) : undefined

  // Figure out which week offset we're in relative to the program start
  const liveWeekOffset = useMemo(() => {
    if (!programStart) return 0
    return differenceInWeeks(
      startOfWeek(new Date(), { weekStartsOn: 0 }),
      startOfWeek(programStart, { weekStartsOn: 0 }),
    )
  }, [programStart])

  const [searchParams, setSearchParams] = useSearchParams()
  const weekDelta = Number(searchParams.get('week')) || 0
  function setWeekDelta(update: number | ((prev: number) => number)) {
    const next = typeof update === 'function' ? update(weekDelta) : update
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 0) params.delete('week')
      else params.set('week', String(next))
      return params
    }, { replace: true })
  }
  const currentWeekOffset = liveWeekOffset + weekDelta
  const isCurrentWeek = weekDelta === 0

  const { days, dateKeys, getEntriesForDate } = useWeeklyPlan({
    startDate: programStart,
    weekOffset: currentWeekOffset,
    programId: activeProgram?.id ?? null,
    includeUnscoped: true,
  })
  const { exercises } = useExercises()

  function getExercise(exerciseId: string) {
    return exercises.find((e) => e.id === exerciseId)
  }

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

  function dayStatus(day: Date) {
    const daySessions = sessions.filter((s) => isSameDay(new Date(s.started_at), day))
    if (daySessions.length === 0) return 'none'
    if (!daySessions.every((s) => s.completed_at)) {
      if (daySessions.some((s) => s.completed_at)) return 'partial'
      return isToday(day) ? 'in_progress' : 'none'
    }
    // All existing sessions are completed — but check if all planned slots are covered
    const dateKey = format(day, 'yyyy-MM-dd')
    const planned = getEntriesForDate(dateKey)
    const plannedSlots = new Set(planned.map((e) => e.session))
    const completedSlots = new Set(daySessions.filter((s) => s.completed_at).map(getSessionSlot))
    const hasAllSlot = completedSlots.has('all')
    for (const slot of plannedSlots) {
      if (!completedSlots.has(slot) && !hasAllSlot && slot !== 'all') return 'partial'
    }
    return 'completed'
  }

  function allCompleted(day: Date) {
    const daySessions = sessions.filter((s) => isSameDay(new Date(s.started_at), day))
    if (daySessions.length === 0 || !daySessions.every((s) => s.completed_at)) return false
    const dateKey = format(day, 'yyyy-MM-dd')
    const planned = getEntriesForDate(dateKey)
    const plannedSlots = new Set(planned.map((e) => e.session))
    const completedSlots = new Set(daySessions.filter((s) => s.completed_at).map(getSessionSlot))
    const hasAllSlot = completedSlots.has('all')
    for (const slot of plannedSlots) {
      if (!completedSlots.has(slot) && !hasAllSlot && slot !== 'all') return false
    }
    return true
  }

  function getSessionsForDay(day: Date) {
    return sessions.filter((s) => isSameDay(new Date(s.started_at), day))
  }

  function getExerciseName(exerciseId: string) {
    return exercises.find((e) => e.id === exerciseId)?.name ?? 'Unknown'
  }

  async function handleToggleComplete(session: WorkoutSession) {
    if (!onUpdateSession) return
    if (session.completed_at) {
      await onUpdateSession(session.id, { completed_at: null })
    } else {
      await onUpdateSession(session.id, { completed_at: new Date().toISOString() })
      if (selectedDay) {
        const dateKey = format(selectedDay, 'yyyy-MM-dd')
        const planned = getEntriesForDate(dateKey)
        if (planned.length > 0) {
          setSelectedDay(null)
          setCompleteModal({ dayLabel: format(selectedDay, 'EEEE, MMM d'), entries: planned })
        }
      }
    }
  }

  async function handleMarkDayComplete(day: Date) {
    const dateKey = format(day, 'yyyy-MM-dd')
    const planned = getEntriesForDate(dateKey)

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
      await onCreateSession({
        name: sessionName,
        started_at: `${dayStr}T09:00:00.000Z`,
        completed_at: `${dayStr}T10:00:00.000Z`,
        total_weight_moved: totalWeight > 0 ? `${totalWeight.toLocaleString()} ${preferredUnit}` : null,
        notes: 'session:all',
      })
    }

    setSelectedDay(null)
    setCompleteModal({ dayLabel: format(day, 'EEEE, MMM d'), entries: planned })
  }

  const daySessions = selectedDay ? getSessionsForDay(selectedDay) : []
  const dayPlanned = selectedDay ? getEntriesForDate(format(selectedDay, 'yyyy-MM-dd')) : []
  const isFutureDay = selectedDay ? isFuture(selectedDay) : false

  // Compute weekly total volume across completed session slots from planned entries
  const weekTotal = useMemo(() => {
    let total = 0
    days.forEach((day, i) => {
      const status = dayStatus(day)
      if (status !== 'completed' && status !== 'partial') return
      const planned = getEntriesForDate(dateKeys[i])
      for (const entry of planned) {
        if (isSlotCompleted(day, entry.session)) {
          total += calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit)
        }
      }
    })
    return total
  }, [days, dateKeys, sessions, getEntriesForDate, preferredUnit])

  const dashWeekParam = weekDelta !== 0 ? `&dashweek=${weekDelta}` : ''
  const planLink = `/plan?from=dashboard${dashWeekParam}`

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekDelta((d) => d - 1)}
            className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-semibold text-surface-700">
            {isCurrentWeek ? 'This Week' : weekDelta === -1 ? 'Last Week' : weekDelta === 1 ? 'Next Week' : `${format(days[0], 'MMM d')} – ${format(days[6], 'MMM d')}`}
            {activeProgram && currentWeekOffset >= 0 && currentWeekOffset < activeProgram.weeks && (
              <span className="ml-1.5 text-xs font-normal text-surface-400">
                — {activeProgram.name} (wk {currentWeekOffset + 1}/{activeProgram.weeks})
              </span>
            )}
          </h3>
          <button
            onClick={() => setWeekDelta((d) => d + 1)}
            className="rounded-lg p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekDelta(0)}
              className="ml-1 rounded-lg px-2 py-0.5 text-[11px] font-medium text-primary-600 hover:bg-primary-50"
            >
              Today
            </button>
          )}
        </div>
        <Link
          to={planLink}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
        >
          <Pencil className="h-3 w-3" />
          Plan
        </Link>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const dateKey = dateKeys[i]
          const today = isToday(day)
          const status = dayStatus(day)
          const planned = getEntriesForDate(dateKey)

          return (
            <div
              key={dateKey}
              onClick={() => setSelectedDay(day)}
              className={cn(
                'flex min-h-[80px] cursor-pointer flex-col rounded-lg border p-1.5 transition-colors hover:border-primary-300',
                today ? 'border-primary-300 bg-primary-50/30' : 'border-surface-200',
                status === 'completed' && 'border-primary-400 bg-primary-50/50',
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    today ? 'text-primary-600' : 'text-surface-500',
                  )}
                >
                  {format(day, 'EEE')}
                </span>
                <span
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                    today && 'bg-primary-500 text-white',
                    status === 'completed' && !today && 'bg-primary-100 text-primary-700',
                    status === 'in_progress' && !today && 'bg-warning-500/20 text-warning-600',
                    status === 'none' && !today && 'text-surface-400',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              <div className="flex flex-col gap-0.5">
                {(() => {
                  const sessionGroups = SESSIONS
                    .map((s) => ({ session: s, entries: planned.filter((e) => e.session === s) }))
                    .filter((g) => g.entries.length > 0)
                  return sessionGroups.map((group, gi) => (
                    <div key={group.session}>
                      {gi > 0 && (
                        <div className="my-0.5 flex items-center gap-1">
                          <div className="h-px flex-1 bg-surface-200" />
                          <span className="text-[7px] font-medium uppercase text-surface-300">{group.session === 'all' ? '—' : group.session === 'noon' ? '☀' : '☾'}</span>
                          <div className="h-px flex-1 bg-surface-200" />
                        </div>
                      )}
                      {group.entries.map((entry) => {
                        const ex = getExercise(entry.exercise_id)
                        const color = getExerciseColorClasses(ex?.color ?? null)
                        const slotDone = isSlotCompleted(day, entry.session)
                        const vol = slotDone
                          ? calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit)
                          : 0
                        return (
                          <div
                            key={entry.id}
                            className={cn(
                              'truncate rounded px-1 py-0.5 text-[10px] leading-tight',
                              ex?.color ? `${color.bg} ${color.text}` : 'bg-surface-100 text-surface-600',
                            )}
                            title={ex?.name ?? 'Unknown'}
                          >
                            {ex?.name ?? 'Unknown'}
                            {vol > 0 && (
                              <span className="ml-0.5 opacity-60">{vol.toLocaleString()}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))
                })()}
              </div>

              {(status === 'completed' || status === 'partial') && (() => {
                const dayTotal = planned.reduce((sum, entry) =>
                  isSlotCompleted(day, entry.session)
                    ? sum + calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit)
                    : sum, 0)
                return dayTotal > 0 ? (
                  <div className="mt-auto pt-1 text-center text-[9px] font-semibold text-primary-600">
                    {dayTotal.toLocaleString()} {preferredUnit}
                  </div>
                ) : null
              })()}

              {planned.length === 0 && (
                <div className="flex flex-1 items-center justify-center">
                  <span className="text-[10px] text-surface-300">Rest</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {weekTotal > 0 && (
        <div className="mt-2 rounded-lg bg-primary-50 px-3 py-1.5 text-center">
          <span className="font-display text-xs font-bold text-primary-700">
            Total Weight Moved: {weekTotal.toLocaleString()} {preferredUnit}
          </span>
        </div>
      )}

      {/* Day detail modal */}
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
                          const entrySlotDone = selectedDay ? isSlotCompleted(selectedDay, entry.session) : false
                          const vol = entrySlotDone
                            ? calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit)
                            : 0
                          return (
                            <div
                              key={entry.id}
                              className={cn(
                                'rounded-lg border p-2 text-sm',
                                ex?.color ? `${color.bg} ${color.border}` : 'border-surface-200 bg-surface-50',
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
