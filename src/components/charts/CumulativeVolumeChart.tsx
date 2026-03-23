import { useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, format, parseISO,
} from 'date-fns'
import { X } from 'lucide-react'
import type { WeightUnit } from '@/types/common'
import type { ExerciseStats } from '@/hooks/useStats'
import { cn } from '@/lib/utils'

type Preset = 'week' | 'month' | 'year' | 'allTime' | 'custom'

interface CumulativeVolumeChartProps {
  volumeByDay: Record<string, number>
  exerciseStats?: ExerciseStats[]
  unit?: WeightUnit
}

function getPresetRange(preset: Preset, volumeByDay: Record<string, number>): { start: Date; end: Date } {
  const now = new Date()
  switch (preset) {
    case 'week':
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
    case 'month':
      return { start: startOfMonth(now), end: endOfMonth(now) }
    case 'year':
      return { start: startOfYear(now), end: endOfYear(now) }
    case 'allTime':
    case 'custom': {
      const dates = Object.keys(volumeByDay).sort()
      if (dates.length === 0) return { start: now, end: now }
      return { start: parseISO(dates[0]), end: now }
    }
  }
}

function pickAggregation(dayCount: number): 'none' | 'week' | 'month' {
  if (dayCount > 365) return 'month'
  if (dayCount > 90) return 'week'
  return 'none'
}

/** Rebuild volumeByDay from selected exercise timelines */
function buildFilteredVolumeByDay(
  exerciseStats: ExerciseStats[],
  selectedIds: Set<string>,
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const stat of exerciseStats) {
    if (!selectedIds.has(stat.exerciseId)) continue
    for (const t of stat.timeline) {
      result[t.date] = (result[t.date] ?? 0) + t.volume
    }
  }
  return result
}

