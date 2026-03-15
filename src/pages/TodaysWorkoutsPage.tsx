import { useState, useMemo } from 'react'
import { format, addDays, isToday } from 'date-fns'
import { ChevronLeft, ChevronRight, Play, Clock, CheckCircle2 } from 'lucide-react'
import useWeeklyPlan, { SESSIONS, SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import type { PlannedEntry, Session } from '@/hooks/useWeeklyPlan'
import useExercises from '@/hooks/useExercises'
import useTimers, { type TimerWithIntervals } from '@/hooks/useTimers'
import usePrograms from '@/hooks/usePrograms'
import useWorkouts from '@/hooks/useWorkouts'
import { useAuth } from '@/contexts/AuthContext'
import { getExerciseColorClasses, formatReps, formatWeightWithConversion, calcEntryVolume } from '@/types/common'
import TimerRunnerModal from '@/components/timers/TimerRunnerModal'
import WorkoutRunnerModal from '@/components/workouts/WorkoutRunnerModal'
import WorkoutCompleteModal from '@/components/dashboard/WorkoutCompleteModal'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

export default function TodaysWorkoutsPage() {
  const { profile } = useAuth()
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'
  const { exercises, loading: exercisesLoading } = useExercises()
  const { timers } = useTimers()
  const { activations } = usePrograms()
  const { sessions: workoutSessions, create: createSession } = useWorkouts()

  const [dayOffset, setDayOffset] = useState(0)
  const [runningTimer, setRunningTimer] = useState<TimerWithIntervals | null>(null)
  const [runningWorkout, setRunningWorkout] = useState<{ session: Session; entries: PlannedEntry[] } | null>(null)
  const [completeModal, setCompleteModal] = useState<{ dayLabel: string; entries: PlannedEntry[] } | null>(null)
  const [localCompleted, setLocalCompleted] = useState<Set<Session | 'all'>>(new Set())

  function navigateDay(offset: number | ((d: number) => number)) {
    setDayOffset(offset)
    setLocalCompleted(new Set())
  }

  const viewDate = useMemo(() => addDays(new Date(), dayOffset), [dayOffset])
  const dateKey = format(viewDate, 'yyyy-MM-dd')
  const today = isToday(viewDate)

  const activationIds = useMemo(() => activations.map((a) => a.id), [activations])

  const { entries } = useWeeklyPlan({
    startDate: viewDate,
    weekOffset: 0,
    programIds: activationIds.length > 0 ? activationIds : undefined,
    includeUnscoped: true,
  })

  const loading = exercisesLoading

  // Filter entries for the selected date
  const dayEntries = useMemo(() => {
    const sessionOrder = { all: 0, morning: 1, noon: 2, night: 3 }
    return entries
      .filter((e) => e.date === dateKey)
      .sort((a, b) => (sessionOrder[a.session] - sessionOrder[b.session]) || (a.sort_order - b.sort_order))
  }, [entries, dateKey])

  // Group by session
  const sessionGroups = useMemo(() => {
    const groups: { session: Session; label: string; entries: typeof dayEntries }[] = []
    for (const s of SESSIONS) {
      const sessionEntries = dayEntries.filter((e) => e.session === s)
      if (sessionEntries.length > 0) {
        groups.push({ session: s, label: SESSION_LABELS[s], entries: sessionEntries })
      }
    }
    return groups
  }, [dayEntries])

  function getExerciseName(exerciseId: string): string {
    return exercises.find((e) => e.id === exerciseId)?.name ?? 'Unknown'
  }

  function getExerciseColor(exerciseId: string): string {
    const ex = exercises.find((e) => e.id === exerciseId)
    return ex?.color ?? 'slate'
  }

  function getTimerForEntry(timerId: string | null): TimerWithIntervals | undefined {
    if (!timerId) return undefined
    return timers.find((t) => t.id === timerId)
  }

  // Derive completed sessions from persisted workout sessions
  const completedSessions = useMemo(() => {
    const done = new Set<Session | 'all'>(localCompleted)
    for (const ws of workoutSessions) {
      const wsDate = ws.started_at.slice(0, 10)
      if (wsDate !== dateKey || !ws.notes || !ws.completed_at) continue
      const match = ws.notes.match(/^session:(.+)$/)
      if (match) {
        const val = match[1]
        if (val === 'all') {
          done.add('all')
          SESSIONS.forEach((s) => done.add(s))
        } else if (SESSIONS.includes(val as Session)) {
          done.add(val as Session)
        }
      }
    }
    return done
  }, [workoutSessions, dateKey, localCompleted])

  async function handleCompleteSession(sessionEntries: PlannedEntry[], sessionTag: string) {
    const names = sessionEntries.map((e) => getExerciseName(e.exercise_id))
    const sessionName = names.length > 0 ? names.join(', ') : 'Workout'
    const totalWeight = sessionEntries.reduce((sum, entry) =>
      sum + calcEntryVolume(entry.sets, entry.reps, entry.rep_type, entry.reps_right, entry.weight, entry.weight_unit, preferredUnit), 0)
    await createSession({
      name: sessionName,
      started_at: `${dateKey}T09:00:00.000Z`,
      completed_at: `${dateKey}T10:00:00.000Z`,
      total_weight_moved: totalWeight > 0 ? `${totalWeight.toLocaleString()} ${preferredUnit}` : null,
      notes: `session:${sessionTag}`,
    })
    setCompleteModal({ dayLabel: format(viewDate, 'EEEE, MMM d'), entries: sessionEntries })
  }

  async function handleCompleteSessionGroup(session: Session, sessionEntries: PlannedEntry[]) {
    await handleCompleteSession(sessionEntries, session)
    setLocalCompleted((prev) => new Set(prev).add(session))
  }

  async function handleCompleteAll() {
    if (dayEntries.length === 0) return
    await handleCompleteSession(dayEntries, 'all')
    setLocalCompleted((prev) => new Set([...prev, 'all', ...SESSIONS]))
  }

  const dayLabel = today
    ? 'Today'
    : dayOffset === -1
      ? 'Yesterday'
      : dayOffset === 1
        ? 'Tomorrow'
        : format(viewDate, 'EEEE')

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with day navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {dayLabel}&apos;s Workouts
          </h1>
          <p className="text-sm text-surface-500">{format(viewDate, 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDay((d) => d - 1)}
            className="rounded-lg border border-surface-200 p-2 text-surface-500 hover:bg-surface-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {!today && (
            <button
              onClick={() => navigateDay(0)}
              className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-medium text-surface-600 hover:bg-surface-50"
            >
              Today
            </button>
          )}
          <button
            onClick={() => navigateDay((d) => d + 1)}
            className="rounded-lg border border-surface-200 p-2 text-surface-500 hover:bg-surface-50"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* No workouts */}
      {dayEntries.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-surface-200 py-16 text-center">
          <Clock className="mx-auto h-10 w-10 text-surface-300" />
          <p className="mt-3 text-lg font-medium text-surface-600">No workouts {dayLabel.toLowerCase()}!</p>
          <p className="mt-1 text-sm text-surface-400">
            Use the weekly planner to schedule exercises.
          </p>
        </div>
      )}

      {/* Session groups */}
      {sessionGroups.map(({ session, label, entries: sessionEntries }) => {
        const isDone = completedSessions.has(session) || completedSessions.has('all')
        return (
        <div key={session} className={cn('space-y-3', isDone && 'opacity-50')}>
          <div className="flex items-center justify-between">
            <h2 className={cn('text-sm font-semibold uppercase tracking-wide', isDone ? 'text-success-600' : 'text-surface-400')}>
              {isDone && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />}
              {label}
              {isDone && ' — Done'}
            </h2>
            {!isDone && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setRunningWorkout({ session, entries: sessionEntries })}
                >
                  <Play className="mr-1 h-3.5 w-3.5" />
                  Start Workout
                </Button>
                {sessionGroups.length > 1 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleCompleteSessionGroup(session, sessionEntries)}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Complete {label}
                  </Button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {sessionEntries.map((entry) => {
              const colorClasses = getExerciseColorClasses(getExerciseColor(entry.exercise_id))
              const timer = getTimerForEntry(entry.timer_id)
              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 rounded-xl border border-surface-200 bg-white p-4 shadow-sm"
                >
                  {/* Color dot */}
                  <div className={cn('h-3 w-3 shrink-0 rounded-full', colorClasses.dot)} />

                  {/* Exercise info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-surface-800">
                      {getExerciseName(entry.exercise_id)}
                    </p>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-surface-500">
                      {entry.sets != null && (
                        <span>{entry.sets} {entry.sets === 1 ? 'set' : 'sets'}</span>
                      )}
                      {entry.reps != null && (
                        <span>{formatReps(entry.rep_type, entry.reps, entry.reps_right)}</span>
                      )}
                      {entry.weight != null && entry.weight_unit !== 'bodyweight' && (
                        <span>{formatWeightWithConversion(entry.weight, entry.weight_unit, preferredUnit)}</span>
                      )}
                      {entry.weight_unit === 'bodyweight' && (
                        <span>Bodyweight</span>
                      )}
                      {entry.intensity && (
                        <span className={cn(
                          'font-medium capitalize',
                          entry.intensity === 'light' ? 'text-info-600' : 'text-danger-600',
                        )}>
                          {entry.intensity}
                        </span>
                      )}
                    </div>
                    {entry.notes && (
                      <p className="mt-1 text-xs italic text-surface-400">{entry.notes}</p>
                    )}
                    {timer && (
                      <p className="mt-1 text-xs text-primary-500">
                        <Clock className="mr-0.5 inline h-3 w-3" />
                        {timer.name}
                      </p>
                    )}
                  </div>

                  {/* Start timer button */}
                  {timer && (
                    <button
                      onClick={() => setRunningTimer(timer)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700"
                    >
                      <Play className="h-4 w-4" /> Start
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        )
      })}

      {/* Complete All button */}
      {dayEntries.length > 0 && (() => {
        const allDone = completedSessions.has('all') || sessionGroups.every(({ session }) => completedSessions.has(session))
        return allDone ? (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-success-50 py-3 text-sm font-medium text-success-700">
            <CheckCircle2 className="h-4 w-4" />
            All workouts complete
          </div>
        ) : (
          <Button onClick={handleCompleteAll} className="w-full">
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Complete Workout
          </Button>
        )
      })()}

      {/* Workout runner modal */}
      {runningWorkout && (
        <WorkoutRunnerModal
          entries={runningWorkout.entries}
          exercises={exercises}
          timers={timers}
          preferredUnit={preferredUnit}
          onComplete={() => {
            const { session, entries: sessionEntries } = runningWorkout
            setRunningWorkout(null)
            handleCompleteSessionGroup(session, sessionEntries)
          }}
          onClose={() => setRunningWorkout(null)}
        />
      )}

      {/* Timer runner modal */}
      {runningTimer && (
        <TimerRunnerModal
          timer={runningTimer}
          onClose={() => setRunningTimer(null)}
        />
      )}

      {/* Workout complete modal */}
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
