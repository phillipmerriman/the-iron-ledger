import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Dumbbell } from 'lucide-react'
import {
  isThisWeek,
  startOfDay,
  subDays,
  isSameDay,
  format,
} from 'date-fns'
import useWorkouts from '@/hooks/useWorkouts'
import usePrograms from '@/hooks/usePrograms'
import { useAuth } from '@/contexts/AuthContext'
import { loadUserEntries, SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import type { PlannedEntry, Session } from '@/hooks/useWeeklyPlan'
import type { WorkoutSession } from '@/types/database'
import { cn } from '@/lib/utils'
import WeeklyCalendar from '@/components/dashboard/WeeklyCalendar'
import MonthlyCalendar from '@/components/dashboard/MonthlyCalendar'
import ActiveProgramCard from '@/components/dashboard/ActiveProgramCard'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

export default function DashboardPage() {
  const { user } = useAuth()
  const { sessions, loading: workoutsLoading, update: updateSession, create: createSession, remove: deleteSession } = useWorkouts()
  const { programs, activations, loading: programsLoading } = usePrograms()

  const loading = workoutsLoading || programsLoading

  const activationIds = useMemo(() => activations.map((a) => a.id), [activations])

  // Load planned entries for slot-aware completion checks
  const [plannedEntries, setPlannedEntries] = useState<PlannedEntry[]>([])
  useEffect(() => {
    if (!user) return
    loadUserEntries(user.id, activationIds.length > 0 ? activationIds : undefined).then(setPlannedEntries)
  }, [user, activationIds])

  const stats = useMemo(() => {
    function getSessionSlot(ws: WorkoutSession): string {
      const match = ws.notes?.match(/^session:(.+)$/)
      return match ? match[1] : 'all'
    }

    function isDayFullyCompleted(day: Date): boolean {
      const daySessions = sessions.filter((s) => isSameDay(new Date(s.started_at), day))
      if (daySessions.length === 0) return false
      if (!daySessions.some((s) => s.completed_at)) return false
      const dateKey = format(day, 'yyyy-MM-dd')
      const dayPlanned = plannedEntries.filter((e) => e.date === dateKey)
      if (dayPlanned.length === 0) return daySessions.some((s) => s.completed_at)
      const plannedSlots = new Set(dayPlanned.map((e) => e.session))
      const completedSlots = new Set(daySessions.filter((s) => s.completed_at).map(getSessionSlot))
      const hasAllSlot = completedSlots.has('all')
      for (const slot of plannedSlots) {
        if (!completedSlots.has(slot) && !hasAllSlot && slot !== 'all') return false
      }
      return true
    }

    const completed = sessions.filter((s) => s.completed_at)
    const thisWeek = completed.filter((s) =>
      isThisWeek(new Date(s.started_at), { weekStartsOn: 1 }),
    )

    // Streak: consecutive days with ALL planned slots completed going backwards from today
    let streak = 0
    let day = startOfDay(new Date())
    while (true) {
      if (isDayFullyCompleted(day)) {
        streak++
        day = subDays(day, 1)
      } else {
        break
      }
    }

    // Per-slot status for today
    const todayKey = format(new Date(), 'yyyy-MM-dd')
    const todayPlanned = plannedEntries.filter((e) => e.date === todayKey)
    const todaySlots: { session: Session; done: boolean }[] = []
    const seenSlots = new Set<Session>()
    for (const entry of todayPlanned) {
      if (!seenSlots.has(entry.session)) {
        seenSlots.add(entry.session)
        const daySessions = sessions.filter((s) => isSameDay(new Date(s.started_at), new Date()))
        const done = daySessions.some((s) => {
          if (!s.completed_at) return false
          const wsSlot = getSessionSlot(s)
          return wsSlot === entry.session || wsSlot === 'all' || entry.session === 'all'
        })
        todaySlots.push({ session: entry.session, done })
      }
    }

    return {
      total: completed.length,
      thisWeek: thisWeek.length,
      streak,
      workedOutToday: isDayFullyCompleted(new Date()),
      todaySlots,
    }
  }, [sessions, plannedEntries])

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
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/workouts/today">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Get After It
          </Button>
        </Link>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-sm text-surface-500">Total Workouts</p>
          <p className="mt-1 text-3xl font-bold">{stats.total}</p>
        </Card>
        <Card>
          <p className="text-sm text-surface-500">This Week</p>
          <p className="mt-1 text-3xl font-bold">{stats.thisWeek}</p>
        </Card>
        <Card>
          <p className="text-sm text-surface-500">Current Streak</p>
          <p className="mt-1 text-3xl font-bold">
            {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-surface-500">Today</p>
          {stats.todaySlots.length > 0 ? (
            <div className="mt-1.5 space-y-1">
              {stats.todaySlots.map(({ session, done }) => (
                <div key={session} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-surface-600">
                    {session === 'all' ? 'Workout' : SESSION_LABELS[session]}
                  </span>
                  <span className={cn('text-sm font-bold', done ? 'text-primary-600' : 'text-surface-400')}>
                    {done ? 'Done' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-3xl font-bold">
              <span className="text-surface-400">Rest</span>
            </p>
          )}
        </Card>
      </div>

      {/* Active programs */}
      {activations.length > 0 ? (
        activations.map((act) => {
          const prog = programs.find((p) => p.id === act.program_id)
          return prog ? <ActiveProgramCard key={act.id} program={prog} activation={act} sessions={sessions} /> : null
        })
      ) : (
        <Card className="flex items-center gap-3">
          <div className="rounded-lg bg-surface-100 p-2">
            <Dumbbell className="h-5 w-5 text-surface-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-700">No active program</p>
            <p className="text-xs text-surface-400">
              Create a program and set it as active to track progress here.
            </p>
          </div>
          <Link to="/programs">
            <Button size="sm" variant="secondary">Programs</Button>
          </Link>
        </Card>
      )}

      {/* Calendars */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <WeeklyCalendar sessions={sessions} activations={activations} programs={programs} onUpdateSession={updateSession} onCreateSession={createSession} onDeleteSession={deleteSession} />
        </Card>
        <Card>
          <MonthlyCalendar sessions={sessions} activations={activations} programs={programs} onUpdateSession={updateSession} onCreateSession={createSession} onDeleteSession={deleteSession} />
        </Card>
      </div>
    </div>
  )
}
