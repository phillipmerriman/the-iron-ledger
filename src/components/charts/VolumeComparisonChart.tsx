import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  startOfWeek, endOfWeek, subWeeks, eachDayOfInterval,
  startOfMonth, endOfMonth, subMonths,
  format, parseISO, differenceInWeeks, differenceInMonths,
} from 'date-fns'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { WeightUnit } from '@/types/common'
import { cn } from '@/lib/utils'

interface VolumeComparisonChartProps {
  volumeByDay: Record<string, number>
  unit?: WeightUnit
}

type ComparisonKey =
  | 'week_vs_last' | 'week_vs_avg' | 'week_vs_lastYearAvg'
  | 'month_vs_last' | 'month_vs_avg' | 'month_vs_lastYearAvg'
  | 'year_vs_last' | 'year_vs_avg'

const OPTIONS: { value: ComparisonKey; label: string; group: string }[] = [
  { value: 'week_vs_last', label: 'This Week vs Last Week', group: 'Week' },
  { value: 'week_vs_avg', label: 'This Week vs Avg Week', group: 'Week' },
  { value: 'week_vs_lastYearAvg', label: "This Week vs Last Year's Avg", group: 'Week' },
  { value: 'month_vs_last', label: 'This Month vs Last Month', group: 'Month' },
  { value: 'month_vs_avg', label: 'This Month vs Avg Month', group: 'Month' },
  { value: 'month_vs_lastYearAvg', label: "This Month vs Last Year's Avg", group: 'Month' },
  { value: 'year_vs_last', label: 'This Year vs Last Year', group: 'Year' },
  { value: 'year_vs_avg', label: 'This Year vs Avg Year', group: 'Year' },
]

interface BarData {
  label: string
  current: number
  comparison: number
}

function vol(map: Record<string, number>, date: Date): number {
  return map[format(date, 'yyyy-MM-dd')] ?? 0
}

function computeData(
  volumeByDay: Record<string, number>,
  key: ComparisonKey,
): { bars: BarData[]; currentLabel: string; comparisonLabel: string } {
  const now = new Date()
  const allDates = Object.keys(volumeByDay).sort()
  const firstDate = allDates.length > 0 ? parseISO(allDates[0]) : now

  const parts = key.split('_vs_')
  const period = parts[0] // 'week' | 'month' | 'year'
  const comp = parts[1]   // 'last' | 'avg' | 'lastYearAvg'

  // ── Week ───────────────────────────────────────────────
  if (period === 'week') {
    const ws = startOfWeek(now, { weekStartsOn: 1 })
    const we = endOfWeek(now, { weekStartsOn: 1 })
    const days = eachDayOfInterval({ start: ws, end: we })

    const bars: BarData[] = days.map((d) => ({
      label: format(d, 'EEE'),
      current: vol(volumeByDay, d),
      comparison: 0,
    }))

    let comparisonLabel = ''

    if (comp === 'last') {
      comparisonLabel = 'Last Week'
      const lws = subWeeks(ws, 1)
      const ld = eachDayOfInterval({ start: lws, end: endOfWeek(lws, { weekStartsOn: 1 }) })
      ld.forEach((d, i) => { bars[i].comparison = vol(volumeByDay, d) })
    } else if (comp === 'avg') {
      comparisonLabel = 'Avg Week'
      const numWeeks = Math.max(differenceInWeeks(now, firstDate), 1)
      const total = Object.values(volumeByDay).reduce((s, v) => s + v, 0)
      const avg = Math.round(total / numWeeks / 7)
      bars.forEach((b) => { b.comparison = avg })
    } else {
      comparisonLabel = "Last Year's Avg"
      const ly = now.getFullYear() - 1
      const lyVol = Object.entries(volumeByDay)
        .filter(([d]) => parseISO(d).getFullYear() === ly)
        .reduce((s, [, v]) => s + v, 0)
      const avg = Math.round(lyVol / 52 / 7)
      bars.forEach((b) => { b.comparison = avg })
    }

    return { bars, currentLabel: 'This Week', comparisonLabel }
  }

  // ── Month ──────────────────────────────────────────────
  if (period === 'month') {
    const ms = startOfMonth(now)
    const me = endOfMonth(now)
    const days = eachDayOfInterval({ start: ms, end: me })

    const bars: BarData[] = days.map((d) => ({
      label: format(d, 'd'),
      current: vol(volumeByDay, d),
      comparison: 0,
    }))

    let comparisonLabel = ''

    if (comp === 'last') {
      comparisonLabel = 'Last Month'
      const lms = subMonths(ms, 1)
      const ld = eachDayOfInterval({ start: lms, end: endOfMonth(lms) })
      ld.forEach((d, i) => { if (i < bars.length) bars[i].comparison = vol(volumeByDay, d) })
    } else if (comp === 'avg') {
      comparisonLabel = 'Avg Month'
      const numMonths = Math.max(differenceInMonths(now, firstDate), 1)
      const total = Object.values(volumeByDay).reduce((s, v) => s + v, 0)
      const daysInMonth = days.length
      const avg = Math.round(total / numMonths / daysInMonth)
      bars.forEach((b) => { b.comparison = avg })
    } else {
      comparisonLabel = "Last Year's Avg"
      const ly = now.getFullYear() - 1
      const lyVol = Object.entries(volumeByDay)
        .filter(([d]) => parseISO(d).getFullYear() === ly)
        .reduce((s, [, v]) => s + v, 0)
      const avg = Math.round(lyVol / 12 / days.length)
      bars.forEach((b) => { b.comparison = avg })
    }

    return { bars, currentLabel: 'This Month', comparisonLabel }
  }

  // ── Year ───────────────────────────────────────────────
  const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), i, 1))

  const bars: BarData[] = months.map((m) => {
    const md = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) })
    return {
      label: format(m, 'MMM'),
      current: md.reduce((s, d) => s + vol(volumeByDay, d), 0),
      comparison: 0,
    }
  })

  let comparisonLabel = ''

  if (comp === 'last') {
    comparisonLabel = 'Last Year'
    const ly = now.getFullYear() - 1
    const lyMonths = Array.from({ length: 12 }, (_, i) => new Date(ly, i, 1))
    lyMonths.forEach((m, i) => {
      const md = eachDayOfInterval({ start: startOfMonth(m), end: endOfMonth(m) })
      bars[i].comparison = md.reduce((s, d) => s + vol(volumeByDay, d), 0)
    })
  } else {
    comparisonLabel = 'Avg Year'
    const years = new Set(Object.keys(volumeByDay).map((d) => parseISO(d).getFullYear()))
    const numYears = Math.max(years.size, 1)
    const monthTotals = new Array(12).fill(0) as number[]
    for (const [dateStr, v] of Object.entries(volumeByDay)) {
      monthTotals[parseISO(dateStr).getMonth()] += v
    }
    monthTotals.forEach((total, i) => { bars[i].comparison = Math.round(total / numYears) })
  }

  return { bars, currentLabel: 'This Year', comparisonLabel }
}

