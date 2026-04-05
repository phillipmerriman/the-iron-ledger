import { useMemo } from 'react'
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
import useStats from '@/hooks/useStats'
import { SESSION_LABELS } from '@/hooks/useWeeklyPlan'
import type { Session } from '@/hooks/useWeeklyPlan'
import type { WorkoutSession } from '@/types/database'
import WeeklyCalendar from '@/components/dashboard/WeeklyCalendar'
import MonthlyCalendar from '@/components/dashboard/MonthlyCalendar'
import ActiveProgramCard from '@/components/dashboard/ActiveProgramCard'
import SummaryCards from '@/components/ui/SummaryCards'
import ReorderableSections, { SectionSettings } from '@/components/ui/ReorderableSections'
import type { Section } from '@/components/ui/ReorderableSections'
import VolumeComparisonChart from '@/components/charts/VolumeComparisonChart'
import CumulativeVolumeChart from '@/components/charts/CumulativeVolumeChart'
import MuscleDistributionChart from '@/components/charts/MuscleDistributionChart'
import MealWeeklyCalendar from '@/components/meals/MealWeeklyCalendar'
import useMealSummary from '@/hooks/useMealSummary'
import useRecipes from '@/hooks/useRecipes'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'

export default function DashboardPage() {
  const { sessions, loading: workoutsLoading, update: updateSession, create: createSession, remove: deleteSession } = useWorkouts()
  const { programs, activations, loading: programsLoading } = usePrograms()
  const activationIds = useMemo(() => activations.map((a) => a.id), [activations])
  const chartStats = useStats({ sessions, programs, activationIds })
  const { recipes } = useRecipes()
  const recipeNames = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r.name])), [recipes])
  const mealSummary = useMealSummary(recipeNames)

  const loading = workoutsLoading || programsLoading

  const plannedEntries = chartStats.entries

  const dashStats = useMemo(() => {
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
      todaySlots: todaySlots.map(({ session, done }) => ({
        label: session === 'all' ? 'Workout' : SESSION_LABELS[session],
        done,
      })),
    }
  }, [sessions, plannedEntries])

  const unit = chartStats.preferredUnit

  const dashSections: Section[] = [
    {
      id: 'active-programs',
      title: 'Active Programs',
      render: () => (
        <>
          {activations.length > 0 ? (
            <div className="space-y-4">
              {activations.map((act) => {
                const prog = programs.find((p) => p.id === act.program_id)
                return prog ? <ActiveProgramCard key={act.id} program={prog} activation={act} sessions={sessions} /> : null
              })}
            </div>
          ) : (
            <div className="flex items-center gap-3">
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
            </div>
          )}
        </>
      ),
    },
    {
      id: 'calendars',
      title: 'Calendars',
      render: () => (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0">
            <WeeklyCalendar sessions={sessions} activations={activations} programs={programs} exercises={chartStats.exercises} plannedEntries={plannedEntries} onUpdateSession={updateSession} onCreateSession={createSession} onDeleteSession={deleteSession} />
          </div>
          <div>
            <MonthlyCalendar sessions={sessions} activations={activations} programs={programs} exercises={chartStats.exercises} plannedEntries={plannedEntries} onUpdateSession={updateSession} onCreateSession={createSession} onDeleteSession={deleteSession} />
          </div>
        </div>
      ),
    },
    {
      id: 'meal-plan',
      title: 'Meal Plan',
      render: () => <MealWeeklyCalendar />,
    },
    {
      id: 'volume-comparison',
      title: 'Volume Comparison',
      hidden: chartStats.loading,
      render: () => (
        <VolumeComparisonChart volumeByDay={chartStats.volumeByDay} unit={unit} />
      ),
    },
    {
      id: 'cumulative-volume',
      title: 'Cumulative Volume',
      hidden: chartStats.loading,
      render: () => (
        <CumulativeVolumeChart volumeByDay={chartStats.volumeByDay} exerciseStats={chartStats.exerciseStats} unit={unit} />
      ),
    },
    {
      id: 'muscle-distribution',
      title: 'Muscle Distribution',
      hidden: chartStats.loading,
      render: () => (
        <MuscleDistributionChart
          exerciseStats={chartStats.exerciseStats}
          exercises={chartStats.exercises}
          range="allTime"
          metric="volume"
          unit={unit}
        />
      ),
    },
  ]

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
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <SectionSettings storageKey="dashboard-section-order" sections={dashSections} />
        </div>
        <Link to="/workouts/today">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Get After It
          </Button>
        </Link>
      </div>

      {/* Summary cards — shared config with Stats page */}
      <SummaryCards
        weight={{ value: chartStats.totalWeightAllTime, unit }}
        workouts={dashStats.total}
        thisWeek={dashStats.thisWeek}
        streak={dashStats.streak}
        programsCompleted={chartStats.programsCompleted}
        todaySlots={dashStats.todaySlots}
        todayMacros={mealSummary.todayMacros}
        weekMacros={mealSummary.weekMacros}
        nextMeal={mealSummary.nextMeal}
      />

      {/* Reorderable sections */}
      <ReorderableSections storageKey="dashboard-section-order" sections={dashSections} />
    </div>
  )
}