export default function CumulativeVolumeChart({ volumeByDay, exerciseStats, unit }: CumulativeVolumeChartProps) {
  const [preset, setPreset] = useState<Preset>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set())

  // Effective volume data — filtered if exercises are selected
  const effectiveVolumeByDay = useMemo(() => {
    if (selectedExercises.size === 0 || !exerciseStats) return volumeByDay
    return buildFilteredVolumeByDay(exerciseStats, selectedExercises)
  }, [volumeByDay, exerciseStats, selectedExercises])

  const data = useMemo(() => {
    let start: Date
    let end: Date

    if (preset === 'custom' && customFrom && customTo) {
      start = parseISO(customFrom)
      end = parseISO(customTo)
      if (start > end) [start, end] = [end, start]
    } else if (preset === 'custom') {
      return []
    } else {
      ({ start, end } = getPresetRange(preset, effectiveVolumeByDay))
    }

    const days = eachDayOfInterval({ start, end })
    const agg = pickAggregation(days.length)

    if (agg === 'none') {
      let cumulative = 0
      return days.map((d) => {
        const key = format(d, 'yyyy-MM-dd')
        cumulative += effectiveVolumeByDay[key] ?? 0
        return {
          label: days.length <= 7 ? format(d, 'EEE') : format(d, 'MMM d'),
          total: cumulative,
          daily: effectiveVolumeByDay[key] ?? 0,
        }
      })
    }

    const buckets = new Map<string, { label: string; vol: number }>()
    for (const d of days) {
      const bucketKey = agg === 'month'
        ? format(d, 'yyyy-MM')
        : format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const label = agg === 'month'
        ? format(d, 'MMM yyyy')
        : format(startOfWeek(d, { weekStartsOn: 1 }), 'MMM d')
      const dateKey = format(d, 'yyyy-MM-dd')
      const existing = buckets.get(bucketKey)
      if (existing) {
        existing.vol += effectiveVolumeByDay[dateKey] ?? 0
      } else {
        buckets.set(bucketKey, { label, vol: effectiveVolumeByDay[dateKey] ?? 0 })
      }
    }

    let cumulative = 0
    return Array.from(buckets.values()).map((b) => {
      cumulative += b.vol
      return { label: b.label, total: cumulative, daily: b.vol }
    })
  }, [effectiveVolumeByDay, preset, customFrom, customTo])

  const finalTotal = data.length > 0 ? data[data.length - 1].total : 0
  const tickInterval = data.length > 30 ? Math.floor(data.length / 10) : data.length > 14 ? 2 : 0

  function toggleExercise(id: string) {
    setSelectedExercises((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset buttons */}
        <div className="flex rounded-lg border border-surface-200 text-xs font-medium">
          {([
            ['week', 'Week'],
            ['month', 'Month'],
            ['year', 'Year'],
            ['allTime', 'All'],
            ['custom', 'Custom'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className={cn(
                'px-3 py-1.5 transition-colors first:rounded-l-lg last:rounded-r-lg',
                preset === key ? 'bg-primary-600 text-on-primary' : 'text-surface-600 hover:bg-surface-50',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Date pickers — visible when Custom is selected */}
        {preset === 'custom' && (
          <div className="flex items-center gap-1.5 text-xs">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="rounded-lg border border-surface-300 bg-surface-50 px-2 py-1.5 text-surface-700 focus:border-primary-500 focus:outline-none"
            />
            <span className="text-surface-400">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="rounded-lg border border-surface-300 bg-surface-50 px-2 py-1.5 text-surface-700 focus:border-primary-500 focus:outline-none"
            />
          </div>
        )}

        {/* Exercise picker */}
        {exerciseStats && exerciseStats.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value) toggleExercise(e.target.value)
            }}
            className="rounded-lg border border-surface-300 bg-surface-50 px-2 py-1.5 text-xs text-surface-700 focus:border-primary-500 focus:outline-none"
          >
            <option value="">
              {selectedExercises.size === 0 ? 'All exercises' : 'Add exercise...'}
            </option>
            {exerciseStats
              .filter((ex) => !selectedExercises.has(ex.exerciseId))
              .map((ex) => (
                <option key={ex.exerciseId} value={ex.exerciseId}>
                  {ex.name}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Selected exercise pills */}
      {selectedExercises.size > 0 && exerciseStats && (
        <div className="flex flex-wrap gap-1.5">
          {Array.from(selectedExercises).map((id) => {
            const ex = exerciseStats.find((e) => e.exerciseId === id)
            if (!ex) return null
            return (
              <button
                key={id}
                onClick={() => toggleExercise(id)}
                className="flex items-center gap-1 rounded-full border border-surface-200 bg-surface-50 px-2.5 py-1 text-xs text-surface-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
              >
                {ex.name}
                <X className="h-3 w-3" />
              </button>
            )
          })}
          <button
            onClick={() => setSelectedExercises(new Set())}
            className="px-2 py-1 text-xs text-primary-600 hover:text-primary-700"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Chart */}
      {finalTotal === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-surface-400">
          {preset === 'custom' && (!customFrom || !customTo)
            ? 'Select a date range.'
            : 'No volume data for this range.'}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cumulativeVolumeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-surface-100)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-surface-400)' }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
              angle={data.length > 20 ? -45 : 0}
              textAnchor={data.length > 20 ? 'end' : 'middle'}
              height={data.length > 20 ? 50 : 30}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-surface-400)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) =>
                v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1000 ? `${Math.round(v / 1000)}k`
                  : `${v}`
              }
              width={48}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as { total: number; daily: number }
                return (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                    <p className="mb-1 font-medium text-surface-800">{label}</p>
                    <p className="text-blue-600">
                      Total: {d.total.toLocaleString()}{unit ? ` ${unit}` : ''}
                    </p>
                    {d.daily > 0 && (
                      <p className="text-surface-500">
                        +{d.daily.toLocaleString()}{unit ? ` ${unit}` : ''}
                      </p>
                    )}
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#cumulativeVolumeGradient)"
              dot={false}
              activeDot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