export default function VolumeComparisonChart({ volumeByDay, unit }: VolumeComparisonChartProps) {
  const [selected, setSelected] = useState<ComparisonKey>('week_vs_last')

  const { bars, currentLabel, comparisonLabel } = useMemo(
    () => computeData(volumeByDay, selected),
    [volumeByDay, selected],
  )

  const currentTotal = bars.reduce((s, b) => s + b.current, 0)
  const compTotal = bars.reduce((s, b) => s + b.comparison, 0)
  const pctChange = compTotal > 0 ? ((currentTotal - compTotal) / compTotal) * 100 : 0
  const isMonth = selected.startsWith('month')

  return (
    <div className="space-y-3">
      {/* Dropdown */}
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value as ComparisonKey)}
        className="w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-surface-700 focus:border-primary-500 focus:outline-none"
      >
        {(['Week', 'Month', 'Year'] as const).map((group) => (
          <optgroup key={group} label={group}>
            {OPTIONS.filter((o) => o.group === group).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {/* Summary */}
      <div className="flex items-center justify-between text-sm">
        <div className="space-y-0.5">
          <p className="text-surface-500">{currentLabel}</p>
          <p className="text-lg font-bold text-surface-800">
            {currentTotal.toLocaleString()}{unit ? ` ${unit}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {pctChange > 0 ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : pctChange < 0 ? (
            <TrendingDown className="h-4 w-4 text-red-500" />
          ) : (
            <Minus className="h-4 w-4 text-surface-400" />
          )}
          <span
            className={cn(
              'text-sm font-semibold',
              pctChange > 0 ? 'text-green-600' : pctChange < 0 ? 'text-red-500' : 'text-surface-400',
            )}
          >
            {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
          </span>
        </div>

        <div className="space-y-0.5 text-right">
          <p className="text-surface-500">{comparisonLabel}</p>
          <p className="text-lg font-bold text-surface-800">
            {compTotal.toLocaleString()}{unit ? ` ${unit}` : ''}
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={bars} barGap={2} barCategoryGap={isMonth ? '10%' : '20%'}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-surface-100)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--color-surface-400)' }}
            tickLine={false}
            axisLine={false}
            interval={isMonth ? 4 : 0}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--color-surface-400)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) =>
              v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
            }
            width={40}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
                  <p className="mb-1 font-medium text-surface-800">{label}</p>
                  {payload.map((p) => (
                    <p key={p.dataKey as string} style={{ color: p.color }}>
                      {p.name}: {(p.value as number).toLocaleString()}{unit ? ` ${unit}` : ''}
                    </p>
                  ))}
                </div>
              )
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="square"
            iconSize={10}
          />
          <Bar dataKey="current" name={currentLabel} fill="#3b82f6" radius={[3, 3, 0, 0]} />
          <Bar dataKey="comparison" name={comparisonLabel} fill="#cbd5e1" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
