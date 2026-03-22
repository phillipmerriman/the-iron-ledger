import { useState } from 'react'
import { Flame, Dumbbell, Weight, Trophy } from 'lucide-react'
import useStats from '@/hooks/useStats'
import type { ExerciseStats } from '@/hooks/useStats'
import { getExerciseColorClasses } from '@/types/common'
import Card from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import ReorderableSections from '@/components/ui/ReorderableSections'
import type { Section } from '@/components/ui/ReorderableSections'
import MuscleDistributionChart from '@/components/charts/MuscleDistributionChart'
import VolumeComparisonChart from '@/components/charts/VolumeComparisonChart'
import CumulativeVolumeChart from '@/components/charts/CumulativeVolumeChart'
import { cn } from '@/lib/utils'

type TimeRange = 'week' | 'month' | 'year' | 'allTime'
const TIME_LABELS: Record<TimeRange, string> = { week: 'This Week', month: 'This Month', year: 'This Year', allTime: 'All Time' }

function getVolume(stats: ReturnType<typeof useStats>, range: TimeRange): number {
  switch (range) {
    case 'week': return stats.totalWeightThisWeek
    case 'month': return stats.totalWeightThisMonth
    case 'year': return stats.totalWeightThisYear
    case 'allTime': return stats.totalWeightAllTime
  }
}

function getWorkouts(stats: ReturnType<typeof useStats>, range: TimeRange): number {
  switch (range) {
    case 'week': return stats.workoutsThisWeek
    case 'month': return stats.workoutsThisMonth
    case 'year': return stats.workoutsThisYear
    case 'allTime': return stats.workoutsAllTime
  }
}

function getReps(ex: ExerciseStats, range: TimeRange): number {
  return ex.reps[range]
}

function getTut(ex: ExerciseStats, range: TimeRange): number {
  return ex.tut[range]
}

function getExVolume(ex: ExerciseStats, range: TimeRange): number {
  return ex.volume[range]
}

