import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Dumbbell } from 'lucide-react'
import {
  isThisWeek,
  isToday,
  startOfDay,
  subDays,
  isSameDay,
} from 'date-fns'
import useWorkouts from '@/hooks/useWorkouts'
import usePrograms from '@/hooks/usePrograms'
import WeeklyCalendar from '@/components/dashboard/WeeklyCalendar'
import MonthlyCalendar from '@/components/dashboard/MonthlyCalendar'
import ActiveProgramCard from '@/components/dashboard/ActiveProgramCard'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

export default function DashboardPage() {
  const { sessions, loading: workoutsLoading, update: updateSession, create: createSession, remove: deleteSession } = useWorkouts()
  const { programs, loading: programsLoading } = usePrograms()

  const loading = workoutsLoading || programsLoading

  const activeProgram = programs.find((p) => p.is_active)

  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.completed_at)
    const thisWeek = completed.filter((s) =>
      isThisWeek(new Date(s.started_at), { weekStartsOn: 1 }),
    )
    const todaySession = completed.find((s) => isToday(new Date(s.started_at)))

    // Streak: consecutive days with a completed workout going backwards from today
    let streak = 0
    let day = startOfDay(new Date())
    while (true) {
      const hasSession = completed.some((s) =>
        isSameDay(new Date(s.started_at), day),
      )
      if (hasSession) {
        streak++
        day = subDays(day, 1)
      } else {
        break
      }
    }

    return {
      total: completed.length,
      thisWeek: thisWeek.length,
      streak,
      workedOutToday: !!todaySession,
    }
  }, [sessions])

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
        <Link to="/workouts">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Start Workout
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
          <p className="mt-1 text-3xl font-bold">
            {stats.workedOutToday ? (
              <span className="text-primary-600">Done</span>
            ) : (
              <span className="text-surface-400">—</span>
            )}
          </p>
        </Card>
      </div>

      {/* Active program */}
      {activeProgram ? (
        <ActiveProgramCard program={activeProgram} sessions={sessions} />
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
          <WeeklyCalendar sessions={sessions} activeProgram={activeProgram} />
        </Card>
        <Card>
          <MonthlyCalendar sessions={sessions} activeProgram={activeProgram} onUpdateSession={updateSession} onCreateSession={createSession} onDeleteSession={deleteSession} />
        </Card>
      </div>
    </div>
  )
}
