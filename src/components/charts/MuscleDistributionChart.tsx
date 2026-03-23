import { useMemo, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { Exercise } from '@/types/database'
import type { ExerciseStats, TimeRangeTotals } from '@/hooks/useStats'
import type { MuscleGroup, Equipment, WeightUnit } from '@/types/common'
import { SquareX } from 'lucide-react'
import { cn } from '@/lib/utils'

type TimeRange = keyof TimeRangeTotals

interface MuscleDistributionChartProps {
  exerciseStats: ExerciseStats[]
  exercises: Exercise[]
  range: TimeRange
  metric?: 'volume' | 'reps'
  unit?: WeightUnit
}

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

function muscleKeyFromName(name: string): string | undefined {
  return Object.keys(MUSCLE_COLORS).find((k) => formatMuscle(k) === name)
}

interface SliceData {
  name: string
  value: number
  color: string
}

interface PieWidgetProps {
  data: SliceData[]
  title?: string
  metric: 'volume' | 'reps'
  unit?: WeightUnit
  onSliceClick?: (index: number) => void
  size?: 'lg' | 'sm'
  highlightColor?: string
}

function PieWidget({ data, title, metric, unit, onSliceClick, size = 'lg', highlightColor }: PieWidgetProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const isLarge = size === 'lg'

  return (
    <div className="flex flex-col items-center gap-1">
      {title && (
        <p
          className="text-xs font-semibold"
          style={highlightColor ? { color: highlightColor } : undefined}
        >
          {title}
        </p>
      )}
      <ResponsiveContainer width="100%" height={isLarge ? 220 : 160}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={isLarge ? 45 : 30}
            outerRadius={isLarge ? 85 : 60}
            paddingAngle={2}
            cursor={onSliceClick ? 'pointer' : undefined}
            onClick={onSliceClick ? (_, i) => onSliceClick(i) : undefined}
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
                    {d.value.toLocaleString()}
                    {metric === 'volume' && unit ? ` ${unit}` : metric === 'reps' ? ' reps' : ''} ({pct}%)
                  </p>
                </div>
              )
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className={cn(
        'flex min-h-[2.5rem] flex-wrap content-start justify-center gap-x-3 gap-y-1 text-xs',
        !isLarge && 'gap-x-2',
      )}>
        {data.map((d, i) => (
          <button
            key={i}
            className={cn(
              'flex items-center gap-1 text-surface-600 hover:text-surface-800',
              onSliceClick && 'cursor-pointer',
            )}
            onClick={onSliceClick ? () => onSliceClick(i) : undefined}
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            {d.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function MuscleDistributionChart({
  exerciseStats,
  exercises,
  range,
  metric = 'volume',
  unit,
}: MuscleDistributionChartProps) {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)

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
      map.set(ex.primary_muscle, (map.get(ex.primary_muscle) ?? 0) + val)
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
      results.push({ name, value: val, color: '' })
    }
    results.sort((a, b) => b.value - a.value)
    for (let i = 0; i < results.length; i++) {
      results[i].color = DRILL_COLORS[i % DRILL_COLORS.length]
    }
    return results
  }, [selectedMuscle, exerciseStats, exerciseMap, range, metric])

  if (muscleData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-surface-400">
        No data for this range.
      </div>
    )
  }

  const selectedColor = selectedMuscle
    ? MUSCLE_COLORS[selectedMuscle as MuscleGroup] ?? MUSCLE_COLORS.other
    : undefined

  return (
    <div className="space-y-2">
      {/* Back button */}
      {selectedMuscle && (
        <button
          onClick={() => setSelectedMuscle(null)}
          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          <SquareX className="h-3.5 w-3.5" />
          Clear Selection
        </button>
      )}

      <div className={cn(
        'grid gap-4',
        selectedMuscle ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
      )}>
        {/* Main muscle group pie — always visible */}
        <PieWidget
          data={muscleData}
          title="All Muscle Groups"
          metric={metric}
          unit={unit}
          size={selectedMuscle ? 'sm' : 'lg'}
          onSliceClick={(i) => {
            const clicked = muscleData[i]
            if (clicked) {
              const key = muscleKeyFromName(clicked.name)
              if (key) setSelectedMuscle(key === selectedMuscle ? null : key)
            }
          }}
        />

        {/* Drill-down pie — appears alongside when a muscle is selected */}
        {selectedMuscle && exerciseData.length > 0 && (
          <PieWidget
            data={exerciseData}
            title={formatMuscle(selectedMuscle)}
            metric={metric}
            unit={unit}
            size="sm"
            highlightColor={selectedColor}
          />
        )}
      </div>
    </div>
  )
}