function formatTut(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

export default function StatsPage() {
  const stats = useStats()
  const [range, setRange] = useState<TimeRange>('allTime')
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)

  if (stats.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  const volume = getVolume(stats, range)
  const workouts = getWorkouts(stats, range)
  const unit = stats.preferredUnit

  const chartSections: Section[] = [
    {
      id: 'volume-comparison',
      title: 'Volume Comparison',
      render: () => (
        <VolumeComparisonChart volumeByDay={stats.volumeByDay} unit={unit} />
      ),
    },
    {
      id: 'cumulative-volume',
      title: 'Cumulative Volume',
      render: () => (
        <CumulativeVolumeChart volumeByDay={stats.volumeByDay} exerciseStats={stats.exerciseStats} unit={unit} />
      ),
    },
    {
      id: 'muscle-distribution',
      title: `Muscle Distribution — ${TIME_LABELS[range]}`,
      render: () => (
        <MuscleDistributionChart
          exerciseStats={stats.exerciseStats}
          exercises={stats.exercises}
          range={range}
          metric="volume"
          unit={unit}
        />
      ),
    },
    {
      id: 'volume-by-year',
      title: 'Volume by Year',
      hidden: Object.keys(stats.totalWeightByYear).length <= 1,
      render: () => (
        <div className="space-y-2">
          {Object.entries(stats.totalWeightByYear)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([year, vol]) => {
              const maxVol = Math.max(...Object.values(stats.totalWeightByYear))
              const pct = maxVol > 0 ? (vol / maxVol) * 100 : 0
              return (
                <div key={year}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-surface-700">{year}</span>
                    <span className="text-surface-500">{vol.toLocaleString()} {unit}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-surface-100">
                    <div className="h-2 rounded-full bg-primary-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
        </div>
      ),
    },
    {
      id: 'per-exercise',
      title: `Per Exercise — ${TIME_LABELS[range]}`,
      render: () => (
        <>
          {stats.exerciseStats.length === 0 ? (
            <p className="py-8 text-center text-sm text-surface-400">No completed exercises yet.</p>
          ) : (
            <div className="space-y-1">
              {stats.exerciseStats.map((ex) => {
                const reps = getReps(ex, range)
                const tut = getTut(ex, range)
                const vol = getExVolume(ex, range)
                if (reps === 0 && tut === 0 && vol === 0 && range !== 'allTime') return null
                const colorClasses = getExerciseColorClasses(ex.color)
                const isExpanded = expandedExercise === ex.exerciseId

                return (
                  <div key={ex.exerciseId}>
                    <button
                      onClick={() => setExpandedExercise(isExpanded ? null : ex.exerciseId)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-50"
                    >
                      <div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', colorClasses.dot)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-surface-800">{ex.name}</p>
                        <p className="text-xs text-surface-400">
                          {ex.sessions} {ex.sessions === 1 ? 'session' : 'sessions'}
                        </p>
                      </div>
                      <div className="text-right">
                        {vol > 0 && (
                          <p className="text-sm font-semibold text-primary-600">{vol.toLocaleString()} {unit}</p>
                        )}
                        {ex.isTimed ? (
                          tut > 0 && <p className="text-xs text-surface-500">TUT {formatTut(tut)}</p>
                        ) : (
                          reps > 0 && <p className="text-xs text-surface-500">{reps.toLocaleString()} reps</p>
                        )}
                      </div>
                    </button>

                    {/* Expanded detail */}
                    <div
                      className={cn(
                        'grid transition-[grid-template-rows] duration-200 ease-in-out',
                        isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="mb-2 rounded-lg border border-surface-100 bg-surface-50 p-3">
                          <div className="flex flex-col gap-2 md:flex-row md:gap-4">
                            <div className="grid grid-cols-4 gap-2 text-center text-xs md:w-1/2 md:shrink-0">
                              {(['week', 'month', 'year', 'allTime'] as TimeRange[]).map((r) => (
                                <div key={r}>
                                  <p className="font-medium text-surface-400">{r === 'allTime' ? 'All Time' : r.charAt(0).toUpperCase() + r.slice(1)}</p>
                                  {ex.isTimed ? (
                                    <>
                                      <p className="mt-0.5 font-semibold text-surface-700">{formatTut(getTut(ex, r))}</p>
                                      <p className="text-surface-400">TUT</p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="mt-0.5 font-semibold text-surface-700">{getReps(ex, r).toLocaleString()}</p>
                                      <p className="text-surface-400">reps</p>
                                    </>
                                  )}
                                  {getExVolume(ex, r) > 0 && (
                                    <p className="mt-0.5 text-primary-600">{getExVolume(ex, r).toLocaleString()} {unit}</p>
                                  )}
                                </div>
                              ))}
                            </div>

                            {ex.timeline.length > 0 && (
                              <div className="border-t border-surface-200 pt-2 md:border-t-0 md:border-l md:pt-0 md:pl-4 md:min-w-0 md:flex-1">
                                <p className="mb-1 text-xs font-medium text-surface-400">Recent Sessions</p>
                                <div className="max-h-32 space-y-1 overflow-y-auto">
                                  {ex.timeline.slice(-10).reverse().map((t) => (
                                    <div key={t.date} className="flex items-center justify-between text-xs">
                                      <span className="text-surface-500">{t.date}</span>
                                      <span className="text-surface-700">
                                        {t.sets} {t.sets === 1 ? 'set' : 'sets'}
                                        {ex.isTimed
                                          ? ` · TUT ${formatTut(t.tut)}`
                                          : ` · ${t.totalReps} reps`}
                                        {t.volume > 0 && ` · ${t.volume.toLocaleString()} ${unit}`}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stats</h1>
        {/* Time range selector */}
        <div className="flex rounded-lg border border-surface-200 text-xs font-medium">
          {(['week', 'month', 'year', 'allTime'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'px-3 py-1.5 transition-colors first:rounded-l-lg last:rounded-r-lg',
                r === range ? 'bg-primary-600 text-on-primary' : 'text-surface-600 hover:bg-surface-50',
              )}
            >
              {r === 'allTime' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards — always pinned at top */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Weight className="h-4 w-4" />
            Total Weight Moved
          </div>
          <p className="mt-1 text-3xl font-bold">{volume.toLocaleString()}</p>
          <p className="text-xs text-surface-400">{unit}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Dumbbell className="h-4 w-4" />
            Workouts
          </div>
          <p className="mt-1 text-3xl font-bold">{workouts}</p>
          <p className="text-xs text-surface-400">{TIME_LABELS[range]}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Flame className="h-4 w-4" />
            Current Streak
          </div>
          <p className="mt-1 text-3xl font-bold">{stats.streak}</p>
          <p className="text-xs text-surface-400">{stats.streak === 1 ? 'day' : 'days'}</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Trophy className="h-4 w-4" />
            Programs Completed
          </div>
          <p className="mt-1 text-3xl font-bold">{stats.programsCompleted}</p>
        </Card>
      </div>

      {/* Reorderable chart sections */}
      <ReorderableSections storageKey="stats-section-order" sections={chartSections} />
    </div>
  )
}
