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
import type { PlannedEntry, PlannedEntryUpdate } from '@/hooks/useWeeklyPlan'
import { supabase, isDev } from '@/lib/supabase'
import useExercises from '@/hooks/useExercises'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import type { Exercise, Program, ProgramActivation, WorkoutSession, UpdateDto, InsertDto } from '@/types/database'
import { calcEntryVolume } from '@/types/common'
import { cn } from '@/lib/utils'
import DayDetailModal from './DayDetailModal'
import WorkoutCompleteModal from './WorkoutCompleteModal'

interface MonthlyCalendarProps {
  /** Shown month, when the parent controls it (e.g. to display it in a panel heading) */
  month?: Date
  onMonthChange?: (month: Date) => void
  /** Omit the title in the cells header (the surrounding panel shows it) */
  hideTitle?: boolean
  sessions: WorkoutSession[]
  activations?: ProgramActivation[]
  programs?: Program[]
  exercises?: Exercise[]
  plannedEntries?: PlannedEntry[]
  onUpdateSession?: (id: string, values: UpdateDto<'workout_sessions'>) => Promise<unknown>
  onCreateSession?: (values: Omit<InsertDto<'workout_sessions'>, 'user_id'>) => Promise<unknown>
  onDeleteSession?: (id: string) => Promise<unknown>
}

export default function MonthlyCalendar({ month, onMonthChange, hideTitle, sessions, activations = [], programs: _programs = [], exercises: exercisesProp, plannedEntries: entriesProp, onUpdateSession, onCreateSession, onDeleteSession: _onDeleteSession }: MonthlyCalendarProps) {
  const { user, profile } = useAuth()
  const { skinDef } = useTheme()
  const cells = skinDef.monthLayout === 'cells'
  const [ownMonth, setOwnMonth] = useState(new Date())
  const currentMonth = month ?? ownMonth
  function setCurrentMonth(update: (m: Date) => Date) {
    const next = update(currentMonth)
    if (onMonthChange) onMonthChange(next)
    else setOwnMonth(next)
  }
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

  async function handleRemoveEntry(id: string) {
    if (isDev) {
      const STORAGE_KEY = 'fittrack:weekly_plan'
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const all = JSON.parse(raw) as PlannedEntry[]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter((e) => e.id !== id)))
      }
    } else {
      const { error } = await supabase.from('planned_entries').delete().eq('id', id)
      if (error) throw error
    }
    setInternalEntries((prev) => prev.filter((e) => e.id !== id))
  }

  async function handleUpdateEntry(id: string, values: PlannedEntryUpdate) {
    if (isDev) {
      const STORAGE_KEY = 'fittrack:weekly_plan'
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const all = JSON.parse(raw) as PlannedEntry[]
        const idx = all.findIndex((e) => e.id === id)
        if (idx !== -1) Object.assign(all[idx], values)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
      }
    } else {
      const { error } = await supabase.from('planned_entries').update(values).eq('id', id)
      if (error) throw error
    }
    setInternalEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...values } : e)))
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
      {cells ? (
        // HUD header to match the week list: teal title left, square prev/next buttons right (left, under the panel heading, when hideTitle)
        <div className={cn('mb-4 flex items-center gap-2', hideTitle ? 'justify-start' : 'justify-between')}>
          {!hideTitle && (
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-primary-600">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
              className="flex h-6 w-10 items-center justify-center border border-border hover:bg-hover"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
              className="flex h-6 w-10 items-center justify-center border border-border hover:bg-hover"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
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
      )}

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <span key={d} className="text-[11px] font-medium text-surface-400">{d}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className={cn('grid grid-cols-7', cells ? 'gap-1' : 'gap-px')}>
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth)
          const today = isToday(day)
          const worked = hasWorkout(day)
          const completed = isCompleted(day)
          const planned = isPlanned(day)
          const isSelected = selectedDay && isSameDay(day, selectedDay)

          if (cells) {
            const inProgress = worked && !completed && today
            const partial = worked && !completed && !today
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => inMonth && setSelectedDay(day)}
                disabled={!inMonth}
                className={cn(
                  'flex min-h-[48px] flex-col items-center justify-center gap-0.5 border transition-colors',
                  !inMonth && 'border-surface-100 text-surface-300',
                  inMonth && 'cursor-pointer border-surface-200 text-surface-700 hover:border-primary-300',
                  inMonth && planned && !worked && 'border-info-500/50',
                  inMonth && partial && 'border-primary-300 bg-primary-100 text-primary-700',
                  inMonth && inProgress && 'bg-warning-500/15',
                  inMonth && today && !completed && 'border-warning-500 text-warning-500',
                  inMonth && completed && 'border-primary-500 bg-primary-500 text-on-primary hover:bg-primary-600',
                  isSelected && 'ring-2 ring-primary-500 ring-offset-1 ring-offset-card',
                )}
              >
                <span className="text-[15px] font-bold leading-none">{format(day, 'd')}</span>
                {inMonth && (
                  <span className="flex h-2.5 items-center text-[9px] font-semibold uppercase leading-none tracking-[0.14em]">
                    {completed ? (
                      <Check className="h-2.5 w-2.5" strokeWidth={3} />
                    ) : today ? (
                      'Today'
                    ) : planned || partial ? (
                      <span className={cn('h-1 w-1 rounded-full', partial ? 'bg-primary-400' : 'bg-info-500')} />
                    ) : !worked ? (
                      <span className="text-surface-400">Rest</span>
                    ) : null}
                  </span>
                )}
              </button>
            )
          }

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
      <div className={cn('mt-3 flex flex-wrap items-center gap-3 text-[11px] text-surface-400', cells && 'justify-center gap-4 text-xs')}>
        <div className="flex items-center gap-1">
          <div className={cn('h-2.5 w-2.5 bg-primary-500', !cells && 'rounded-full')} />
          Completed
        </div>
        <div className="flex items-center gap-1">
          <div className={cn('h-2.5 w-2.5', cells ? 'bg-warning-500' : 'rounded-full bg-warning-500/40')} />
          In Progress
        </div>
        {activations.length > 0 && (
          <div className="flex items-center gap-1">
            <div className={cn('h-2.5 w-2.5', cells ? 'bg-info-500' : 'rounded-full bg-primary-200')} />
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
        onRemoveEntry={handleRemoveEntry}
        onUpdateEntry={handleUpdateEntry}
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
