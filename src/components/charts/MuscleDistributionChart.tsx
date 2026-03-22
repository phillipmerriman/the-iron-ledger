import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { Exercise } from '@/types/database'
import type { ExerciseStats, TimeRangeTotals } from '@/hooks/useStats'
import type { MuscleGroup, Equipment, WeightUnit } from '@/types/common'

type TimeRange = keyof TimeRangeTotals

interface MuscleDistributionChartProps {
  exerciseStats: ExerciseStats[]
  exercises: Exercise[]
  range: TimeRange
  metric?: 'volume' | 'reps'
  unit?: WeightUnit
}

// Stable color palette for muscle groups
const MUSCLE_COLORS: Record<MuscleGroup, string> = {
  chest: '#ef4444',
  back: '#3b82f6',
  shoulders: '#f97316',
  biceps: '#8b5cf6',
  triceps: '#a855f7',
  forearms: '#6366f1',
  core: '#eab308',
  quads: '#22c55e',
  hamstrings: '#16a34a',
  glutes: '#14b8a6',
  calves: '#06b6d4',
  full_body: '#ec4899',
  upper_body: '#f43f5e',
  lower_body: '#10b981',
  other: '#94a3b8',
}

// Colors for exercise-level drill-down (cycled)
const DRILL_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1',
  '#f43f5e', '#a855f7', '#16a34a', '#d946ef', '#0ea5e9',
]

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'BB',
  dumbbell: 'DB',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'BW',
  kettlebell: 'KB',
  band: 'Band',
  steel_mace: 'Mace',
  steel_club: 'Club',
  other: '',
}

function formatMuscle(muscle: string): string {
  return muscle
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

interface SliceData {
  name: string
  value: number
  color: string
  muscle?: string // present on drill-down slices for back-reference
}

export default function MuscleDistributionChart({
  exerciseStats,
  exercises,
  range,
  metric = 'volume',
  unit,
}: MuscleDistributionChartProps) {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)

  // Build a lookup: exerciseId -> Exercise
  const exerciseMap = useMemo(() => {
    const map = new Map<string, Exercise>()
    for (const ex of exercises) map.set(ex.id, ex)
    return map
  }, [exercises])

  // Top-level: aggregate by primary_muscle
  const muscleData = useMemo(() => {
    const map = new Map<string, number>()
    for (const stat of exerciseStats) {
      const ex = exerciseMap.get(stat.exerciseId)
      if (!ex) continue
      const val = metric === 'volume' ? stat.volume[range] : stat.reps[range]
      if (val <= 0) continue
      const muscle = ex.primary_muscle
      map.set(muscle, (map.get(muscle) ?? 0) + val)
    }
    return Array.from(map.entries())
      .map(([muscle, value]): SliceData => ({
        name: formatMuscle(muscle),
        value,
        color: MUSCLE_COLORS[muscle as MuscleGroup] ?? MUSCLE_COLORS.other,
      }))
      .sort((a, b) => b.value - a.value)
  }, [exerciseStats, exerciseMap, range, metric])

  // Drill-down: exercises within selected muscle group
  const exerciseData = useMemo(() => {
    if (!selectedMuscle) return []
    const results: SliceData[] = []
    for (const stat of exerciseStats) {
      const ex = exerciseMap.get(stat.exerciseId)
      if (!ex || ex.primary_muscle !== selectedMuscle) continue
      const val = metric === 'volume' ? stat.volume[range] : stat.reps[range]
      if (val <= 0) continue
      const eqLabel = EQUIPMENT_LABELS[ex.equipment as Equipment]
      const name = eqLabel ? `${stat.name} (${eqLabel})` : stat.name
      results.push({ name, value: val, color: '', muscle: selectedMuscle })
    }
    results.sort((a, b) => b.value - a.value)
    // Assign colors after sort
    for (let i = 0; i < results.length; i++) {
      results[i].color = DRILL_COLORS[i % DRILL_COLORS.length]
    }
    return results
  }, [selectedMuscle, exerciseStats, exerciseMap, range, metric])

  const data = selectedMuscle ? exerciseData : muscleData
  const total = data.reduce((sum, d) => sum + d.value, 0)

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-surface-400">
        No data for this range.
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Back button when drilled down */}
      {selectedMuscle && (
        <button
          onClick={() => setSelectedMuscle(null)}
          className="self-start text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          &larr; All Muscles
        </button>
      )}

      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
            cursor="pointer"
            onClick={(_, index) => {
              if (!selectedMuscle) {
                // Find the original muscle key from the formatted name
                const clicked = muscleData[index]
                if (clicked) {
                  const muscleKey = Object.keys(MUSCLE_COLORS).find(
                    (k) => formatMuscle(k) === clicked.name,
                  )
                  if (muscleKey) setSelectedMuscle(muscleKey)
                }
              }
            }}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null
              const d = payload[0].payload as SliceData
              const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0'
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                  <p className="font-medium text-surface-800">{d.name}</p>
                  <p className="text-surface-500">
                    {d.value.toLocaleString()}{metric === 'volume' && unit ? ` ${unit}` : metric === 'reps' ? ' reps' : ''} ({pct}%)
                  </p>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
        {data.map((d, i) => (
          <button
            key={i}
            className="flex items-center gap-1 text-surface-600 hover:text-surface-800"
            onClick={() => {
              if (!selectedMuscle) {
                const muscleKey = Object.keys(MUSCLE_COLORS).find(
                  (k) => formatMuscle(k) === d.name,
                )
                if (muscleKey) setSelectedMuscle(muscleKey)
              }
            }}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            {d.name}
          </button>
        ))}
      </div>
    </div>
  )
}
