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
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { loadUserEntries } from '@/hooks/useWeeklyPlan'
import type { PlannedEntry } from '@/hooks/useWeeklyPlan'
import useExercises from '@/hooks/useExercises'
import { useAuth } from '@/contexts/AuthContext'
import type { Exercise, Program, ProgramActivation, WorkoutSession, UpdateDto, InsertDto } from '@/types/database'
import { calcEntryVolume } from '@/types/common'
import { cn } from '@/lib/utils'
import DayDetailModal from './DayDetailModal'
import WorkoutCompleteModal from './WorkoutCompleteModal'

interface MonthlyCalendarProps {
  sessions: WorkoutSession[]
  activations?: ProgramActivation[]
  programs?: Program[]
  exercises?: Exercise[]
  plannedEntries?: PlannedEntry[]
  onUpdateSession?: (id: string, values: UpdateDto<'workout_sessions'>) => Promise<unknown>
  onCreateSession?: (values: Omit<InsertDto<'workout_sessions'>, 'user_id'>) => Promise<unknown>
  onDeleteSession?: (id: string) => Promise<unknown>
}

export default function MonthlyCalendar({ sessions, activations = [], programs: _programs = [], exercises: exercisesProp, plannedEntries: entriesProp, onUpdateSession, onCreateSession, onDeleteSession: _onDeleteSession }: MonthlyCalendarProps) {
  const { user, profile } = useAuth()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [completeModal, setCompleteModal] = useState<{ dayLabel: string; entries: PlannedEntry[] } | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const { exercises: fetchedExercises } = useExercises({ skip: !!exercisesProp })
  const exercises = exercisesProp ?? fetchedExercises
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'

  const activationIds = useMemo(() => activations.map((a) => a.id), [activations])

  // Load all planned entries (scoped to activations if any exist) — skip if provided via prop
  const [internalEntries, setInternalEntries] = useState<PlannedEntry[]>([])
  useEffect(() => {
    if (entriesProp || !user) return
    loadUserEntries(user.id, activationIds.length > 0 ? activationIds : undefined).then(setInternalEntries)
  }, [activationIds, user, !!entriesProp])
  const plannedEntries = entriesProp ?? internalEntries

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
      const totalWeight = planned.reduce((sum, entry) =>
        sum + calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit), 0)
      const dayStr = format(day, 'yyyy-MM-dd')
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

      <DayDetailModal
        selectedDay={selectedDay}
        onClose={() => setSelectedDay(null)}
        daySessions={daySessions}
        dayPlanned={dayPlanned}
        exercises={exercises}
        preferredUnit={preferredUnit}
        isFutureDay={isFutureDay}
        allCompleted={selectedDay ? allCompleted(selectedDay) : false}
        isSlotCompleted={isSlotCompleted}
        onToggleComplete={onUpdateSession ? handleToggleComplete : undefined}
        onMarkDayComplete={(onCreateSession || onUpdateSession) ? handleMarkDayComplete : undefined}
      />

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
